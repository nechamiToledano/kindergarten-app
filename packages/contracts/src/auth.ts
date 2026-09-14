import { z } from 'zod';
import { RoleSchema } from './common.js';

export const UserSchema = z.object({
  id: z.uuid(),
  kindergartenId: z.uuid().nullable(),
  email: z.email(),
  displayName: z.string().min(1).max(120),
  role: RoleSchema,
});
export type User = z.infer<typeof UserSchema>;

export const CreateUserSchema = UserSchema.omit({ id: true }).extend({
  password: z.string().min(8).max(200),
});
export type CreateUser = z.infer<typeof CreateUserSchema>;

/** Staff management (§14.4). Email is immutable; password reset is optional. */
export const UpdateUserSchema = z
  .object({
    displayName: z.string().min(1).max(120),
    role: RoleSchema,
    kindergartenId: z.uuid().nullable(),
    password: z.string().min(8).max(200),
  })
  .partial();
export type UpdateUser = z.infer<typeof UpdateUserSchema>;

export const LoginSchema = z.object({
  email: z.email(),
  password: z.string().min(1),
});
export type LoginRequest = z.infer<typeof LoginSchema>;

export const RefreshSchema = z.object({ refreshToken: z.string().min(1) });
export type RefreshRequest = z.infer<typeof RefreshSchema>;

export const AuthTokensSchema = z.object({
  accessToken: z.string(),
  refreshToken: z.string(),
  expiresIn: z.number().int(),
});
export type AuthTokens = z.infer<typeof AuthTokensSchema>;

export const AuthResultSchema = z.object({
  user: UserSchema,
  tokens: AuthTokensSchema,
});
export type AuthResult = z.infer<typeof AuthResultSchema>;

/** Decoded JWT payload — the request-scoped principal (§10.2, §13). */
export const PrincipalSchema = z.object({
  sub: z.uuid(),
  role: RoleSchema,
  kindergartenId: z.uuid().nullable(),
  networkId: z.uuid().nullable(),
});
export type Principal = z.infer<typeof PrincipalSchema>;
