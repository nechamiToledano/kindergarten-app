import { INestApplication, ValidationPipe, VersioningType } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../src/app.module.js';
import { PrismaService } from '../src/prisma/prisma.service.js';
import { AuthService } from '../src/identity/auth.service.js';

/**
 * M4 reports (§12) — the three views read correctly for the caller's own tenant,
 * and never leak another kindergarten's children (§13.3 / §15: tenant isolation
 * is tested on the report endpoints explicitly, not assumed).
 *
 * Requires a Postgres reachable via DATABASE_URL (a Neon branch or Testcontainers).
 */
describe('reports (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let tokenA: string;
  let childA: string;
  let childB: string;
  let subdomainId: string;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    app.setGlobalPrefix('api');
    app.enableVersioning({ type: VersioningType.URI, defaultVersion: '1' });
    app.useGlobalPipes(new ValidationPipe({ transform: true, whitelist: true }));
    await app.init();

    prisma = app.get(PrismaService);
    const auth = app.get(AuthService);

    const kgA = await prisma.kindergarten.create({ data: { name: 'Reports Alef' } });
    const kgB = await prisma.kindergarten.create({ data: { name: 'Reports Bet' } });

    await auth.register({
      email: `reports-a-${Date.now()}@test.dev`,
      displayName: 'Teacher A',
      password: 'password123',
      role: 'TEACHER',
      kindergartenId: kgA.id,
    });
    const login = await auth.login({
      email: (await prisma.user.findFirst({
        where: { kindergartenId: kgA.id },
        orderBy: { createdAt: 'desc' },
      }))!.email,
      password: 'password123',
    });
    tokenA = login.tokens.accessToken;

    // Shared content — one domain, one subdomain, one version.
    const domain = await prisma.ageGroupDomain.create({
      data: { ageGroup: 'AGE_4_5', name: 'Reports Domain', orderIndex: 0 },
    });
    const config = { gameType: 'MANUAL_OBSERVATION', observationPrompt: 'Observe.' };
    const subdomain = await prisma.subdomain.create({
      data: {
        domainId: domain.id,
        name: 'Reports Subdomain',
        orderIndex: 0,
        teacherInstruction: 'x',
        childInstruction: 'x',
        gameType: 'MANUAL_OBSERVATION',
        gameConfig: config,
      },
    });
    subdomainId = subdomain.id;
    const version = await prisma.subdomainVersion.create({
      data: { subdomainId: subdomain.id, version: 1, gameType: 'MANUAL_OBSERVATION', gameConfig: config },
    });

    // A child + result in each kindergarten, for the same subdomain.
    const mkResult = async (kgId: string, name: string, rating: 'PRESENT' | 'ABSENT') => {
      const child = await prisma.child.create({
        data: { kindergartenId: kgId, displayName: name, birthDate: new Date('2021-01-01') },
      });
      const session = await prisma.session.create({
        data: { kindergartenId: kgId, childId: child.id, ageGroupAtTime: 'AGE_4_5' },
      });
      await prisma.subdomainResult.create({
        data: {
          clientId: crypto.randomUUID(),
          sessionId: session.id,
          subdomainId: subdomain.id,
          subdomainVersionId: version.id,
          attemptsCount: 1,
          rating,
          rawAnswers: [],
        },
      });
      return child.id;
    };
    childA = await mkResult(kgA.id, 'Child A', 'PRESENT');
    childB = await mkResult(kgB.id, 'Child B', 'ABSENT');
  });

  afterAll(async () => {
    await app.close();
  });

  it('returns a child progression with resolved names', async () => {
    const res = await request(app.getHttpServer())
      .get(`/api/v1/reports/children/${childA}/progression`)
      .set('Authorization', `Bearer ${tokenA}`)
      .expect(200);
    expect(res.body.childName).toBe('Child A');
    expect(res.body.points).toHaveLength(1);
    expect(res.body.points[0].subdomainName).toBe('Reports Subdomain');
  });

  it('404s on another kindergarten\'s child progression', async () => {
    await request(app.getHttpServer())
      .get(`/api/v1/reports/children/${childB}/progression`)
      .set('Authorization', `Bearer ${tokenA}`)
      .expect(404);
  });

  it('cross-child patterns include only the caller\'s tenant', async () => {
    const res = await request(app.getHttpServer())
      .get(`/api/v1/reports/subdomains/${subdomainId}/patterns`)
      .set('Authorization', `Bearer ${tokenA}`)
      .expect(200);
    const ids = [...res.body.strong, ...res.body.partial, ...res.body.needsSupport].map(
      (c: { id: string }) => c.id,
    );
    expect(ids).toContain(childA);
    expect(ids).not.toContain(childB);
  });

  it('lists only subdomains this tenant has results for', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/v1/reports/subdomains')
      .set('Authorization', `Bearer ${tokenA}`)
      .expect(200);
    const row = res.body.find((r: { subdomainId: string }) => r.subdomainId === subdomainId);
    expect(row).toBeDefined();
    expect(row.resultCount).toBe(1);
  });

  it('exports a progression report as an attachment', async () => {
    const res = await request(app.getHttpServer())
      .get(`/api/v1/reports/children/${childA}/progression/export?format=pdf`)
      .set('Authorization', `Bearer ${tokenA}`)
      .expect(200);
    expect(res.headers['content-disposition']).toContain('attachment');
  });
});
