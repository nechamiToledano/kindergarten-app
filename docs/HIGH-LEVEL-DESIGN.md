# High-Level Design — Kindergarten Screening & Diagnostic App

**Status:** Draft for execution
**Version:** 1.0
**Language of record:** English (requirements source is Hebrew — see §1.2)

---

## 1. Purpose, Scope & Audience

### 1.1 Purpose

This document translates the Hebrew technical specification into an **executable architecture**:
module boundaries, contracts, extension seams, package layout, and a build order. The
specification answers *what* the system does. This document answers *how it is built, in what
order, and where it is designed to grow.*

Four requirements drive every decision that follows:

| Requirement | Where it is answered |
|---|---|
| Modern technology stack | §5 Monorepo, §6 Contracts, §10 Backend, §11 Frontend |
| Clean code | §3 Principles, §10 layering, §11 structure, §15 Testing |
| Extensible | §7 Game-type plugin registry, §9 content versioning |
| Easy to add a management/admin layer later | §14 — the seams, made explicit |

### 1.2 Source of truth

The authoritative requirements document is
[`אפיון-טכני-אפליקציית-גני-ילדים-v2.md`](../../אפיון-טכני-אפליקציית-גני-ילדים-v2.md) (v3),
referenced throughout as **Spec §N**. Where this document and the spec disagree on *what* the
product does, the spec wins. Where they disagree on *how* it is built, this document wins.

### 1.3 Audience

Developers implementing the system, and the technical stakeholder reviewing the approach before
work begins.

### 1.4 In scope

- A content-driven diagnostic game engine, run by a teacher on an iPad with a child.
- Persistence of every rating and every individual answer.
- Reporting: per child, child vs. group, and cross-child pattern analysis.
- Hebrew RTL PWA, installed via "Add to Home Screen".

### 1.5 Explicitly out of scope (for now)

| Non-goal | Why |
|---|---|
| Full offline operation | Spec §2 — WiFi is assumed available; we build *resilience* to brief drops (§11.5), not offline-first. |
| Clinical diagnosis positioning | Spec §11.3 is unresolved. The system is designed and worded as a **screening/mapping tool for teachers**. |
| Parent-facing application | Not requested. The data model does not preclude it. |
| Microservices | §3.4 — a modular monolith is correct at this scale. |
| Admin application **implementation** | §14 — designed for, deliberately not built in the MVP. |

---

## 2. Baseline: Actual Repository State

Spec §2.2 describes scaffolding as complete. Verification against the working tree shows it is
**partially aspirational**. The roadmap in §17 treats foundation work as real, unfinished work.

| Spec §2.2 claims | Verified actual state |
|---|---|
| `kindergarten-app/{frontend,backend}` | `backend/` sits at the **repo root**, outside `kindergarten-app/` |
| NestJS + Prisma installed, `prisma init` run | `backend/package.json` has **no** `prisma` or `@prisma/client`; no `prisma/` directory exists |
| Neon project linked, `neon.ts` created | No `neon.ts`, no `.neon` file anywhere |
| `vite-plugin-pwa` registered in Vite config | Installed as a dependency, but **not registered** in `frontend/vite.config.ts` |
| Root `.gitignore` + initial commit | The `kindergarten-app` git repo has **zero commits**; `frontend/` is untracked |

What *does* exist and is worth keeping:

- **`kindergarten-app/frontend`** — React 19 + Vite 8 + TypeScript 6, `oxlint` configured.
- **`backend`** — NestJS 12, ESM (`"type": "module"`), Vitest for unit and e2e, `oxlint`, Prettier.

Both are modern and current. Milestone M0 (§17) consolidates and completes them; it does not
restart them.

---

## 3. Architecture Principles

These six principles are the reasoning behind every subsequent section. When a future decision is
ambiguous, resolve it against these.

### 3.1 Content is data, never code

Spec §1 states this as the central architectural principle, and it is correct: the dozens of
subdomains reduce to roughly eight interaction patterns. Adding a new subdomain must be a **row in
the database**, never a new screen in the codebase. Anything specific — images, audio, correct
answers, hotspot coordinates, difficulty — lives in `gameConfig` (JSON), validated by a schema.

The test of whether we have honored this: *adding a new subdomain requires zero code changes.*

### 3.2 Contract-first, defined once

Every request and response shape, and every `gameConfig` variant, is defined **once** as a Zod
schema in a shared package. TypeScript types are inferred from it; the API validates with it; the
OpenAPI document is generated from it; the client imports the same types. Hand-written DTOs
duplicated across a front end and a back end are the single most reliable source of drift in a
TypeScript project, and we simply do not have them.

### 3.3 Ports and adapters at seams that will move

Wherever we can name a likely future change, we put an interface there now — an injection token
with an adapter behind it. Three are known from the spec:

