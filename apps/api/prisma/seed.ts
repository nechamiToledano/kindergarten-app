import { PrismaClient } from '@prisma/client';
import * as argon2 from 'argon2';
import { GameConfigSchema } from '@kga/contracts';
import { createDefaultRegistry } from '@kga/game-engine';
import { CONTENT, domainMetaFor } from './content.js';

const prisma = new PrismaClient();
const registry = createDefaultRegistry();

/**
 * Seeds the full M5 content set (Spec §9) across all three age groups from the
 * catalogue in `content.ts`. Media stays on placeholders (Spec §8 / HLD §18.2).
 * Every gameConfig is re-validated against its plugin schema here, the same
 * guardrail `content.spec.ts` runs in CI (§15).
 */
async function main(): Promise<void> {
  const network = await prisma.network.upsert({
    where: { id: '11111111-1111-4111-8111-111111111111' },
    update: {},
    create: { id: '11111111-1111-4111-8111-111111111111', name: 'Demo Network' },
  });

  const kg = await prisma.kindergarten.upsert({
    where: { id: '22222222-2222-4222-8222-222222222222' },
    update: {},
    create: { id: '22222222-2222-4222-8222-222222222222', name: 'גן דמו', networkId: network.id },
  });

  const password = await argon2.hash('password123');
  await prisma.user.upsert({
    where: { email: 'teacher@demo.dev' },
    update: {},
    create: {
      email: 'teacher@demo.dev',
      displayName: 'גננת דמו',
      passwordHash: password,
      role: 'TEACHER',
      kindergartenId: kg.id,
    },
  });
  await prisma.user.upsert({
    where: { email: 'editor@demo.dev' },
    update: {},
    create: {
      email: 'editor@demo.dev',
      displayName: 'Content Editor',
      passwordHash: password,
      role: 'CONTENT_EDITOR',
      kindergartenId: null,
    },
  });

  for (const [i, spec] of [
    { id: '33333333-3333-4333-8333-333333333333', displayName: 'נועה דמו', birthDate: '2021-03-15' },
    { id: '33333333-3333-4333-8333-333333333334', displayName: 'איתי דמו', birthDate: '2020-11-02' },
  ].entries()) {
    await prisma.child.upsert({
      where: { id: spec.id },
      update: {},
      create: {
        id: spec.id,
        kindergartenId: kg.id,
        displayName: spec.displayName,
        birthDate: new Date(spec.birthDate),
        createdAt: new Date(Date.now() - i * 1000),
      },
    });
  }

  // M10 §1 — a domain name that appears under several age groups is one row.
  // Upserting by slug lands on exactly the rows the migration folded the old
  // AgeGroupDomain table into; keying by the catalogue's own per-age-group ids
  // would fork the catalogue on the first re-seed.
  const domainIdBySlug = new Map<string, string>();
  let subdomainCount = 0;

  for (const ageGroup of CONTENT) {
    for (const domainSpec of ageGroup.domains) {
      const meta = domainMetaFor(domainSpec.name);
      const domain = await prisma.domain.upsert({
        where: { slug: meta.slug },
        update: { name: domainSpec.name, icon: meta.icon, description: meta.description },
        create: {
          slug: meta.slug,
          name: domainSpec.name,
          icon: meta.icon,
          description: meta.description,
          orderIndex: domainSpec.orderIndex,
        },
      });
      domainIdBySlug.set(meta.slug, domain.id);

      for (const [index, sub] of domainSpec.subdomains.entries()) {
        const config = GameConfigSchema.parse(sub.config);
        // Content-validation guardrail (§15) — every seeded config parses under its plugin schema.
        registry.get(config.gameType).configSchema.parse(config);

        // `level` is deliberately not set from the catalogue: nothing in it grades
        // difficulty, and inventing a grade would put a number in front of a
        // teacher that no one chose. Seeded content sits at level 1 until a
        // content editor grades it in the library.
        await prisma.subdomain.upsert({
          where: { id: sub.id },
          update: {
            domainId: domain.id,
            name: sub.name,
            orderIndex: index,
            ageGroups: [ageGroup.ageGroup],
            teacherInstruction: sub.teacherInstruction,
            childInstruction: sub.childInstruction,
            gameType: config.gameType,
            gameConfig: config,
          },
          create: {
            id: sub.id,
            domainId: domain.id,
            name: sub.name,
            orderIndex: index,
            ageGroups: [ageGroup.ageGroup],
            teacherInstruction: sub.teacherInstruction,
            childInstruction: sub.childInstruction,
            gameType: config.gameType,
            gameConfig: config,
          },
        });
        subdomainCount += 1;

        const latest = await prisma.subdomainVersion.findFirst({
          where: { subdomainId: sub.id },
          orderBy: { version: 'desc' },
        });
        if (!latest || JSON.stringify(latest.gameConfig) !== JSON.stringify(config)) {
          await prisma.subdomainVersion.create({
            data: {
              subdomainId: sub.id,
              version: (latest?.version ?? 0) + 1,
              gameType: config.gameType,
              gameConfig: config,
            },
          });
        }
      }
    }
  }

  console.log(
    `Seed complete: ${domainIdBySlug.size} domains, ${subdomainCount} subdomains across ${CONTENT.length} age groups.\n` +
      'Login: teacher@demo.dev / editor@demo.dev  (password123)',
  );
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
