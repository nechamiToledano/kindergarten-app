import { z } from 'zod';
import { AgeGroupSchema } from './common.js';
import { GameConfigSchema, GameTypeIdSchema } from './game-config.js';

/**
 * M10 §1 — a developmental area, global across age bands.
 *
 * This replaced `AgeGroupDomain`, whose `ageGroup` column split one real domain
 * into three unrelated rows and so made a child's progression discontinuous the
 * moment they crossed a band. Age now belongs to the subdomain.
 */
export const DomainSchema = z.object({
  id: z.uuid(),
  /** Stable key independent of the display name — used by seeds and imports. */
  slug: z.string().min(1).max(60),
  name: z.string().min(1).max(120),
  description: z.string().max(400).nullable().default(null),
  /** lucide icon name, resolved by the shared DomainGlyph component. */
  icon: z.string().max(60).nullable().default(null),
  orderIndex: z.number().int().min(0),
});
export type Domain = z.infer<typeof DomainSchema>;

/** 1 foundational · 2 developing · 3 advanced (M10 §1). */
export const SubdomainLevelSchema = z.union([z.literal(1), z.literal(2), z.literal(3)]);
export type SubdomainLevel = z.infer<typeof SubdomainLevelSchema>;

export const SubdomainSchema = z.object({
  id: z.uuid(),
  domainId: z.uuid(),
  name: z.string().min(1).max(160),
  orderIndex: z.number().int().min(0),
  /** The age bands this game is appropriate for; at least one. */
  ageGroups: z.array(AgeGroupSchema).min(1),
  level: SubdomainLevelSchema,
  teacherInstruction: z.string().min(1),
  childInstruction: z.string().min(1),
  gameType: GameTypeIdSchema,
  /** Current editable config. Immutable snapshots live in SubdomainVersion (§9.3). */
  gameConfig: GameConfigSchema,
});
export type Subdomain = z.infer<typeof SubdomainSchema>;

/**
 * List-view shape: everything a picker, library card or plan builder needs,
 * without the gameConfig. A catalogue listing used to ship every config blob to
 * the client — tens of KB of image and hotspot data nothing on screen read.
 */
export const SubdomainSummarySchema = SubdomainSchema.omit({
  gameConfig: true,
  teacherInstruction: true,
  childInstruction: true,
}).extend({
  domainName: z.string(),
  domainSlug: z.string(),
  /** Whether this subdomain has a published version, i.e. whether it is playable. */
  playable: z.boolean(),
});
export type SubdomainSummary = z.infer<typeof SubdomainSummarySchema>;

export const CreateDomainSchema = DomainSchema.omit({ id: true }).extend({
  /** Omit to have the server derive one from the name. */
  slug: z.string().min(1).max(60).optional(),
  orderIndex: z.number().int().min(0).default(0),
  description: z.string().max(400).nullable().optional(),
  icon: z.string().max(60).nullable().optional(),
});
export type CreateDomain = z.infer<typeof CreateDomainSchema>;

export const UpdateDomainSchema = CreateDomainSchema.partial().omit({ slug: true });
export type UpdateDomain = z.infer<typeof UpdateDomainSchema>;

export const CreateSubdomainSchema = SubdomainSchema.omit({ id: true }).extend({
  orderIndex: z.number().int().min(0).default(0),
  level: SubdomainLevelSchema.default(1),
});
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

/** Filters accepted by the content catalogue (`GET /content/subdomains`). */
export const SubdomainQuerySchema = z.object({
  domainId: z.uuid().optional(),
  ageGroup: AgeGroupSchema.optional(),
  level: SubdomainLevelSchema.optional(),
  gameType: GameTypeIdSchema.optional(),
  search: z.string().max(120).optional(),
});
export type SubdomainQuery = z.infer<typeof SubdomainQuerySchema>;
