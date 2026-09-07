# Kindergarten Screening & Diagnostic App

A content-driven diagnostic game engine, run by a teacher on an iPad with a child.
See [`docs/HIGH-LEVEL-DESIGN.md`](docs/HIGH-LEVEL-DESIGN.md) for the architecture.

## Layout

```
apps/
  web/    React 19 + Vite + vite-plugin-pwa   (teacher shell + child play surface)
  api/    NestJS 12 (ESM) + Prisma            (identity · tenancy · children · content · sessions · reports · media)
packages/
  contracts/     Zod schemas → TS types — the single source of truth (§6)
  game-engine/   Pure session state machine, scorers, plugin registry (§7, §8)
  ui/            RTL-aware primitives
  config/        Shared tsconfig / oxlint / prettier presets
```

## Getting started

```bash
corepack enable
pnpm install
cp apps/api/.env.example apps/api/.env      # fill DATABASE_URL + JWT secrets
pnpm --filter @kga/api prisma:migrate
pnpm --filter @kga/api prisma:seed
pnpm dev                                     # web on :5173, api on :3000
```

Seed users (`password123`): `teacher@demo.dev`, `editor@demo.dev`.

## Status

- **M0** — monorepo consolidation, Prisma, PWA plugin registration, CI. ✅
- **M1** — data model (§9), `contracts`, auth + RBAC + tenant scoping, CRUD for
  children / content / sessions, idempotent result sync, the three report views. ✅
- **M2+** — game plugin React components, play surface, outbox, reports UI, admin app. Not started.

## Commands

| Command | What |
|---|---|
| `pnpm build` / `pnpm test` / `pnpm lint` / `pnpm typecheck` | Turborepo across the workspace |
| `pnpm --filter @kga/api start:dev` | API in watch mode |
| `pnpm --filter @kga/api test:e2e` | API integration + tenant-isolation tests (needs a Postgres) |