- **Storage** — static assets in the build today (Spec §2.1); Cloudflare R2 the moment a
  non-developer can upload an image (Spec §6). One adapter swap, no call-site changes.
- **Export** — PDF/Excel generation (Spec §7), likely to change libraries or move to a queue.
- **Clock** — so that time-dependent logic (age-group calculation from birth date) is testable.

We do not add ports speculatively. Three named seams, not thirty.

### 3.4 Modular monolith, extractable later

One deployable API with strict internal module boundaries. Modules communicate through their
public service interfaces, never by reaching into each other's repositories. If a module ever
needs to become a separate service, the boundary already exists. At the projected scale — a small
number of kindergartens — anything more than this is cost without benefit.

### 3.5 Tenant-aware and role-aware from day one

Spec §11.6 leaves multi-tenancy open: isolated kindergartens, or a network with cross-kindergarten
visibility? **We do not wait for the answer.** Carrying a `kindergartenId` and enforcing roles from
the first commit costs a few hours. Retrofitting tenant isolation into a live system holding data
about minors is a rewrite with a data-migration and a privacy incident attached. §9.2 and §13 make
both answers work.

### 3.6 Pure domain logic, isolated from frameworks

The session state machine (Spec §5) and the answer scorers contain the actual rules of the
product. They are written as **pure functions with no React, no NestJS, and no database** — in
`packages/game-engine`. They can then be tested exhaustively in milliseconds, and they can be
reused by the admin app's content preview without dragging a UI along.

---

## 4. Target System Architecture

### 4.1 Context

```mermaid
graph LR
    T["👩‍🏫 Teacher<br/>(iPad, Safari PWA)"] --> S["Kindergarten<br/>Screening System"]
    C["🧒 Child<br/>(taps the same iPad)"] -.-> S
    A["🛠️ Content Editor<br/>(planned)"] -.-> S
    S --> N[("Neon<br/>Postgres")]
    S --> CDN["Cloudflare CDN<br/>(static game assets)"]
    S -.-> R2[("Cloudflare R2<br/>(planned)")]

    style A stroke-dasharray: 5 5
    style R2 stroke-dasharray: 5 5
```

### 4.2 Containers

```mermaid
graph TB
    subgraph Client["iPad — Safari PWA"]
        WEB["apps/web<br/>React 19 + Vite<br/>Teacher shell + Child play surface"]
        IDB[("IndexedDB<br/>result outbox")]
        WEB --- IDB
    end

    subgraph Planned["Planned"]
        ADMIN["apps/admin<br/>Content & user management"]
    end

    subgraph Server["API host (Node)"]
        API["apps/api — NestJS<br/>identity · tenancy · children<br/>content · sessions · reports · media"]
    end

    subgraph Shared["packages/ — shared, compiled once"]
        CON["contracts<br/>Zod schemas → TS types"]
        ENG["game-engine<br/>state machine + scorers"]
        UI["ui — RTL primitives"]
    end

    DB[("Neon Postgres")]
    CDNBOX["Cloudflare Pages + CDN<br/>images · audio"]

    WEB -->|"REST /api/v1 (JSON)"| API
    ADMIN -.->|"REST /api/v1"| API
    API --> DB
    WEB --> CDNBOX
    WEB -.-> CON & ENG & UI
    API -.-> CON
    ADMIN -.-> CON & UI

    style ADMIN stroke-dasharray: 5 5
    style Planned stroke-dasharray: 5 5
```

The important shape here: **`packages/contracts` is consumed by all three applications.** That is
what makes the admin app (§14) an addition rather than a rewrite.

---

## 5. Monorepo Layout

### 5.1 Target structure

```
kindergarten-app/
├─ apps/
│  ├─ web/            # ← current kindergarten-app/frontend
│  │                  #   React 19 + Vite + TS + vite-plugin-pwa (registered)
│  ├─ api/            # ← current ../backend  (Prisma added here)
│  │                  #   NestJS 12, ESM, Vitest
│  └─ admin/          # PLANNED (§14) — its own Vite app, reuses every package below
├─ packages/
│  ├─ contracts/      # Zod schemas + inferred types. The single source of truth. (§6)
│  ├─ game-engine/    # Pure session state machine, scorers, plugin registry types. (§7, §8)
│  ├─ ui/             # RTL-aware design-system primitives: TouchTarget, RatingBar, ...
│  └─ config/         # Shared tsconfig / oxlint / prettier presets
├─ docs/
│  └─ HIGH-LEVEL-DESIGN.md
├─ prisma/            # schema.prisma + migrations + seed (owned by apps/api, hoisted for tooling)
├─ pnpm-workspace.yaml
├─ turbo.json
└─ package.json
```

### 5.2 Tooling

