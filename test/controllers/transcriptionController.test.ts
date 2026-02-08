import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs/promises';
import os from 'os';
import path from 'path';
import { createMockResponse } from '../helpers/httpMocks';

const prisma = {
  encounter: {
    findFirst: async (_args: unknown) => null as any,
    update: async (_args: unknown) => null as any,
  },
  transcript: {
    create: async (_args: unknown) => null as any,
    findFirst: async (_args: unknown) => null as any,
    update: async (_args: unknown) => null as any,
  },
};
const prismaModulePath = require.resolve('../../src/models/prisma.ts');
require.cache[prismaModulePath] = {
  exports: { default: prisma, prisma, __esModule: true },
} as NodeJS.Module;

const { AppError } = require('../../src/middleware/errorHandler.ts') as {
  AppError: new (statusCode: number, message: string) => Error & { statusCode: number };
};
const controller = require('../../src/controllers/transcriptionController.ts') as {
  createTranscription: (req: any, res: any) => Promise<void>;
  asrHealth: (req: any, res: any) => Promise<void>;
  patchTranscriptSegmentSpeaker: (req: any, res: any) => Promise<void>;
  bulkReassignTranscriptSpeaker: (req: any, res: any) => Promise<void>;
};
const originalFetch = globalThis.fetch;

test('createTranscription requires authenticated provider', async () => {
  const req = { provider: undefined, body: {} };
  const res = createMockResponse();

  await assert.rejects(
    controller.createTranscription(req, res),
    (err: Error & { statusCode?: number }) => err instanceof AppError && err.statusCode === 401,
  );
});

test('createTranscription requires encounterId', async () => {
  const req = { provider: { id: 'provider-1' }, body: {} };
  const res = createMockResponse();

  await assert.rejects(
    controller.createTranscription(req, res),
    (err: Error & { statusCode?: number }) => err instanceof AppError && err.statusCode === 400,
  );
});

test('createTranscription returns 404 when encounter does not exist', async () => {
  prisma.encounter.findFirst = async () => null;
  const req = { provider: { id: 'provider-1' }, body: { encounterId: 'enc-missing' } };
  const res = createMockResponse();

  await assert.rejects(
    controller.createTranscription(req, res),
    (err: Error & { statusCode?: number }) => err instanceof AppError && err.statusCode === 404,
  );
});

test('createTranscription validates encounter has audio file', async () => {
  prisma.encounter.findFirst = async () => ({
    id: 'enc-1',
    providerId: 'provider-1',
    audioFilePath: null,
    speakerAssignments: null,
  });
  const req = { provider: { id: 'provider-1' }, body: { encounterId: 'enc-1' } };
  const res = createMockResponse();

  await assert.rejects(
    controller.createTranscription(req, res),
    (err: Error & { statusCode?: number }) => err instanceof AppError && err.statusCode === 400,
  );
});

