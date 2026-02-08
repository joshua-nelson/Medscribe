import { Request, Response } from 'express';
import { queryAuditLogs, AuditAction, AuditResourceType } from '../services/auditService';
import { AppError } from '../middleware/errorHandler';

export async function getAuditLogs(req: Request, res: Response) {
  const providerId = req.provider?.id;
  if (!providerId) {
    throw new AppError(401, 'Unauthorized');
  }

  // Restrict queries to the authenticated user's own audit logs
  // Future: implement admin role check to allow broader access
  const { action, resourceType, resourceId, startDate, endDate, limit, offset } = req.query;

  const parsedStartDate =
    startDate && typeof startDate === 'string' ? new Date(startDate) : undefined;
  const parsedEndDate = endDate && typeof endDate === 'string' ? new Date(endDate) : undefined;
  const parsedLimit = limit && typeof limit === 'string' ? Number.parseInt(limit, 10) : 100;
  const parsedOffset = offset && typeof offset === 'string' ? Number.parseInt(offset, 10) : 0;

  if (parsedStartDate && Number.isNaN(parsedStartDate.getTime())) {
    throw new AppError(400, 'Invalid startDate format');
  }
  if (parsedEndDate && Number.isNaN(parsedEndDate.getTime())) {
    throw new AppError(400, 'Invalid endDate format');
  }
  if (Number.isNaN(parsedLimit) || parsedLimit < 1 || parsedLimit > 1000) {
    throw new AppError(400, 'limit must be between 1 and 1000');
  }
  if (Number.isNaN(parsedOffset) || parsedOffset < 0) {
    throw new AppError(400, 'offset must be non-negative');
  }

  const result = await queryAuditLogs({
    actorId: providerId, // Always scope to authenticated user
    action: action && typeof action === 'string' ? (action as AuditAction) : undefined,
    resourceType:
      resourceType && typeof resourceType === 'string'
        ? (resourceType as AuditResourceType)
        : undefined,
    resourceId: resourceId && typeof resourceId === 'string' ? resourceId : undefined,
    startDate: parsedStartDate,
    endDate: parsedEndDate,
    limit: parsedLimit,
    offset: parsedOffset,
  });

  res.json(result);
}
