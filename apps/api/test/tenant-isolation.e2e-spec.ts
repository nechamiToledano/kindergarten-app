import { INestApplication, ValidationPipe, VersioningType } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../src/app.module.js';
import { PrismaService } from '../src/prisma/prisma.service.js';
import { AuthService } from '../src/identity/auth.service.js';

/**
 * §13.3 / §15 — kindergarten A must not read kindergarten B's children through
 * any endpoint. This is tested explicitly, never assumed from the Prisma extension.
 *
 * Requires a Postgres reachable via DATABASE_URL (a Neon branch or Testcontainers).
 */
describe('tenant isolation (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let tokenA: string;
  let childB: string;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    app.setGlobalPrefix('api');
    app.enableVersioning({ type: VersioningType.URI, defaultVersion: '1' });
    app.useGlobalPipes(new ValidationPipe({ transform: true, whitelist: true }));
    await app.init();

    prisma = app.get(PrismaService);
    const auth = app.get(AuthService);

    const kgA = await prisma.kindergarten.create({ data: { name: 'Alef' } });
    const kgB = await prisma.kindergarten.create({ data: { name: 'Bet' } });

    await auth.register({
      email: `teacher-a-${Date.now()}@test.dev`,
      displayName: 'Teacher A',
      password: 'password123',
      role: 'TEACHER',
      kindergartenId: kgA.id,
    });
    const login = await auth.login({
      email: (await prisma.user.findFirst({ where: { kindergartenId: kgA.id } }))!.email,
      password: 'password123',
    });
    tokenA = login.tokens.accessToken;

    const b = await prisma.child.create({
      data: { kindergartenId: kgB.id, displayName: 'Child B', birthDate: new Date('2021-05-01') },
    });
    childB = b.id;
  });

  afterAll(async () => {
    await app.close();
  });

  it('does not list another kindergarten\'s children', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/v1/children')
      .set('Authorization', `Bearer ${tokenA}`)
      .expect(200);
    expect(res.body.map((c: { id: string }) => c.id)).not.toContain(childB);
  });

  it('returns 404 fetching another kindergarten\'s child by id', async () => {
    await request(app.getHttpServer())
      .get(`/api/v1/children/${childB}`)
      .set('Authorization', `Bearer ${tokenA}`)
      .expect(404);
  });
});