test('createTranscription processes encounter and stores transcript', async () => {
  const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'medscribe-transcription-controller-'));
  const audioPath = path.join(tmpDir, 'audio.webm');
  await fs.writeFile(audioPath, Buffer.from('audio'));

  const previousAsrUrl = process.env.ASR_URL;
  process.env.ASR_URL = 'http://asr.local';

  (globalThis as any).fetch = async () => ({
    ok: true,
    async json() {
      return {
        full_text: 'hello world from patient',
        segments: [
          { start: 0, end: 1, text: 'hello world' },
          { start: 1, end: 2, text: 'from patient' },
        ],
      };
    },
  });

  prisma.encounter.findFirst = async () => ({
    id: 'enc-1',
    providerId: 'provider-1',
    audioFilePath: audioPath,
    speakerAssignments: { providerSpeaker: 'SPEAKER_0', patientSpeaker: 'SPEAKER_1' },
  });

  const updates: unknown[] = [];
  prisma.encounter.update = async (args: unknown) => {
    updates.push(args);
    return { id: 'enc-1' };
  };

  let createdTranscriptPayload: any;
  prisma.transcript.create = async (args: any) => {
    createdTranscriptPayload = args;
    return {
      id: 'transcript-1',
      encounterId: 'enc-1',
      fullText: 'hello world from patient',
      segments: args.data.segments,
      audioFilePath: audioPath,
      createdAt: new Date('2026-01-01T00:00:00.000Z'),
    };
  };

  const req = { provider: { id: 'provider-1' }, body: { encounterId: 'enc-1' } };
  const res = createMockResponse();

  try {
    await controller.createTranscription(req, res);
  } finally {
    (globalThis as any).fetch = originalFetch;
    if (previousAsrUrl === undefined) {
      delete process.env.ASR_URL;
    } else {
      process.env.ASR_URL = previousAsrUrl;
    }
    await fs.rm(tmpDir, { recursive: true, force: true });
  }

  assert.equal(res.statusCode, 201);
  assert.equal(updates.length, 2);
  assert.deepEqual((updates[0] as any).data, { status: 'processing' });
  assert.deepEqual((updates[1] as any).data, { status: 'draft' });
  assert.equal((res.body as any).transcript.id, 'transcript-1');
  assert.equal(Array.isArray(createdTranscriptPayload.data.segments), true);
  assert.equal(createdTranscriptPayload.data.segments[0].speaker, 'SPEAKER_0');
});

test('createTranscription restores status on transcription error', async () => {
  const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'medscribe-transcription-controller-'));
  const audioPath = path.join(tmpDir, 'audio.webm');
  await fs.writeFile(audioPath, Buffer.from('audio'));

  const previousAsrUrl = process.env.ASR_URL;
  process.env.ASR_URL = 'http://asr.local';

  (globalThis as any).fetch = async () => ({
    ok: false,
    status: 500,
    statusText: 'Internal Server Error',
  });

  prisma.encounter.findFirst = async () => ({
    id: 'enc-1',
    providerId: 'provider-1',
    status: 'draft',
    audioFilePath: audioPath,
    speakerAssignments: { providerSpeaker: 'SPEAKER_0', patientSpeaker: 'SPEAKER_1' },
  });

  const updates: unknown[] = [];
  prisma.encounter.update = async (args: unknown) => {
    updates.push(args);
    return { id: 'enc-1' };
  };

  const req = { provider: { id: 'provider-1' }, body: { encounterId: 'enc-1' } };
  const res = createMockResponse();

  try {
    await assert.rejects(controller.createTranscription(req, res));
  } finally {
    (globalThis as any).fetch = originalFetch;
    if (previousAsrUrl === undefined) {
      delete process.env.ASR_URL;
    } else {
      process.env.ASR_URL = previousAsrUrl;
    }
    await fs.rm(tmpDir, { recursive: true, force: true });
  }

  assert.equal(updates.length, 2);
  assert.deepEqual((updates[0] as any).data, { status: 'processing' });
  assert.deepEqual((updates[1] as any).data, { status: 'draft' });
});

test('createTranscription restores status on database error', async () => {
  const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'medscribe-transcription-controller-'));
  const audioPath = path.join(tmpDir, 'audio.webm');
  await fs.writeFile(audioPath, Buffer.from('audio'));

  const previousAsrUrl = process.env.ASR_URL;
  process.env.ASR_URL = 'http://asr.local';

  (globalThis as any).fetch = async () => ({
    ok: true,
    async json() {
      return {
        full_text: 'hello world from patient',
        segments: [
          { start: 0, end: 1, text: 'hello world' },
          { start: 1, end: 2, text: 'from patient' },
        ],
      };
    },
  });

  prisma.encounter.findFirst = async () => ({
    id: 'enc-1',
    providerId: 'provider-1',
    status: 'draft',
    audioFilePath: audioPath,
    speakerAssignments: { providerSpeaker: 'SPEAKER_0', patientSpeaker: 'SPEAKER_1' },
  });

  const updates: unknown[] = [];
  prisma.encounter.update = async (args: unknown) => {
    updates.push(args);
    return { id: 'enc-1' };
  };

  prisma.transcript.create = async () => {
    throw new Error('Database error');
  };

  const req = { provider: { id: 'provider-1' }, body: { encounterId: 'enc-1' } };
  const res = createMockResponse();

  try {
    await assert.rejects(
      controller.createTranscription(req, res),
      (err: Error) => err.message === 'Database error',
    );
  } finally {
    (globalThis as any).fetch = originalFetch;
    if (previousAsrUrl === undefined) {
      delete process.env.ASR_URL;
    } else {
      process.env.ASR_URL = previousAsrUrl;
    }
    await fs.rm(tmpDir, { recursive: true, force: true });
  }

  assert.equal(updates.length, 2);
  assert.deepEqual((updates[0] as any).data, { status: 'processing' });
  assert.deepEqual((updates[1] as any).data, { status: 'draft' });
});

