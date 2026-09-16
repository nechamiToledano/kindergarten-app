import { z } from 'zod';

/** M11 — read-only view of AuditLog for the network-wide oversight screen. */
export const AuditLogEntrySchema = z.object({
  id: z.uuid(),
  actorId: z.uuid().nullable(),
  actorName: z.string().nullable(),
  action: z.string(),
  entity: z.string(),
  entityId: z.string().nullable(),
  metadata: z.unknown().nullable(),
  createdAt: z.iso.datetime(),
});
export type AuditLogEntry = z.infer<typeof AuditLogEntrySchema>;

export const AuditLogQuerySchema = z.object({
  entity: z.string().optional(),
  action: z.string().optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(50),
});
export type AuditLogQuery = z.infer<typeof AuditLogQuerySchema>;