| Concern | Choice | Why |
|---|---|---|
| Package manager | **pnpm workspaces** | Strict node_modules layout catches undeclared dependencies at install time — exactly the discipline a shared-package monorepo needs. Fast, disk-efficient. |
| Task orchestration | **Turborepo** | Declares the task graph (`build` depends on `^build`) and caches results. `turbo test` after a contracts change reruns only what depends on contracts. |
| Type composition | **TypeScript project references** | `apps/web` and `apps/api` reference `packages/contracts`; go-to-definition crosses package boundaries; incremental builds. |
| Lint / format | **oxlint + Prettier**, presets in `packages/config` | Already in use in both existing apps. Oxlint is fast enough to run on every save. |

### 5.3 The consolidation move (part of M0)

1. `git mv kindergarten-app/frontend → kindergarten-app/apps/web`.
2. Move root `backend/ → kindergarten-app/apps/api`.
3. Add `pnpm-workspace.yaml`, `turbo.json`, root `package.json`, root `.gitignore`.
4. **Install Prisma in `apps/api`** (`prisma`, `@prisma/client`) and run `prisma init` — Spec §2.2
   claims this was done; it was not.
5. **Register `VitePWA` in `apps/web/vite.config.ts`** — the plugin is installed but inert.
6. Provision Neon, link the project, pull `DATABASE_URL`.
7. **Make the first commit.** The repository currently has none.

A note on ESM: `apps/api` is `"type": "module"`. Keep it that way and configure Prisma and Nest
accordingly — mixed module systems inside one workspace are a recurring, avoidable source of
build friction.

---

## 6. Shared Contracts Layer

`packages/contracts` is the spine of the system.

```ts
// packages/contracts/src/child.ts
export const ChildSchema = z.object({
  id: z.uuid(),
  kindergartenId: z.uuid(),
  displayName: z.string().min(1).max(80),
  birthDate: z.iso.date(),
});
export type Child = z.infer<typeof ChildSchema>;

export const CreateChildSchema = ChildSchema.omit({ id: true });
export type CreateChild = z.infer<typeof CreateChildSchema>;
```

How each side consumes it:

- **API** — `nestjs-zod` turns each schema into a DTO class, giving both runtime validation and a
  generated OpenAPI document. The schema *is* the DTO.
- **Web** — imports `Child` directly. A field renamed in `contracts` becomes a compile error in
  both applications on the next build, not a runtime surprise in a kindergarten.
- **Admin (later)** — imports the same schemas and generates its forms from them (§14.1).

**Rule:** no type that crosses the network boundary is declared anywhere except `packages/contracts`.

---

## 7. The Game-Type Plugin Registry

This is the central extensibility mechanism, and the direct implementation of principle §3.1.

### 7.1 The plugin contract

Spec §4 identifies eight recurring interaction patterns. Each becomes one **plugin** implementing
a single interface:

```ts
// packages/game-engine/src/registry.ts
export interface GamePlugin<TConfig> {
  /** Stable identifier, persisted in the DB. Never renamed. */
  readonly id: GameTypeId;
  /** Validates gameConfig. Used by the API on write AND the client on render. */
  readonly configSchema: z.ZodType<TConfig>;
  /** Decides whether a given answer is correct. Pure. */
  readonly score: (config: TConfig, answer: unknown) => AnswerOutcome;
  /** Every asset URL this config needs — drives preloading (§11.4) and content validation (§15). */
  readonly assetsOf: (config: TConfig) => AssetRef[];
  /** Human-readable label + field hints, so the admin app can render an editor (§14.1). */
  readonly meta: GamePluginMeta;
}
```

The React component lives beside it in `apps/web`, keyed by the same `id`, so
`packages/game-engine` stays framework-free (§3.6).

### 7.2 `gameConfig` as a discriminated union

```ts
export const GameConfigSchema = z.discriminatedUnion('gameType', [
  BinaryImageChoiceConfig,   // Spec §4.1
  MultiImageChoiceConfig,    // Spec §4.2
  HotspotImageConfig,        // Spec §4.3
  DragMatchConfig,           // Spec §4.4
  SequentialTapConfig,       // Spec §4.5  — later
  ComparisonConfig,          // Spec §4.6  — later
  PuzzleConfig,              // Spec §4.7  — later
  PatternCopyConfig,         // Spec §4.8  — later
]);
```

Narrowing on `gameType` gives the exactly-correct config type in both the scorer and the component,
with no casts. The database column stays a single `Jsonb`, so **new game types need no migration.**

### 7.3 What "extensible" concretely means here

Adding game type #9:

1. Create `packages/game-engine/src/plugins/my-game/` — schema, scorer, `assetsOf`, meta.
2. Add its config to the discriminated union.
3. Create `apps/web/src/games/my-game/MyGame.tsx`.
4. Add one line to the registry map.

