import test from 'node:test';
import assert from 'node:assert/strict';
import { createMockResponse } from '../helpers/httpMocks';

const prisma = {
  encounter: {
    create: async (_args: unknown) => null as any,
    findFirst: async (_args: unknown) => null as any,
    update: async (_args: unknown) => null as any,
    findMany: async (_args: unknown) => [] as any[],
  },
};
const prismaModulePath = require.resolve('../../src/models/prisma.ts');
require.cache[prismaModulePath] = {
  exports: { default: prisma, prisma, __esModule: true },
} as NodeJS.Module;

const { AppError } = require('../../src/middleware/errorHandler.ts') as {
  AppError: new (statusCode: number, message: string) => Error & { statusCode: number };
};
const controller = require('../../src/controllers/encounterController.ts') as {
  createEncounter: (req: any, res: any) => Promise<void>;
  getEncounter: (req: any, res: any) => Promise<void>;
  updateEncounter: (req: any, res: any) => Promise<void>;
  listEncounters: (req: any, res: any) => Promise<void>;
};

test('createEncounter requires authenticated provider', async () => {
  const req = { provider: undefined, body: {} };
  const res = createMockResponse();

  await assert.rejects(
    controller.createEncounter(req, res),
    (err: Error & { statusCode?: number }) => err instanceof AppError && err.statusCode === 401,
  );
});

test('createEncounter validates and normalizes patientName/status', async () => {
  let capturedCreateArgs: any;
  prisma.encounter.create = async (args: unknown) => {
    capturedCreateArgs = args;
    return {
      id: 'enc-1',
      providerId: 'provider-1',
      patientName: 'Jane Doe',
      status: 'draft',
    };
  };

  const req = {
    provider: { id: 'provider-1' },
    body: { patientName: '  Jane Doe  ', status: 'draft' },
  };
  const res = createMockResponse();

  await controller.createEncounter(req, res);

  assert.equal(capturedCreateArgs.data.providerId, 'provider-1');
  assert.equal(capturedCreateArgs.data.patientName, 'Jane Doe');
  assert.equal(capturedCreateArgs.data.status, 'draft');
  assert.equal(res.statusCode, 201);
});

test('getEncounter returns 404 when encounter does not exist', async () => {
  prisma.encounter.findFirst = async () => null;

  const req = { provider: { id: 'provider-1' }, params: { id: 'enc-missing' } };
  const res = createMockResponse();

  await assert.rejects(
    controller.getEncounter(req, res),
    (err: Error & { statusCode?: number }) => err instanceof AppError && err.statusCode === 404,
  );
});

test('updateEncounter requires at least one updatable field', async () => {
  prisma.encounter.findFirst = async () => ({ id: 'enc-1' });

  const req = { provider: { id: 'provider-1' }, params: { id: 'enc-1' }, body: {} };
  const res = createMockResponse();

  await assert.rejects(
    controller.updateEncounter(req, res),
    (err: Error & { statusCode?: number }) => err instanceof AppError && err.statusCode === 400,
  );
});

test('updateEncounter updates requested fields', async () => {
  prisma.encounter.findFirst = async () => ({ id: 'enc-1' });
  let capturedUpdateArgs: any;
  prisma.encounter.update = async (args: unknown) => {
    capturedUpdateArgs = args;
    return {
      id: 'enc-1',
      providerId: 'provider-1',
      patientName: null,
      status: 'finalized',
    };
  };

  const req = {
    provider: { id: 'provider-1' },
    params: { id: 'enc-1' },
    body: { patientName: null, status: 'finalized' },
  };
  const res = createMockResponse();

  await controller.updateEncounter(req, res);

  assert.equal(capturedUpdateArgs.where.id, 'enc-1');
  assert.equal(capturedUpdateArgs.data.patientName, null);
  assert.equal(capturedUpdateArgs.data.status, 'finalized');
  assert.deepEqual(res.body, {
    encounter: {
      id: 'enc-1',
      providerId: 'provider-1',
      patientName: null,
      status: 'finalized',
    },
  });
});

test('listEncounters rejects multi-valued status query', async () => {
  const req = {
    provider: { id: 'provider-1' },
    query: { status: ['draft', 'finalized'] },
  };
  const res = createMockResponse();

  await assert.rejects(
    controller.listEncounters(req, res),
    (err: Error & { statusCode?: number }) => err instanceof AppError && err.statusCode === 400,
  );
});

test('listEncounters applies status filter and returns ordered items', async () => {
  let capturedFindManyArgs: any;
  prisma.encounter.findMany = async (args: unknown) => {
    capturedFindManyArgs = args;
    return [{ id: 'enc-1' }, { id: 'enc-2' }];
  };

  const req = {
    provider: { id: 'provider-1' },
    query: { status: 'draft' },
  };
  const res = createMockResponse();

  await controller.listEncounters(req, res);

  assert.equal(capturedFindManyArgs.where.providerId, 'provider-1');
  assert.equal(capturedFindManyArgs.where.status, 'draft');
  assert.deepEqual(res.body, { encounters: [{ id: 'enc-1' }, { id: 'enc-2' }] });
});
