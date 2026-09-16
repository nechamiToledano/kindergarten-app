import { Injectable, type OnModuleDestroy, type OnModuleInit } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

/**
 * Models that carry a kindergartenId and must be tenant-scoped (§9.2).
 *
 * M10 §3 added SubdomainResult. Until then the only thing keeping one
 * kindergarten's results out of another's reports was every report query
 * remembering to write `session: { kindergartenId }` by hand — one forgotten
 * clause away from a cross-tenant leak, in the module most likely to grow new
 * queries.
 */
const TENANT_MODELS = new Set(['Child', 'Session', 'SubdomainResult']);

/**
 * A normal Prisma client whose reads/updates/deletes on tenant-owned models are
 * transparently filtered by `kindergartenId`. Creates still pass an explicit
 * `kindergartenId` (type-checked, and the extension asserts it matches).
 */
export type TenantScopedClient = Omit<PrismaClient, `$${string}`>;

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  async onModuleInit(): Promise<void> {
    await this.$connect();
  }

  async onModuleDestroy(): Promise<void> {
    await this.$disconnect();
  }

  /**
   * Returns a client that injects `where: { kindergartenId }` into every read,
   * update and delete on tenant-owned models, and sets it on every create — so
   * isolation does not depend on a developer remembering a where clause (§9.2).
   */
  forTenant(kindergartenId: string): TenantScopedClient {
    return this.$extends({
      query: {
        $allModels: {
          async $allOperations({ model, operation, args, query }) {
            if (!model || !TENANT_MODELS.has(model)) return query(args);
            const a = (args ?? {}) as Record<string, any>;

            const assertTenant = (row: Record<string, unknown>) => {
              if (row.kindergartenId != null && row.kindergartenId !== kindergartenId) {
                throw new Error('Cross-tenant write blocked by tenant scope');
              }
              return { ...row, kindergartenId };
            };

            if (operation === 'create') {
              a.data = assertTenant(a.data ?? {});
            } else if (operation === 'createMany') {
              const rows = Array.isArray(a.data) ? a.data : [a.data];
              a.data = rows.map((r: Record<string, unknown>) => assertTenant(r ?? {}));
            } else if (
              operation === 'findMany' ||
              operation === 'findFirst' ||
              operation === 'findUnique' ||
              operation === 'count' ||
              operation === 'aggregate' ||
              operation === 'updateMany' ||
              operation === 'deleteMany' ||
              operation === 'update' ||
              operation === 'delete'
            ) {
              a.where = { ...a.where, kindergartenId };
            }
            return query(a);
          },
        },
      },
    }) as unknown as TenantScopedClient;
  }
}