**Unchanged:** the session state machine, every API endpoint, the database schema, the reporting
layer, and the admin app's content editor — which reads `configSchema` and adapts automatically.

### 7.4 MVP scope

Per Spec §4's own recommendation, build **4.1, 4.2, 4.3, 4.4** first — they cover the large
majority of subdomains across all three age groups. The remaining four are registry additions, not
architectural work.

---

## 8. Session State Machine

Spec §5 defines the flow precisely. It is implemented once, as a **pure state machine** in
`packages/game-engine`, with no framework dependency.

```mermaid
stateDiagram-v2
    [*] --> TeacherInstruction
    TeacherInstruction --> ChildInstruction: teacher taps Start
    ChildInstruction --> Playing: audio finished
    Playing --> CorrectFeedback: correct answer
    Playing --> WrongFeedback: wrong answer
    WrongFeedback --> Playing: attempts < 3
    WrongFeedback --> Exhausted: attempts == 3
    CorrectFeedback --> RatingSuccess
    Exhausted --> RatingFailure
    RatingSuccess --> [*]: rating recorded
    RatingFailure --> [*]: rating + note recorded
```

Rules the spec calls out explicitly, encoded in the machine and covered by tests:

- `attemptsCount` is **per subdomain** and **resets** at the start of each one.
- The teacher **always** rates manually — the machine never auto-assigns a rating, even after a
  correct answer. The engine reports the outcome; the human decides.
- The free-text note field appears **only** on the three-failure branch (`RatingFailure`),
  never after success.
- The child's instruction audio plays **only after a user gesture** — the machine's transition into
  `ChildInstruction` is gesture-triggered, which is what makes Safari's autoplay policy (§11.4) a
  non-issue by construction rather than by patching.

Every individual answer is appended to a `rawAnswers` array as it happens, satisfying Spec §7's
requirement to retain each answer for analyses not yet defined.

**Implementation note:** a plain reducer (`(state, event) => state`) is sufficient and has zero
dependencies. Reach for XState only if the flow grows parallel or nested regions; it currently does
not have them.

---

## 9. Data Model

Prisma schema translating Spec §3, plus three things the spec does not address.

### 9.1 Core entities

```mermaid
erDiagram
    Kindergarten ||--o{ User : employs
    Kindergarten ||--o{ Child : enrolls
    Child ||--o{ Session : has
    Session ||--o{ SubdomainResult : contains
    AgeGroup ||--o{ Domain : groups
    Domain ||--o{ Subdomain : contains
    Subdomain ||--o{ SubdomainResult : measured_by
    Subdomain ||--o{ SubdomainVersion : versioned_as
```

| Entity | Notable fields |
|---|---|
| `Kindergarten` | `id`, `name`, `networkId?` (nullable — see §9.2) |
| `User` | `id`, `kindergartenId`, `email`, `passwordHash`, `role` (§13.1) |
| `Child` | `id`, `kindergartenId`, `displayName`, `birthDate` |
| `Session` | `id`, `childId`, `startedAt`, `ageGroupAtTime` (snapshot — a child crosses age bands) |
| `SubdomainResult` | `sessionId`, `subdomainId`, `subdomainVersionId`, `attemptsCount`, `rating`, `teacherNote?`, `rawAnswers Json` |
| `Subdomain` | `domainId`, `teacherInstruction`, `childInstruction`, `gameType`, `gameConfig Json` |

`rating` is an enum — `PRESENT`, `PARTIALLY_PRESENT`, `ABSENT` — mapping to Spec §5's
*קיים / קיים חלקית / לא קיים* (see the glossary in the appendix).

### 9.2 Multi-tenancy (resolves Spec §11.6 without waiting for the answer)

Every tenant-owned row carries `kindergartenId`, indexed. Access is scoped by a **Prisma client
extension** that injects the tenant filter into every query, so isolation is not dependent on each
developer remembering a `where` clause.

`Kindergarten.networkId` is nullable. Both answers to the open question work with no migration:

- **Isolated kindergartens** → `networkId` stays null; every query scopes to one kindergarten.
- **Network with cross-kindergarten reporting** → a `NetworkAdmin` role (§13.1) scopes to
  `networkId` instead.

### 9.3 Content versioning (a gap in the spec)

Editing a subdomain's `gameConfig` — changing an image, fixing a correct answer — would silently
change the meaning of results already collected under the old config. A March result and an
October result would look comparable in a report while measuring different things.

`SubdomainVersion` holds an immutable snapshot of `gameConfig`; `SubdomainResult` references the
version it was produced under. Reports can then legitimately compare like with like, and the admin
app can edit content freely without corrupting history. This is inexpensive now and effectively
impossible to add retroactively.

### 9.4 Auditing and retention

- `createdAt` / `updatedAt` / `deletedAt` on all business entities; soft delete throughout, because
  this is data about children and hard deletes need to be a deliberate, policy-driven act (§13.3).
