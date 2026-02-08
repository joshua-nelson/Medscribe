import { Request, Response } from 'express';
import prisma from '../models/prisma';
import { auditFromRequest } from '../services/auditService';
import { AppError } from '../middleware/errorHandler';

const ENCOUNTER_STATUSES = new Set(['recording', 'processing', 'draft', 'finalized']);

function requireProviderId(req: Request) {
  const providerId = req.provider?.id;
  if (!providerId) {
    throw new AppError(401, 'Unauthorized');
  }
  return providerId;
}

function validateStatus(status: unknown): string {
  if (typeof status !== 'string' || !ENCOUNTER_STATUSES.has(status)) {
    throw new AppError(400, 'Invalid status. Allowed: recording, processing, draft, finalized');
  }
  return status;
}

function validateEncounterId(id: unknown): string {
  if (typeof id !== 'string' || !id.trim()) {
    throw new AppError(400, 'Invalid encounter id');
  }
  return id;
}

function validatePatientName(patientName: unknown): string | null {
  if (patientName === null) return null;
  if (typeof patientName !== 'string') {
    throw new AppError(400, 'patientName must be a string or null');
  }
  const trimmed = patientName.trim();
  if (!trimmed) {
    throw new AppError(400, 'patientName cannot be empty');
  }
  return trimmed;
}

export async function createEncounter(req: Request, res: Response) {
  const providerId = requireProviderId(req);
  const { patientName, status } = req.body as { patientName?: unknown; status?: unknown };

  const encounter = await prisma.encounter.create({
    data: {
      providerId,
      patientName: patientName === undefined ? undefined : validatePatientName(patientName),
      status: status === undefined ? undefined : validateStatus(status),
    },
  });

  await auditFromRequest(req, 'encounter.create', 'encounter', encounter.id, {
    patientName: encounter.patientName,
    status: encounter.status,
  });

  res.status(201).json({ encounter });
}

export async function getEncounter(req: Request, res: Response) {
  const providerId = requireProviderId(req);
  const id = validateEncounterId(req.params.id);

  const encounter = await prisma.encounter.findFirst({
    where: { id, providerId },
    include: {
      transcripts: {
        orderBy: { createdAt: 'asc' },
      },
    },
  });

  if (!encounter) {
    throw new AppError(404, 'Encounter not found');
  }

  await auditFromRequest(req, 'encounter.view', 'encounter', encounter.id, {
    patientName: encounter.patientName,
  });

  res.json({ encounter });
}

export async function updateEncounter(req: Request, res: Response) {
  const providerId = requireProviderId(req);
  const id = validateEncounterId(req.params.id);
  const { patientName, status } = req.body as { patientName?: unknown; status?: unknown };

  const encounter = await prisma.encounter.findFirst({
    where: { id, providerId },
    select: { id: true },
  });

  if (!encounter) {
    throw new AppError(404, 'Encounter not found');
  }

  const updateData: { patientName?: string | null; status?: string } = {};
  if (patientName !== undefined) {
    updateData.patientName = validatePatientName(patientName);
  }
  if (status !== undefined) {
    updateData.status = validateStatus(status);
  }

  if (Object.keys(updateData).length === 0) {
    throw new AppError(400, 'At least one updatable field is required: patientName or status');
  }

  const updatedEncounter = await prisma.encounter.update({
    where: { id },
    data: updateData,
  });

  await auditFromRequest(req, 'encounter.update', 'encounter', updatedEncounter.id, {
    changes: updateData,
  });

  res.json({ encounter: updatedEncounter });
}

export async function listEncounters(req: Request, res: Response) {
  const providerId = requireProviderId(req);
  const statusParam = req.query.status;
  let status: string | undefined;

  if (statusParam !== undefined) {
    if (Array.isArray(statusParam)) {
      throw new AppError(400, 'status must be a single value');
    }
    status = validateStatus(statusParam);
  }

  const encounters = await prisma.encounter.findMany({
    where: { providerId, ...(status ? { status } : {}) },
    include: {
      transcripts: {
        orderBy: { createdAt: 'desc' },
      },
    },
    orderBy: { startedAt: 'desc' },
  });

  await auditFromRequest(req, 'encounter.list', null, undefined, {
    count: encounters.length,
    statusFilter: status,
  });

  res.json({ encounters });
}
