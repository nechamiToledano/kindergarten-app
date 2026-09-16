import { randomUUID } from 'node:crypto';
import { PrismaClient, type AgeGroup, type Rating } from '@prisma/client';
import * as argon2 from 'argon2';

const prisma = new PrismaClient();

const KG_NAME = 'גן פרפר הזהב';
const PASSWORD = 'password123';

interface ChildSpec {
  displayName: string;
  birthDate: string;
  ageGroup: AgeGroup;
  watch?: boolean;
  /** Ratings to hand out across this child's picked subdomains, in order. */
  ratings?: Rating[];
  /** Leave the child with no sessions at all — the NOT_STARTED case. */
  skipSessions?: boolean;
  /** Also leave one sitting open (unfinished) — the IN_PROGRESS case. */
  leaveOneOpen?: boolean;
}

const CHILDREN: ChildSpec[] = [
  { displayName: 'תמר לוי', birthDate: '2023-02-10', ageGroup: 'AGE_3_4', ratings: ['PRESENT', 'PRESENT', 'PARTIALLY_PRESENT'] },
  { displayName: 'יובל כהן', birthDate: '2022-11-20', ageGroup: 'AGE_3_4', ratings: ['PRESENT', 'ABSENT', 'PRESENT'] },
  { displayName: 'הדר פרץ', birthDate: '2023-06-01', ageGroup: 'AGE_3_4', skipSessions: true },
  { displayName: 'מאיה ברק', birthDate: '2021-08-15', ageGroup: 'AGE_4_5', watch: true, ratings: ['PARTIALLY_PRESENT', 'ABSENT', 'PARTIALLY_PRESENT'] },
  { displayName: 'עידו שני', birthDate: '2021-05-02', ageGroup: 'AGE_4_5', ratings: ['PRESENT', 'PRESENT', 'PRESENT', 'PARTIALLY_PRESENT'] },
  { displayName: 'נועה גל', birthDate: '2021-12-30', ageGroup: 'AGE_4_5', leaveOneOpen: true, ratings: ['PRESENT', 'PARTIALLY_PRESENT'] },
  { displayName: 'גיא שרון', birthDate: '2021-03-03', ageGroup: 'AGE_4_5', ratings: ['ABSENT', 'ABSENT', 'PARTIALLY_PRESENT', 'ABSENT'] },
  { displayName: 'אורי דגן', birthDate: '2020-04-18', ageGroup: 'AGE_5_6', ratings: ['PRESENT', 'PRESENT', 'ABSENT'] },
  { displayName: 'שירה נחום', birthDate: '2020-09-25', ageGroup: 'AGE_5_6', ratings: ['PRESENT', 'PARTIALLY_PRESENT', 'PRESENT', 'PRESENT'] },
  { displayName: 'רן אבידן', birthDate: '2019-11-11', ageGroup: 'AGE_5_6', ratings: ['PRESENT', 'PRESENT'] },
];

function daysAgo(n: number): Date {
  return new Date(Date.now() - n * 86_400_000);
}

async function main(): Promise<void> {
  const network = await prisma.network.upsert({
    where: { id: '11111111-1111-4111-8111-111111111111' },
    update: {},
    create: { id: '11111111-1111-4111-8111-111111111111', name: 'Demo Network' },
  });

  const kg = await prisma.kindergarten.upsert({
    where: { id: '44444444-4444-4444-8444-444444444444' },
    update: { name: KG_NAME },
    create: { id: '44444444-4444-4444-8444-444444444444', name: KG_NAME, networkId: network.id },
  });

  const passwordHash = await argon2.hash(PASSWORD);
  const users: { email: string; displayName: string; role: string }[] = [
    { email: 'admin.parpar@demo.dev', displayName: 'שירי — מנהלת הגן', role: 'KINDERGARTEN_ADMIN' },
    { email: 'gan.parpar1@demo.dev', displayName: 'דנה — גננת', role: 'TEACHER' },
    { email: 'gan.parpar2@demo.dev', displayName: 'מיכל — גננת', role: 'TEACHER' },
  ];
  for (const u of users) {
    await prisma.user.upsert({
      where: { email: u.email },
      update: { displayName: u.displayName, role: u.role as never, kindergartenId: kg.id },
      create: {
        email: u.email,
        displayName: u.displayName,
        passwordHash,
        role: u.role as never,
        kindergartenId: kg.id,
      },
    });
  }

  // Applicable, playable subdomains per age band — fetched once, reused per child.
  const byAgeGroup = new Map<AgeGroup, { id: string; ageGroups: AgeGroup[] }[]>();
  for (const ageGroup of ['AGE_3_4', 'AGE_4_5', 'AGE_5_6'] as AgeGroup[]) {
    const rows = await prisma.subdomain.findMany({
      where: { deletedAt: null, ageGroups: { has: ageGroup }, versions: { some: {} } },
      select: { id: true, ageGroups: true },
      orderBy: { orderIndex: 'asc' },
    });
    byAgeGroup.set(ageGroup, rows);
  }

  let sessionCount = 0;
  let resultCount = 0;

  for (const [i, spec] of CHILDREN.entries()) {
    const child = await prisma.child.upsert({
      where: { id: `44444444-0000-4000-8000-${(i + 1).toString().padStart(12, '0')}` },
      update: {
        displayName: spec.displayName,
        birthDate: new Date(spec.birthDate),
        watch: spec.watch ?? false,
      },
      create: {
        id: `44444444-0000-4000-8000-${(i + 1).toString().padStart(12, '0')}`,
        kindergartenId: kg.id,
        displayName: spec.displayName,
        birthDate: new Date(spec.birthDate),
        watch: spec.watch ?? false,
      },
    });

    if (spec.skipSessions) continue;

    const pool = byAgeGroup.get(spec.ageGroup) ?? [];
    const ratings = spec.ratings ?? [];
    const picked = pool.slice(0, ratings.length);
    if (picked.length === 0) continue;

    const startedAt = daysAgo(10 - i);
    const session = await prisma.session.create({
      data: {
        childId: child.id,
        kindergartenId: kg.id,
        startedAt,
        completedAt: spec.leaveOneOpen ? null : daysAgo(10 - i - 0.02 * picked.length),
        ageGroupAtTime: spec.ageGroup,
        mode: 'ASSESSMENT',
        plan: {
          create: picked.map((sub, idx) => ({ subdomainId: sub.id, orderIndex: idx, status: 'DONE' })),
        },
      },
    });
    sessionCount += 1;

    for (const [idx, sub] of picked.entries()) {
      const version = await prisma.subdomainVersion.findFirst({
        where: { subdomainId: sub.id },
        orderBy: { version: 'desc' },
      });
      if (!version) continue;
      await prisma.subdomainResult.create({
        data: {
          clientId: randomUUID(),
          sessionId: session.id,
          kindergartenId: kg.id,
          childId: child.id,
          subdomainId: sub.id,
          subdomainVersionId: version.id,
          attemptsCount: 1,
          rating: ratings[idx],
          rawAnswers: {},
        },
      });
      resultCount += 1;
    }
  }

  console.log(`Kindergarten: ${KG_NAME} (${kg.id}), network: ${network.name}`);
  console.log(`Children: ${CHILDREN.length}, sessions: ${sessionCount}, results: ${resultCount}`);
  console.log('Users:');
  for (const u of users) console.log(`  ${u.email}  /  ${PASSWORD}   (${u.role})`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
