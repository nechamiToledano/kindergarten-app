import { PrismaClient } from '@prisma/client';

/**
 * One-off housekeeping: close sessions that were opened and walked away from.
 *
 * Before M10 there was no way to end a sitting early, so every interrupted
 * assessment stayed open forever. The dashboard counted all of them as "active
 * now" and, because none carried a completedAt, reported 0% of children as
 * having completed an assessment — both plainly false.
 *
 * The rule is conservative: a session still open more than 24 hours after it
 * started was not going to be finished. Nothing is deleted. Results, plans and
 * version snapshots are untouched; the session simply gains the abandonedAt it
 * would have got had the teacher been able to press "end early" at the time,
 * and its unfinished plan items are recorded as skipped rather than pending.
 *
 * Run once:  pnpm --filter @kga/api exec tsx prisma/close-stale-sessions.ts
 * Add --dry  to see what it would do without writing.
 */

const prisma = new PrismaClient();
const dryRun = process.argv.includes('--dry');
const STALE_AFTER_MS = 24 * 60 * 60 * 1000;

async function main(): Promise<void> {
  const cutoff = new Date(Date.now() - STALE_AFTER_MS);

  const stale = await prisma.session.findMany({
    where: {
      completedAt: null,
      abandonedAt: null,
      deletedAt: null,
      startedAt: { lt: cutoff },
    },
    select: {
      id: true,
      startedAt: true,
      child: { select: { displayName: true } },
      _count: { select: { results: true, plan: true } },
    },
    orderBy: { startedAt: 'asc' },
  });

  if (stale.length === 0) {
    console.log('No stale sessions. Nothing to do.');
    return;
  }

  console.log(`${stale.length} session(s) open since before ${cutoff.toISOString()}:`);
  for (const session of stale) {
    const age = Math.floor((Date.now() - session.startedAt.getTime()) / 86_400_000);
    console.log(
      `  ${session.id.slice(0, 8)}  ${session.child.displayName.padEnd(12)}  ` +
        `${age}d old  ${session._count.results} result(s)  ${session._count.plan} planned`,
    );
  }

  if (dryRun) {
    console.log('\n--dry: nothing written.');
    return;
  }

  const ids = stale.map((session) => session.id);
  const now = new Date();

  const [skipped, closed] = await prisma.$transaction([
    prisma.sessionPlanItem.updateMany({
      where: { sessionId: { in: ids }, status: 'PENDING' },
      data: { status: 'SKIPPED' },
    }),
    prisma.session.updateMany({
      where: { id: { in: ids } },
      data: { abandonedAt: now },
    }),
  ]);

  await prisma.auditLog.create({
    data: {
      actorId: null,
      action: 'session.abandon.bulk',
      entity: 'Session',
      entityId: null,
      metadata: {
        reason: 'M10 housekeeping — sessions left open before an early-end existed',
        cutoff: cutoff.toISOString(),
        sessionsClosed: closed.count,
        planItemsSkipped: skipped.count,
        sessionIds: ids,
      },
    },
  });

  console.log(
    `\nClosed ${closed.count} session(s); ${skipped.count} pending plan item(s) marked skipped.`,
  );
  console.log('Recorded in AuditLog as session.abandon.bulk.');
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