- A dedicated `AuditLog` (actor, action, entity, timestamp) — needed the moment an admin layer lets
  someone change content or a rating.

---

## 10. Backend Architecture (`apps/api`)

### 10.1 Modules

Each is a NestJS module with an explicit public surface:

| Module | Responsibility |
|---|---|
| `identity` | Authentication, JWT issuance/refresh, password handling |
| `tenancy` | Kindergartens, networks, tenant-scope resolution |
| `children` | Child roster CRUD, age-group derivation from birth date |
| `content` | Age groups, domains, subdomains, versions; `gameConfig` validation |
| `sessions` | Session lifecycle, result submission, idempotent sync (§11.5) |
| `reports` | Read-model queries and exports (§12) |
| `media` | Asset manifests; `StoragePort` implementation (§10.3) |

### 10.2 Layering

```
Controller  → HTTP only. Zod-validated in, serialized out. No business logic.
   ↓
Service     → Business rules. Framework-agnostic where practical. The only layer worth
              reading to understand what the product does.
   ↓
Repository  → The only layer that imports PrismaClient.
```

Confining Prisma to repositories is what keeps services testable with plain fakes and keeps a
future database change from touching business logic. It is a small discipline with a large payoff,
and it is the concrete meaning of "clean code" in this codebase.

### 10.3 Ports

```ts
export const STORAGE_PORT = Symbol('StoragePort');
export interface StoragePort {
  getUrl(key: string): string;
  put(key: string, data: Buffer, contentType: string): Promise<string>;
}
```

- `StaticAssetStorage` — resolves CDN URLs for build-bundled assets (Spec §2.1). MVP default.
- `R2Storage` — Cloudflare R2 adapter. Registered instead, by configuration, on the day a
  non-developer needs to upload an image (Spec §6, §14.3).

Same pattern for `ExportPort` (PDF/Excel) and `ClockPort` (testable age calculation).

### 10.4 Cross-cutting

Global Zod validation pipe · global exception filter with a stable error shape · **pino** structured
logging with PII redaction (child names never reach logs, §13.3) · `/health` and `/ready` endpoints ·
`@nestjs/config` with a Zod-validated environment schema, so a missing variable fails at boot rather
than at 9 a.m. in a kindergarten.

---

## 11. Frontend Architecture (`apps/web`)

### 11.1 Stack

React 19 + Vite 8 + TypeScript 6 (already in place) · **TanStack Query** for all server state ·
**Zustand** for in-session UI state · **React Router** · **react-i18next** · Tailwind CSS with
logical properties · **Recharts** for reports (Spec §2).

The TanStack Query / Zustand split matters: server state (children, content, past results) has
caching, staleness, and retry semantics that a hand-rolled store gets wrong; session state
(current attempt, current answer) is ephemeral and local. Using one tool for both is the usual
source of a confused data layer.

### 11.2 Structure

```
apps/web/src/
├─ app/         # routing, providers, error boundaries
├─ features/    # children/ · sessions/ · reports/ · auth/   (feature-scoped: api, hooks, components)
├─ games/       # one folder per game plugin — mirrors the registry (§7)
├─ shared/      # AudioUnlockProvider, AssetPreloader, outbox, i18n
└─ styles/
```

Two distinct route shells:

- **Teacher shell** — dense, informational: roster, session setup, ratings, reports.
- **Child play surface** — full-bleed, chrome-free, minimum 80px touch targets (Spec §10), no
  navigation a child can wander into mid-exercise.

They are separate layouts because they serve two different users on one device with genuinely
opposite design requirements.

### 11.3 Hebrew / RTL

`dir="rtl"` at the root; **CSS logical properties everywhere** (`margin-inline-start`, never
`margin-left`) so nothing is hard-coded to one direction; every string externalized through
`react-i18next` from the first component. The externalization is not speculative i18n — it is what
keeps copy editable without a developer, and it is why the admin UI and any future second language
cost little.

### 11.4 iPad / Safari specifics (Spec §2)

- **`AudioUnlockProvider`** — Safari blocks audio without a prior user gesture. A single
  provider unlocks the `AudioContext` on the first tap of the session and exposes a `play()` that is
  thereafter always permitted. Combined with §8's gesture-triggered transition, no instruction audio
  can be silently swallowed.
- **`AssetPreloader`** — before a subdomain begins, `plugin.assetsOf(config)` (§7.1) yields every
  image and audio file it needs; all are fetched and decoded up front. No mid-exercise stall while a
  child waits.
- **PWA** — register `VitePWA` (currently inert, §2), precache the app shell and the asset
  manifest, and provide the icons and splash screen for "Add to Home Screen".

### 11.5 Resilience to brief disconnection

