import { Request, Response } from 'express';
import prisma from '../models/prisma';
import { AppError } from '../middleware/errorHandler';
import { checkAsrHealth, transcribeAudioFile } from '../services/transcriptionService';
import { config } from '../config';
import {
  annotateTranscriptWithSpeakers,
  diarizeAudioFile,
  SpeakerRole,
} from '../services/diarizationService';

type SpeakerSegment = {
  start: number;
  end: number;
  text: string;
  speaker?: string;
  speakerRole?: SpeakerRole;
};

type EncounterSpeakerAssignments = {
  providerSpeaker: string;
  patientSpeaker: string;
};

type SpeakerCorrection = {
  type: 'single' | 'bulk';
  transcriptId: string;
  segmentIndex?: number;
  fromSpeaker?: string;
  toSpeaker: string;
  toRole: SpeakerRole;
  correctedAt: string;
  correctedBy: string;
};

function defaultAssignments(): EncounterSpeakerAssignments {
  return {
    providerSpeaker: 'SPEAKER_0',
    patientSpeaker: 'SPEAKER_1',
  };
}

function parseAssignments(raw: unknown): EncounterSpeakerAssignments {
  const fallback = defaultAssignments();
  if (!raw || typeof raw !== 'object') return fallback;

  const candidate = raw as { providerSpeaker?: unknown; patientSpeaker?: unknown };
  return {
    providerSpeaker:
      typeof candidate.providerSpeaker === 'string' && candidate.providerSpeaker.trim().length > 0
        ? candidate.providerSpeaker
        : fallback.providerSpeaker,
    patientSpeaker:
      typeof candidate.patientSpeaker === 'string' && candidate.patientSpeaker.trim().length > 0
        ? candidate.patientSpeaker
        : fallback.patientSpeaker,
  };
}

function parseSegments(rawSegments: unknown): SpeakerSegment[] {
  if (!Array.isArray(rawSegments)) return [];

  const parsed: SpeakerSegment[] = [];
  for (const item of rawSegments) {
    if (!item || typeof item !== 'object') continue;
    const segment = item as {
      start?: unknown;
      end?: unknown;
      text?: unknown;
      speaker?: unknown;
      speakerRole?: unknown;
    };

    if (
      typeof segment.start !== 'number' ||
      typeof segment.end !== 'number' ||
      typeof segment.text !== 'string'
    ) {
      continue;
    }

    const speakerRole =
      segment.speakerRole === 'Provider' ||
      segment.speakerRole === 'Patient' ||
      segment.speakerRole === 'Speaker'
        ? segment.speakerRole
        : undefined;

    parsed.push({
      start: segment.start,
      end: segment.end,
      text: segment.text,
      speaker: typeof segment.speaker === 'string' ? segment.speaker : undefined,
      speakerRole,
    });
  }

  return parsed;
}

function parseSpeakerRole(raw: unknown): SpeakerRole {
  if (raw === 'Provider' || raw === 'Patient' || raw === 'Speaker') {
    return raw;
  }
  throw new AppError(400, 'speakerRole must be one of: Provider, Patient, Speaker');
}

function parseSpeaker(raw: unknown): string {
  if (typeof raw !== 'string' || raw.trim().length === 0) {
    throw new AppError(400, 'speaker is required');
  }
  return raw.trim();
}

function appendCorrection(existing: unknown, correction: SpeakerCorrection) {
  const current = Array.isArray(existing) ? existing : [];
  return [...current, correction];
}

export async function createTranscription(req: Request, res: Response) {
  const providerId = req.provider?.id;
  if (!providerId) {
    throw new AppError(401, 'Unauthorized');
  }

  const { encounterId } = req.body as { encounterId?: string };
  if (!encounterId) {
    throw new AppError(400, 'encounterId is required');
  }

  const encounter = await prisma.encounter.findFirst({
    where: { id: encounterId, providerId },
  });

  if (!encounter) {
    throw new AppError(404, 'Encounter not found');
  }

  if (!encounter.audioFilePath) {
    throw new AppError(400, 'Encounter has no audio file');
  }

  const originalStatus = encounter.status;

  await prisma.encounter.update({
    where: { id: encounter.id },
    data: { status: 'processing' },
  });

  try {
    const transcription = await transcribeAudioFile(encounter.audioFilePath, {
      model: config.transcription.finalModel,
    });

    const assignments = parseAssignments(
      (encounter as { speakerAssignments?: unknown }).speakerAssignments,
    );
    let diarization = null;
    try {
      diarization = await diarizeAudioFile(encounter.audioFilePath);
    } catch (error) {
      console.warn('Diarization unavailable, proceeding with default speaker assignment', {
        encounterId: encounter.id,
        error: error instanceof Error ? error.message : String(error),
      });
    }
    const segments = diarization
      ? annotateTranscriptWithSpeakers(transcription.segments, diarization.segments, assignments)
      : transcription.segments.map((segment) => ({
          ...segment,
          speaker: assignments.providerSpeaker,
          speakerRole: 'Provider' as SpeakerRole,
        }));

    const transcriptRecord = await prisma.transcript.create({
      data: {
        encounterId: encounter.id,
        fullText: transcription.full_text,
        segments,
        audioFilePath: encounter.audioFilePath,
      },
    });

    await prisma.encounter.update({
      where: { id: encounter.id },
      data: { status: 'draft' },
    });

    res.status(201).json({
      transcript: {
        id: transcriptRecord.id,
        encounterId: transcriptRecord.encounterId,
        fullText: transcriptRecord.fullText,
        segments: transcriptRecord.segments,
        audioFilePath: transcriptRecord.audioFilePath,
        createdAt: transcriptRecord.createdAt,
      },
    });
  } catch (error) {
    await prisma.encounter.update({
      where: { id: encounter.id },
      data: { status: originalStatus },
    });
    throw error;
  }
}

