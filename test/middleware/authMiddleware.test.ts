import test from 'node:test';
import assert from 'node:assert/strict';
import { createNextSpy } from '../helpers/httpMocks';

const prisma = {
  provider: {
    findUnique: async (_args: unknown) => null as unknown,
  },
};
const prismaModulePath = require.resolve('../../src/models/prisma.ts');
require.cache[prismaModulePath] = {
  exports: { default: prisma, prisma, __esModule: true },
} as NodeJS.Module;

const authService = require('../../src/services/authService.ts') as {
  generateAccessToken: (providerId: string) => string;
  verifyAccessToken: (token: string) => { sub: string; type: 'access' } | null;
};
const { AppError } = require('../../src/middleware/errorHandler.ts') as {
  AppError: new (statusCode: number, message: string) => Error & { statusCode: number };
};
const { authMiddleware } = require('../../src/middleware/authMiddleware.ts') as {
  authMiddleware: (req: any, res: any, next: (...args: unknown[]) => void) => Promise<void>;
};

test('authMiddleware rejects when authorization header is missing', async () => {
  const req = { headers: {} };
  const next = createNextSpy();

  await assert.rejects(
    authMiddleware(req, {}, next.fn),
    (err: Error & { statusCode?: number }) => err instanceof AppError && err.statusCode === 401,
  );
});

test('authMiddleware rejects invalid access token', async () => {
  const req = { headers: { authorization: 'Bearer bad-token' } };
  const next = createNextSpy();

  await assert.rejects(
    authMiddleware(req, {}, next.fn),
    (err: Error & { statusCode?: number }) => err instanceof AppError && err.statusCode === 401,
  );
});

test('authMiddleware rejects when provider is not found', async () => {
  prisma.provider.findUnique = async () => null;
  const token = authService.generateAccessToken('provider-1');

  const req = { headers: { authorization: `Bearer ${token}` } };
  const next = createNextSpy();

  await assert.rejects(
    authMiddleware(req, {}, next.fn),
    (err: Error & { statusCode?: number }) => err instanceof AppError && err.statusCode === 401,
  );
});

test('authMiddleware attaches provider and calls next on success', async () => {
  prisma.provider.findUnique = async () => ({
    id: 'provider-1',
    email: 'doctor@example.com',
    name: 'Doctor',
    specialty: 'Family Medicine',
    createdAt: new Date(),
    updatedAt: new Date(),
  });
  const token = authService.generateAccessToken('provider-1');

  const req: Record<string, unknown> = { headers: { authorization: `Bearer ${token}` } };
  const next = createNextSpy();

  await authMiddleware(req, {}, next.fn);

  assert.equal(next.calls.length, 1);
  assert.equal((req.provider as { id: string }).id, 'provider-1');
});

test('cleanup auth middleware resources', async () => {
  const redis = require('../../src/utils/redis.ts').default as { disconnect?: () => void };
  redis.disconnect?.();
  assert.ok(true);
});