Results are written first to an **IndexedDB outbox** (Dexie), then synced to the API in the
background with retry. A momentary WiFi drop mid-session cannot lose a rating that a teacher has
already given — and re-asking a teacher to re-rate a child she has moved on from is not a recoverable
error in practice.

Each queued result carries a client-generated UUID; the API's submission endpoint is **idempotent**
on that key, so a retried sync cannot create a duplicate.

---

## 12. Reporting & Analytics

Spec §7 defines three views. Each is a dedicated read-model query service in the `reports` module,
kept separate from the write-path services — reporting queries have different shapes and different
performance characteristics, and mixing them into CRUD services is how both become hard to change.

| View | Definition |
|---|---|
| **Single child over time** | Progression per domain and subdomain, textual and charted. |
| **Child vs. group** | A child's ratings against the distribution of their kindergarten cohort. |
| **Cross-child patterns** | All children in a kindergarten segmented by strength/difficulty, so the teacher can form working groups — Spec §7's most valuable and most-specified report. |

Charts render client-side with Recharts. PDF and Excel export runs server-side behind `ExportPort`
(§10.3), so it can move to a background queue later without touching the endpoint.

All three read `SubdomainResult` joined to `SubdomainVersion` (§9.3), so a comparison never
silently spans a content change.

---

## 13. Security & Privacy

This system holds developmental assessment data about identifiable minors. That fact sets the bar.

### 13.1 Roles

| Role | Scope |
|---|---|
| `TEACHER` | Their own kindergarten's children, sessions, and reports |
| `KINDERGARTEN_ADMIN` | Their kindergarten's staff and roster |
| `NETWORK_ADMIN` | All kindergartens under one `networkId` (§9.2) — only if the network model is confirmed |
| `CONTENT_EDITOR` | Content across tenants; **no access to child data at all** |

Enforced by a NestJS guard reading route metadata. `CONTENT_EDITOR` deliberately cannot read child
data — content authoring has no business touching it, and separating them now costs one enum value.

### 13.2 Authentication

JWT access token (short-lived) + refresh token (rotated, revocable). Passwords hashed with argon2id.
Given the shared-iPad reality of a kindergarten, sessions should be short and re-authentication
quick — a fast PIN-style re-entry for an already-authenticated device is worth designing when
teacher workflow is validated with a real user (M3).

### 13.3 Privacy measures

- Tenant isolation is **tested explicitly** (§15), not assumed from the Prisma extension.
- No child PII in logs, error reports, or analytics — enforced by pino redaction (§10.4).
- Soft delete everywhere plus a documented retention and hard-deletion policy, once Spec §11.2
  is answered.
- TLS everywhere; Neon connections over TLS.

### 13.4 Two open questions that block production, not development

Spec §11.2 (who legally owns the data; retention and deletion policy) and §11.3 (is this positioned
as a screening tool or a clinical diagnosis) must be answered **before real children's data is
entered**. They do not block building. Flagging them now so they are resolved on a calm schedule
rather than during a launch.

---

## 14. The Future Admin Layer — the Seams

This is the requirement to be able to "easily build management for the whole application later."
The admin app is not in the MVP. What follows is what will already exist when it starts, so that it
is an *addition* and not a refactor.

### 14.1 Content management → schema-generated forms

The registry (§7.1) already carries, for every game type, a `configSchema` describing every field
and its constraints, plus `meta` with labels and hints. The admin app therefore **generates** its
config editors from those schemas instead of hand-building a form per game type. A new game type
becomes editable in the admin UI the moment it is registered — with no admin-side work at all.

This is the single highest-leverage consequence of the contract-first principle (§3.2).

### 14.2 The hotspot editor (Spec §6)

Spec §6 asks for an internal tool where an editor drags rectangles over an image and the tool emits
the coordinate JSON. It is a self-contained screen whose output is exactly
`HotspotImageConfig.targets` — a schema that already exists and already validates. Roughly a day of
work, sitting entirely on top of established contracts.

### 14.3 Media upload

Register `R2Storage` instead of `StaticAssetStorage` (§10.3). Configuration, not code. This is the
transition Spec §2.1 and §6 both anticipate, and it is a one-line registration precisely because we
put a port there in advance.

### 14.4 User and kindergarten management

RBAC roles (§13.1), tenant scoping (§9.2), and the audit log (§9.4) are all in place from M0. The
admin screens are CRUD over entities that already enforce their own access rules.

### 14.5 Where it lives

`apps/admin` — its own Vite application, importing `packages/contracts`, `packages/ui`, and
`packages/game-engine` (to *preview* a game exactly as a child will see it, using the same scorer).
Separate from `apps/web` because a desktop content-authoring tool and a child-facing iPad surface
share almost no UI requirements — but they share every contract, which is the part that matters.

### 14.6 Summary