export async function asrHealth(_req: Request, res: Response) {
  const health = await checkAsrHealth();
  res.status(200).json(health);
}

export async function patchTranscriptSegmentSpeaker(req: Request, res: Response) {
  const providerId = req.provider?.id;
  if (!providerId) {
    throw new AppError(401, 'Unauthorized');
  }

  const transcriptIdParam = req.params.id;
  const transcriptId = Array.isArray(transcriptIdParam) ? transcriptIdParam[0] : transcriptIdParam;
  const segmentIndexParam = req.params.segmentIndex;
  const segmentIndexValue = Array.isArray(segmentIndexParam)
    ? segmentIndexParam[0]
    : segmentIndexParam;
  const segmentIndex = Number.parseInt(segmentIndexValue || '', 10);
  if (!transcriptId) {
    throw new AppError(400, 'Transcript id is required');
  }
  if (!Number.isInteger(segmentIndex) || segmentIndex < 0) {
    throw new AppError(400, 'segmentIndex must be a non-negative integer');
  }

  const speaker = parseSpeaker((req.body as { speaker?: unknown }).speaker);
  const speakerRole = parseSpeakerRole((req.body as { speakerRole?: unknown }).speakerRole);

  const transcript = await prisma.transcript.findFirst({
    where: {
      id: transcriptId,
      encounter: {
        providerId,
      },
    },
  });

  if (!transcript) {
    throw new AppError(404, 'Transcript not found');
  }

  const segments = parseSegments(transcript.segments);
  if (segmentIndex >= segments.length) {
    throw new AppError(400, 'segmentIndex out of range');
  }

  segments[segmentIndex] = {
    ...segments[segmentIndex],
    speaker,
    speakerRole,
  };

  const correction: SpeakerCorrection = {
    type: 'single',
    transcriptId,
    segmentIndex,
    toSpeaker: speaker,
    toRole: speakerRole,
    correctedAt: new Date().toISOString(),
    correctedBy: providerId,
  };

  const updated = await prisma.transcript.update({
    where: { id: transcript.id },
    data: {
      segments,
      speakerCorrections: appendCorrection(
        (transcript as { speakerCorrections?: unknown }).speakerCorrections,
        correction,
      ),
    },
  });

  res.status(200).json({
    transcript: {
      id: updated.id,
      segments: updated.segments,
      speakerCorrections: (updated as { speakerCorrections?: unknown }).speakerCorrections,
    },
  });
}

export async function bulkReassignTranscriptSpeaker(req: Request, res: Response) {
  const providerId = req.provider?.id;
  if (!providerId) {
    throw new AppError(401, 'Unauthorized');
  }

  const transcriptIdParam = req.params.id;
  const transcriptId = Array.isArray(transcriptIdParam) ? transcriptIdParam[0] : transcriptIdParam;
  if (!transcriptId) {
    throw new AppError(400, 'Transcript id is required');
  }

  const body = req.body as { fromSpeaker?: unknown; toSpeaker?: unknown; toRole?: unknown };
  const fromSpeaker = parseSpeaker(body.fromSpeaker);
  const toSpeaker = parseSpeaker(body.toSpeaker);
  const toRole = parseSpeakerRole(body.toRole);

  const transcript = await prisma.transcript.findFirst({
    where: {
      id: transcriptId,
      encounter: {
        providerId,
      },
    },
  });

  if (!transcript) {
    throw new AppError(404, 'Transcript not found');
  }

  const segments = parseSegments(transcript.segments);
  let updatedCount = 0;
  const nextSegments = segments.map((segment) => {
    if (segment.speaker !== fromSpeaker) return segment;
    updatedCount += 1;
    return {
      ...segment,
      speaker: toSpeaker,
      speakerRole: toRole,
    };
  });

  const correction: SpeakerCorrection = {
    type: 'bulk',
    transcriptId,
    fromSpeaker,
    toSpeaker,
    toRole,
    correctedAt: new Date().toISOString(),
    correctedBy: providerId,
  };

  const updated = await prisma.transcript.update({
    where: { id: transcript.id },
    data: {
      segments: nextSegments,
      speakerCorrections: appendCorrection(
        (transcript as { speakerCorrections?: unknown }).speakerCorrections,
        correction,
      ),
    },
  });

  res.status(200).json({
    transcript: {
      id: updated.id,
      segments: updated.segments,
      speakerCorrections: (updated as { speakerCorrections?: unknown }).speakerCorrections,
    },
    updatedCount,
  });
}
