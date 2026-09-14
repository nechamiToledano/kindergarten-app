import { z } from 'zod';
import { AgeGroupSchema } from './common.js';
import { GameConfigSchema, GameTypeIdSchema } from './game-config.js';

export const DomainSchema = z.object({
  id: z.uuid(),
  ageGroup: AgeGroupSchema,
  name: z.string().min(1).max(120),
  orderIndex: z.number().int().min(0),
});
export type Domain = z.infer<typeof DomainSchema>;

export const SubdomainSchema = z.object({
  id: z.uuid(),
  domainId: z.uuid(),
  name: z.string().min(1).max(160),
  orderIndex: z.number().int().min(0),
  teacherInstruction: z.string().min(1),
  childInstruction: z.string().min(1),
  gameType: GameTypeIdSchema,
  /** Current editable config. Immutable snapshots live in SubdomainVersion (§9.3). */
  gameConfig: GameConfigSchema,
});
export type Subdomain = z.infer<typeof SubdomainSchema>;

export const CreateDomainSchema = DomainSchema.omit({ id: true }).extend({
  orderIndex: z.number().int().min(0).default(0),
});
export type CreateDomain = z.infer<typeof CreateDomainSchema>;

export const UpdateDomainSchema = DomainSchema.omit({ id: true, ageGroup: true }).partial();
export type UpdateDomain = z.infer<typeof UpdateDomainSchema>;

export const CreateSubdomainSchema = SubdomainSchema.omit({ id: true });
export type CreateSubdomain = z.infer<typeof CreateSubdomainSchema>;

export const UpdateSubdomainSchema = CreateSubdomainSchema.partial();
export type UpdateSubdomain = z.infer<typeof UpdateSubdomainSchema>;

/** Immutable snapshot a result is measured under (§9.3). */
export const SubdomainVersionSchema = z.object({
  id: z.uuid(),
  subdomainId: z.uuid(),
  version: z.number().int().min(1),
  gameType: GameTypeIdSchema,
  gameConfig: GameConfigSchema,
  createdAt: z.iso.datetime(),
});
export type SubdomainVersion = z.infer<typeof SubdomainVersionSchema>;

/** What the play surface needs for one subdomain, config resolved to a version. */
export const SubdomainForPlaySchema = SubdomainSchema.extend({
  subdomainVersionId: z.uuid(),
  version: z.number().int().min(1),
});
export type SubdomainForPlay = z.infer<typeof SubdomainForPlaySchema>;