| Admin capability | Prerequisite | Status after MVP |
|---|---|---|
| Content CRUD + generated editors | `configSchema` + `meta` per plugin | ✅ exists |
| Hotspot coordinate editor | `HotspotImageConfig` schema | ✅ exists |
| Image/audio upload | `StoragePort` R2 adapter | ⚙️ config swap |
| User & role management | RBAC guard + roles | ✅ exists |
| Kindergarten/network management | `kindergartenId` + `networkId` | ✅ exists |
| Change accountability | `AuditLog` | ✅ exists |

Nothing on that list requires changing the game engine, the session flow, or the data model.

---

## 15. Testing Strategy

| Layer | Tool | What it covers |
|---|---|---|
| Domain units | Vitest | The state machine (§8) and every scorer — pure functions, exhaustive cases, milliseconds. The three-attempt rule and the note-only-on-failure rule are tested here, once, for all game types. |
| API integration | Vitest + Supertest | Each module against a real Postgres (a Neon branch or Testcontainers). **Includes explicit tenant-isolation tests** — kindergarten A must not be able to read kindergarten B's children through any endpoint. |
| Critical path E2E | Playwright | One flow, kept green: log in → start session → answer wrong ×3 → rate with a note → result persisted and visible in a report. |
| **Content validation** | Vitest | Every seeded `gameConfig` is parsed by its plugin's `configSchema`, and every asset returned by `assetsOf` is asserted to exist on disk. |

That last one deserves emphasis. Once content is data (§3.1), **content can be broken without the
code changing** — a typo'd filename, a missing correct answer. This test is the guardrail that makes
content-as-data safe, and it is what will catch a broken exercise before a teacher does, in front of
a child.

---

## 16. Deployment & Environments

| Component | Target | Notes |
|---|---|---|
| `apps/web` | **Cloudflare Pages** | Free, unmetered bandwidth, global CDN. Static game assets ship in the build (Spec §2.1) and are served from the edge. |
| `apps/api` | **See below — a gap in the spec** | |
| Database | **Neon (Frankfurt)** | Scale-to-zero suits intermittent kindergarten-hours usage; branch per environment. |
| Object storage | Cloudflare R2 | Not provisioned until §14.3. |

### 16.1 API hosting — unresolved in the specification

Spec §2.1 and §2.2 cover frontend hosting and the database thoroughly but **never state where the
NestJS API runs.** It needs a persistent Node host. Options, with the trade-off that matters:

| Option | Consideration |
|---|---|
| **Fly.io** | Small always-on instance; can scale to zero, at the cost of cold-start latency on the first request of the morning. |
| **Render** | Free tier sleeps after inactivity — a ~30s wake is a poor first impression for a teacher starting her day. |
| **Railway** | Usage-based; predictable and simple at this scale. |
| **Cloudflare Workers** | Keeps everything on one platform, but NestJS on Workers is a non-trivial adaptation. Not recommended for the MVP. |

**Recommendation:** Fly.io with a minimum of one warm instance during kindergarten hours. Decide at
M0, because it shapes the CI deployment step.

### 16.2 CI/CD

GitHub Actions: `lint → typecheck → test → build`, orchestrated through Turborepo so a PR touching
only `apps/web` does not rebuild the API. Merges to `main` deploy web to Cloudflare Pages and API to
the chosen host. Prisma migrations run as an explicit, reviewed deployment step — never automatically
on boot.

---

## 17. Roadmap

Each milestone has one exit criterion, phrased as something you can demonstrate.

| # | Milestone | Exit criterion |
|---|---|---|
| **M0** | **Foundation** — monorepo consolidation (§5.3), Prisma installed, Neon linked, PWA plugin registered, CI green, both apps deployed with a placeholder, **first commit made** | A trivial change pushed to `main` reaches the deployed web app and API automatically. |
| **M1** | **Data model & API** — Prisma schema (§9), migrations, seed, `contracts` package, CRUD for children/content/sessions, auth + RBAC + tenant scoping | Postman/OpenAPI walkthrough: create a kindergarten, a teacher, a child, a session, a result. Tenant-isolation tests pass. |
| **M2** | **Game engine** — registry (§7), plugins 4.1–4.4, their React components, `AudioUnlockProvider`, `AssetPreloader`, all on mock content and placeholder assets | All four game types playable on an iPad from a JSON fixture. No real content required. |
| **M3** | **Vertical slice** — state machine (§8) wired end to end, teacher rating screens, outbox sync, for **one age group × one domain with real content** | A teacher runs a real child through a real subdomain; the rating and every raw answer are in Neon. **Test with an actual teacher before M5.** |
| **M4** | **Reports** — the three views (§12) plus PDF/Excel export | A teacher opens a child's progression and the cross-child grouping report from real M3 data. |
| **M5** | **Content expansion** — remaining age groups and domains per Spec §9; remaining game types 4.5–4.8 as registry additions | Content-validation tests pass over the full seeded content set. |
| **M6** | **Admin application** (§14) — content CRUD, hotspot editor, media upload via R2, user management | A non-developer adds a new subdomain, with a new image, without a deployment. |

