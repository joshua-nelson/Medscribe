import test from 'node:test';
import assert from 'node:assert/strict';
import { createMockResponse } from '../helpers/httpMocks';

const prisma = {
  provider: {
    findUnique: async (_args: unknown) => null as any,
    create: async (_args: unknown) => null as any,
  },
};
const prismaModulePath = require.resolve('../../src/models/prisma.ts');
require.cache[prismaModulePath] = {
  exports: { default: prisma, prisma, __esModule: true },
} as NodeJS.Module;

const authService = require('../../src/services/authService.ts') as {
  hashPassword: (password: string) => Promise<string>;
  generateAccessToken: (providerId: string) => string;
  generateRefreshToken: (providerId: string) => Promise<string>;
};
const redis = require('../../src/utils/redis.ts').default as {
  set: (...args: unknown[]) => Promise<unknown>;
  get: (key: string) => Promise<string | null>;
  del: (key: string) => Promise<number>;
};
const { AppError } = require('../../src/middleware/errorHandler.ts') as {
  AppError: new (statusCode: number, message: string) => Error & { statusCode: number };
};
const controller = require('../../src/controllers/authController.ts') as {
  register: (req: any, res: any) => Promise<void>;
  login: (req: any, res: any) => Promise<void>;
  logout: (req: any, res: any) => Promise<void>;
  refresh: (req: any, res: any) => Promise<void>;
  me: (req: any, res: any) => Promise<void>;
};

const refreshStore = new Map<string, string>();
redis.set = async (key: unknown, value: unknown) => {
  refreshStore.set(String(key), String(value));
  return 'OK';
};
redis.get = async (key: string) => refreshStore.get(key) ?? null;
redis.del = async (key: string) => (refreshStore.delete(key) ? 1 : 0);

test('register validates required fields', async () => {
  const req = { body: { email: '', password: '', name: '' } };
  const res = createMockResponse();

  await assert.rejects(
    controller.register(req, res),
    (err: Error & { statusCode?: number }) => err instanceof AppError && err.statusCode === 400,
  );
});

test('register rejects duplicate email', async () => {
  prisma.provider.findUnique = async () => ({ id: 'provider-existing' });
  const req = { body: { email: 'existing@example.com', password: 'secret', name: 'Existing' } };
  const res = createMockResponse();

  await assert.rejects(
    controller.register(req, res),
    (err: Error & { statusCode?: number }) => err instanceof AppError && err.statusCode === 409,
  );
});

test('register creates provider and returns access token + refresh cookie', async () => {
  prisma.provider.findUnique = async () => null;
  prisma.provider.create = async () => ({
    id: 'provider-1',
    email: 'doc@example.com',
    name: 'Doctor',
    specialty: 'Cardiology',
  });

  const req = {
    body: { email: 'doc@example.com', password: 'secret', name: 'Doctor', specialty: 'Cardiology' },
  };
  const res = createMockResponse();

  await controller.register(req, res);

  assert.equal(res.statusCode, 201);
  assert.equal(res.cookieCalls.length, 1);
  assert.equal(res.cookieCalls[0].name, 'refreshToken');
  assert.equal(typeof (res.body as any).accessToken, 'string');
  assert.equal((res.body as any).email, 'doc@example.com');
});

test('login rejects unknown provider', async () => {
  prisma.provider.findUnique = async () => null;
  const req = { body: { email: 'missing@example.com', password: 'secret' } };
  const res = createMockResponse();

  await assert.rejects(
    controller.login(req, res),
    (err: Error & { statusCode?: number }) => err instanceof AppError && err.statusCode === 401,
  );
});

test('login rejects invalid password', async () => {
  const passwordHash = await authService.hashPassword('secret');
  prisma.provider.findUnique = async () => ({
    id: 'provider-1',
    email: 'doc@example.com',
    name: 'Doctor',
    specialty: 'Cardiology',
    passwordHash,
  });

  const req = { body: { email: 'doc@example.com', password: 'bad' } };
  const res = createMockResponse();

  await assert.rejects(
    controller.login(req, res),
    (err: Error & { statusCode?: number }) => err instanceof AppError && err.statusCode === 401,
  );
});

test('login returns profile and tokens on success', async () => {
  const passwordHash = await authService.hashPassword('secret');
  prisma.provider.findUnique = async () => ({
    id: 'provider-1',
    email: 'doc@example.com',
    name: 'Doctor',
    specialty: 'Cardiology',
    passwordHash,
  });

  const req = { body: { email: 'doc@example.com', password: 'secret' } };
  const res = createMockResponse();

  await controller.login(req, res);

  assert.equal(res.cookieCalls.length, 1);
  assert.equal(typeof (res.body as any).accessToken, 'string');
  assert.equal((res.body as any).id, 'provider-1');
});

test('logout revokes refresh token when valid token is provided', async () => {
  refreshStore.clear();
  const refreshToken = await authService.generateRefreshToken('provider-1');

  const req = { cookies: { refreshToken } };
  const res = createMockResponse();

  await controller.logout(req, res);

  assert.equal(refreshStore.has('refresh:provider-1'), false);
  assert.equal(res.clearCookieCalls.length, 1);
  assert.deepEqual(res.body, { success: true });
});

test('refresh requires refresh token cookie', async () => {
  const req = { cookies: {} };
  const res = createMockResponse();

  await assert.rejects(
    controller.refresh(req, res),
    (err: Error & { statusCode?: number }) => err instanceof AppError && err.statusCode === 401,
  );
});

test('refresh clears cookie and rejects invalid refresh token', async () => {
  const req = { cookies: { refreshToken: 'bad' } };
  const res = createMockResponse();

  await assert.rejects(
    controller.refresh(req, res),
    (err: Error & { statusCode?: number }) => err instanceof AppError && err.statusCode === 401,
  );

  assert.equal(res.clearCookieCalls.length, 1);
  assert.equal(res.clearCookieCalls[0].name, 'refreshToken');
});

test('refresh returns provider and new tokens', async () => {
  refreshStore.clear();
  const validRefreshToken = await authService.generateRefreshToken('provider-1');
  prisma.provider.findUnique = async () => ({
    id: 'provider-1',
    email: 'doc@example.com',
    name: 'Doctor',
    specialty: 'Cardiology',
  });

  const req = { cookies: { refreshToken: validRefreshToken } };
  const res = createMockResponse();

  await controller.refresh(req, res);

  assert.equal(res.cookieCalls.length, 1);
  assert.equal(typeof (res.body as any).accessToken, 'string');
  assert.equal((res.body as any).id, 'provider-1');
});

test('me returns authenticated provider payload', async () => {
  const req = {
    provider: {
      id: 'provider-1',
      email: 'doc@example.com',
    },
  };
  const res = createMockResponse();

  await controller.me(req, res);
  assert.deepEqual(res.body, req.provider);
});

test('cleanup auth controller resources', async () => {
  redis.disconnect?.();
  assert.ok(true);
});
