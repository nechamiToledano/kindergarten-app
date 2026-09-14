import { z } from 'zod';

/**
 * Zod-validated environment (§10.4). A missing variable fails at boot,
 * not at 9 a.m. in a kindergarten.
 */
export const EnvSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().default(3000),
  DATABASE_URL: z.string().min(1),
  JWT_ACCESS_SECRET: z.string().min(16),
  JWT_REFRESH_SECRET: z.string().min(16),
  JWT_ACCESS_TTL: z.string().default('15m'),
  JWT_REFRESH_TTL: z.string().default('30d'),
  CDN_BASE_URL: z.string().default(''),
  STORAGE_DRIVER: z.enum(['static', 'r2']).default('static'),
  // Cloudflare R2 (§14.3) — only read when STORAGE_DRIVER=r2.
  R2_ACCOUNT_ID: z.string().default(''),
  R2_ACCESS_KEY_ID: z.string().default(''),
  R2_SECRET_ACCESS_KEY: z.string().default(''),
  R2_BUCKET: z.string().default(''),
  /** Public base URL of the bucket (custom domain or r2.dev), used to build asset URLs. */
  R2_PUBLIC_BASE_URL: z.string().default(''),
});

export type Env = z.infer<typeof EnvSchema>;

export function validateEnv(raw: Record<string, unknown>): Env {
  const parsed = EnvSchema.safeParse(raw);
  if (!parsed.success) {
    const issues = parsed.error.issues.map((i) => `  - ${i.path.join('.')}: ${i.message}`).join('\n');
    throw new Error(`Invalid environment configuration:\n${issues}`);
  }
  return parsed.data;
}
