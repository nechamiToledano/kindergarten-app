import { PrismaClient } from '@prisma/client';
import * as argon2 from 'argon2';
import { GameConfigSchema } from '@kga/contracts';
import { createDefaultRegistry } from '@kga/game-engine';

const prisma = new PrismaClient();
const registry = createDefaultRegistry();

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

  await prisma.child.upsert({
    where: { id: '33333333-3333-4333-8333-333333333333' },
    update: {},
    create: {
      id: '33333333-3333-4333-8333-333333333333',
      kindergartenId: kg.id,
      displayName: 'ילד/ה דמו',
      birthDate: new Date('2021-03-15'),
    },
  });

  const domain = await prisma.ageGroupDomain.upsert({
    where: { id: '44444444-4444-4444-8444-444444444444' },
    update: {},
    create: {
      id: '44444444-4444-4444-8444-444444444444',
      ageGroup: 'AGE_4_5',
      name: 'מודעות פונולוגית',
      orderIndex: 0,
    },
  });

  const gameConfig = GameConfigSchema.parse({
    gameType: 'BINARY_IMAGE_CHOICE',
    promptAudioUrl: 'audio/demo-prompt.mp3',
    options: [
      { id: 'cat', imageUrl: 'images/cat.png', label: 'חתול' },
      { id: 'dog', imageUrl: 'images/dog.png', label: 'כלב' },
    ],
    correctOptionId: 'cat',
  });
  // Content-validation guardrail (§15) also runs at seed time.
  registry.get(gameConfig.gameType).configSchema.parse(gameConfig);

  const existing = await prisma.subdomain.findFirst({ where: { domainId: domain.id } });
  if (!existing) {
    const subdomain = await prisma.subdomain.create({
      data: {
        domainId: domain.id,
        name: 'זיהוי צליל פותח',
        orderIndex: 0,
        teacherInstruction: 'הראה לילד/ה את שתי התמונות ובקש/י לבחור את זו שמתחילה בצליל /ח/.',
        childInstruction: 'איזו תמונה מתחילה בצליל חַ?',
        gameType: gameConfig.gameType,
        gameConfig,
      },
    });
    await prisma.subdomainVersion.create({
      data: { subdomainId: subdomain.id, version: 1, gameType: gameConfig.gameType, gameConfig },
    });
  }

  console.log('Seed complete: teacher@demo.dev / editor@demo.dev  (password123)');
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