test('patchTranscriptSegmentSpeaker updates one segment speaker assignment', async () => {
  prisma.transcript.findFirst = async () => ({
    id: 'transcript-1',
    encounterId: 'enc-1',
    segments: [
      { start: 0, end: 1, text: 'hello', speaker: 'SPEAKER_0', speakerRole: 'Provider' },
      { start: 1, end: 2, text: 'there', speaker: 'SPEAKER_1', speakerRole: 'Patient' },
    ],
    speakerCorrections: [],
  });

  prisma.transcript.update = async (args: any) => ({
    id: 'transcript-1',
    segments: args.data.segments,
    speakerCorrections: args.data.speakerCorrections,
  });

  const req = {
    provider: { id: 'provider-1' },
    params: { id: 'transcript-1', segmentIndex: '1' },
    body: { speaker: 'SPEAKER_0', speakerRole: 'Provider' },
  };
  const res = createMockResponse();

  await controller.patchTranscriptSegmentSpeaker(req, res);

  assert.equal(res.statusCode, 200);
  assert.equal((res.body as any).transcript.segments[1].speaker, 'SPEAKER_0');
  assert.equal((res.body as any).transcript.segments[1].speakerRole, 'Provider');
});

test('bulkReassignTranscriptSpeaker updates all matching speaker segments', async () => {
  prisma.transcript.findFirst = async () => ({
    id: 'transcript-1',
    encounterId: 'enc-1',
    segments: [
      { start: 0, end: 1, text: 'a', speaker: 'SPEAKER_0', speakerRole: 'Provider' },
      { start: 1, end: 2, text: 'b', speaker: 'SPEAKER_0', speakerRole: 'Provider' },
      { start: 2, end: 3, text: 'c', speaker: 'SPEAKER_1', speakerRole: 'Patient' },
    ],
    speakerCorrections: [],
  });

  prisma.transcript.update = async (args: any) => ({
    id: 'transcript-1',
    segments: args.data.segments,
    speakerCorrections: args.data.speakerCorrections,
  });

  const req = {
    provider: { id: 'provider-1' },
    params: { id: 'transcript-1' },
    body: { fromSpeaker: 'SPEAKER_0', toSpeaker: 'SPEAKER_1', toRole: 'Patient' },
  };
  const res = createMockResponse();

  await controller.bulkReassignTranscriptSpeaker(req, res);

  assert.equal(res.statusCode, 200);
  assert.equal((res.body as any).updatedCount, 2);
  assert.equal((res.body as any).transcript.segments[0].speaker, 'SPEAKER_1');
  assert.equal((res.body as any).transcript.segments[1].speakerRole, 'Patient');
});

test('asrHealth returns service health payload', async () => {
  const previousAsrUrl = process.env.ASR_URL;
  process.env.ASR_URL = 'http://asr.local';

  (globalThis as any).fetch = async () => ({
    ok: true,
    async json() {
      return { status: 'ok' };
    },
  });

  const req = {};
  const res = createMockResponse();

  try {
    await controller.asrHealth(req, res);
  } finally {
    (globalThis as any).fetch = originalFetch;
    if (previousAsrUrl === undefined) {
      delete process.env.ASR_URL;
    } else {
      process.env.ASR_URL = previousAsrUrl;
    }
  }

  assert.equal(res.statusCode, 200);
  assert.deepEqual(res.body, { status: 'ok' });
});