M3 is the milestone that matters most. It is the first point at which the design meets a real
teacher and a real child, and it is deliberately placed **before** the expensive content work in M5
— so that anything the workflow gets wrong is discovered while it is still cheap to change.

---

## 18. Open Questions & Risks

### 18.1 The spec's open questions (§11), triaged

| # | Question | Design position | Truly blocks? |
|---|---|---|---|
| 1 | Deployment scale (how many kindergartens/iPads at launch) | Free tiers cover a small rollout; §16 upgrade paths documented | No |
| 2 | Data ownership, retention, deletion policy | Soft delete + audit log in place; policy needs a decision | **Yes — before real data (§13.4)** |
| 3 | Screening tool vs. clinical diagnosis | All wording is screening-oriented; affects legal positioning | **Yes — before launch** |
| 4 | Incomplete content (vocabulary, letters for ages 5–6) | Content-as-data means these arrive as rows, not code | No — blocks M5 only |
| 5 | Which "physical" subdomains stay manual | Handled by a `MANUAL_OBSERVATION` game type — a rating screen with no game | No |
| 6 | Multi-tenancy: isolated or networked | §9.2 supports both with no migration | **No — resolved by design** |
| 7 | Will non-developers upload images | §10.3 `StoragePort` makes this a config swap | **No — resolved by design** |

Three of seven are neutralized by the architecture. Two are genuine, and both are policy decisions
rather than technical ones — worth starting now precisely because they do not block engineering.

### 18.2 Risks the spec does not name

| Risk | Impact | Mitigation |
|---|---|---|
| **Human voice recordings are a long-lead dependency** | Spec §8 requires a human narrator for phonetic accuracy — TTS is explicitly unacceptable. Scripting, recording, and editing dozens of prompts can easily outrun the code. | Start the recording pipeline at **M2**, in parallel with engine work. Use placeholder audio until it lands. This is the most likely schedule risk in the project. |
| **Asset licensing** | Spec §8 warns against unlicensed images. A licensing problem discovered late is a content rebuild. | Record the license for every asset in the seed data; make it a required field. |
| **Neon free-tier compute** | 100 CU-hours/month across several kindergartens is finite. | Monitor from M1; the Launch plan is a paid upgrade with no migration. |
| **iPad Safari PWA quirks** | Add-to-Home-Screen behavior, storage eviction, and audio policy all differ from desktop Safari. | Test on a real iPad from **M2**, not at the end. A simulator will not surface these. |
| **Teacher workflow assumptions** | The rating-after-every-exercise flow is specified but unvalidated with a real user under real conditions. | M3 exists precisely to test this before content investment. |

---

## Appendix A — Glossary

Consistent naming between the Hebrew requirements and the English codebase.

| Hebrew | English identifier | Notes |
|---|---|---|
| גן | `Kindergarten` | The tenant boundary |
| גננת | `Teacher` (`User` with `role: TEACHER`) | Operates the app; always the one who rates |
| ילד | `Child` | The subject; never a system user |
| תחום | `Domain` | e.g. phonological awareness, visual perception |
| תת-תחום | `Subdomain` | The unit of measurement; maps to one game config |
| סשן אבחון | `Session` | One sitting with one child |
| קיים | `PRESENT` | Rating enum |
| קיים חלקית | `PARTIALLY_PRESENT` | Rating enum |
| לא קיים | `ABSENT` | Rating enum |
| הערת גננת | `teacherNote` | Free text; **only** on the three-failure branch |
| ניסיונות | `attemptsCount` | Max 3, resets per subdomain |
| נקודות מגע | `hotspots` / `targets` | Spec §4.3, §6 |

## Appendix B — Spec Traceability

| Spec § | Covered in |
|---|---|
| §1 Summary, content-driven principle | §3.1, §7 |
| §2 Technology stack, iPad/Safari notes | §5, §10.1, §11.1, §11.4 |
| §2.1 Cost strategy, storage | §10.3, §16 |
| §2.2 Existing scaffold | §2 (corrected), §5.3 |
| §3 Data model | §9 |
| §4 Game-type taxonomy | §7 |
| §5 Session flow | §8 |
| §6 Hotspot mechanism & admin tool | §7.2, §14.2 |
| §7 Analytics & reports | §12 |
| §8 Media assets | §11.4, §18.2 |
| §9 Full content breakdown | §17 (M3, M5) |
| §10 Non-functional requirements | §11.2, §11.3, §16 |
| §11 Open questions | §18.1 |
| §12 Proposed work plan | §17 |
