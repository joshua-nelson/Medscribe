import prisma from '../models/prisma';
import type { Request } from 'express';

/**
 * Audit Service for HIPAA-compliant access logging
 * Implements HIPAA §164.312(b) - Audit controls
 *
 * CRITICAL: Audit logs are IMMUTABLE - no updates or deletes allowed
 * Minimum retention: 6 years per HIPAA requirements
 */

export type AuditAction =
  // Authentication events
  | 'auth.login'
  | 'auth.logout'
  | 'auth.register'
  | 'auth.refresh_token'
  | 'auth.failed_login'
  // Encounter events (PHI access)
  | 'encounter.create'
  | 'encounter.view'
  | 'encounter.update'
  | 'encounter.delete'
  | 'encounter.list'
  // Transcript events (PHI access)
  | 'transcript.view'
  | 'transcript.update'
  | 'transcript.speaker_correction'
  // Note events (PHI access)
  | 'note.view'
  | 'note.export'
  | 'note.finalize'
  // Admin events
  | 'admin.view_logs'
  | 'admin.view_users';

export type AuditResourceType = 'encounter' | 'transcript' | 'note' | 'provider' | null;

interface CreateAuditLogParams {
  actorId: string; // Provider ID or 'system' for automated actions
  action: AuditAction;
  resourceType?: AuditResourceType;
  resourceId?: string;
  ipAddress?: string;
  userAgent?: string;
  details?: Record<string, unknown>;
}

/**
 * Create an immutable audit log entry
 * MUST be called for all PHI access events
 */
export async function createAuditLog(params: CreateAuditLogParams): Promise<void> {
  try {
    await prisma.auditLog.create({
      data: {
        actorId: params.actorId,
        action: params.action,
        resourceType: params.resourceType ?? null,
        resourceId: params.resourceId ?? null,
        ipAddress: params.ipAddress ?? null,
        userAgent: params.userAgent ?? null,
        details: params.details ?? null,
      },
    });
  } catch (error) {
    // CRITICAL: Audit logging failures must be visible but not block requests
    // In production, this should alert security team
    console.error('[AUDIT ERROR] Failed to create audit log:', {
      error: error instanceof Error ? error.message : String(error),
      params,
    });
    // Do NOT throw - audit failures should not break the application
  }
}

/**
 * Create audit log from Express request
 * Automatically extracts IP and User-Agent
 *
 * For authenticated actions: uses req.provider.id
 * For unauthenticated actions (login/register): pass actorId in details
 */
export async function auditFromRequest(
  req: Request,
  action: AuditAction,
  resourceType?: AuditResourceType,
  resourceId?: string,
  details?: Record<string, unknown>,
): Promise<void> {
  const actorId = req.provider?.id ?? (details?.actorId as string);
  if (!actorId) {
    return;
  }

  const ipAddress = (req.ip || req.socket?.remoteAddress || 'unknown').replace('::ffff:', '');
  const userAgent = req.get ? req.get('user-agent') : undefined;

  const cleanDetails = details ? { ...details } : undefined;
  if (cleanDetails?.actorId) {
    delete cleanDetails.actorId;
  }

  await createAuditLog({
    actorId,
    action,
    resourceType,
    resourceId,
    ipAddress,
    userAgent,
    details: cleanDetails,
  });
}

/**
 * Query audit logs with optional filters
 * Supports filtering by actor, action, resource, date range
 * Note: Access control must be enforced by the caller (e.g., scope actorId to authenticated user)
 */
export async function queryAuditLogs(params: {
  actorId?: string;
  action?: AuditAction;
  resourceType?: AuditResourceType;
  resourceId?: string;
  startDate?: Date;
  endDate?: Date;
  limit?: number;
  offset?: number;
}) {
  const where: Record<string, unknown> = {};

  if (params.actorId) where.actorId = params.actorId;
  if (params.action) where.action = params.action;
  if (params.resourceType) where.resourceType = params.resourceType;
  if (params.resourceId) where.resourceId = params.resourceId;

  if (params.startDate || params.endDate) {
    where.timestamp = {};
    if (params.startDate) (where.timestamp as Record<string, unknown>).gte = params.startDate;
    if (params.endDate) (where.timestamp as Record<string, unknown>).lte = params.endDate;
  }

  const [logs, total] = await Promise.all([
    prisma.auditLog.findMany({
      where,
      orderBy: { timestamp: 'desc' },
      take: params.limit ?? 100,
      skip: params.offset ?? 0,
    }),
    prisma.auditLog.count({ where }),
  ]);

  return { logs, total };
}
