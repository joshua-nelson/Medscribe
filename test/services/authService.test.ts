import test from 'node:test';
import assert from 'node:assert/strict';

const jwt = require('jsonwebtoken');
const { config } = require('../../src/config/index.ts');
const redis = require('../../src/utils/redis.ts').default as {
  set: (...args: unknown[]) => Promise<unknown>;
  get: (...args: unknown[]) => Promise<unknown>;
  del: (...args: unknown[]) => Promise<unknown>;
  disconnect: () => void;
};
const authService = require('../../src/services/authService.ts') as {
  hashPassword: (password: string) => Promise<string>;
  verifyPassword: (password: string, hash: string) => Promise<boolean>;
  generateAccessToken: (providerId: string) => string;
  generateRefreshToken: (providerId: string) => Promise<string>;
  verifyAccessToken: (token: string) => { sub: string; type: 'access' } | null;
  verifyRefreshToken: (token: string) => Promise<{ sub: string; type: 'refresh'; jti: string } | null>;
  revokeRefreshToken: (providerId: string) => Promise<void>;
};

const originalRedisSet = redis.set;
const originalRedisGet = redis.get;
const originalRedisDel = redis.del;

test('hashPassword and verifyPassword handle valid and invalid input', async () => {
  const hash = await authService.hashPassword('secret-123');
  assert.notEqual(hash, 'secret-123');
  assert.equal(await authService.verifyPassword('secret-123', hash), true);
  assert.equal(await authService.verifyPassword('wrong', hash), false);
});

test('generateAccessToken and verifyAccessToken round-trip provider ID', () => {
  const token = authService.generateAccessToken('provider-1');
  const payload = authService.verifyAccessToken(token);
  assert.equal(payload?.sub, 'provider-1');
  assert.equal(payload?.type, 'access');
});

test('verifyAccessToken rejects non-access token payload', () => {
  const refreshLikeToken = jwt.sign(
    { sub: 'provider-1', type: 'refresh', jti: 'jti-1' },
    config.jwt.secret,
    { expiresIn: '1h' },
  );
  const payload = authService.verifyAccessToken(refreshLikeToken);
  assert.equal(payload, null);
});

test('generateRefreshToken stores jti in redis', async () => {
  let capturedArgs: unknown[] = [];
  redis.set = async (...args: unknown[]) => {
    capturedArgs = args;
    return 'OK';
  };

  const token = await authService.generateRefreshToken('provider-2');
  const decoded = jwt.verify(token, config.jwt.secret) as { jti: string };

  assert.equal(capturedArgs[0], 'refresh:provider-2');
  assert.equal(capturedArgs[1], decoded.jti);
  assert.equal(capturedArgs[2], 'EX');
  assert.equal(capturedArgs[3], 7 * 24 * 60 * 60);
});

test('verifyRefreshToken validates redis jti match', async () => {
  const token = jwt.sign(
    { sub: 'provider-3', type: 'refresh', jti: 'jti-123' },
    config.jwt.secret,
    { expiresIn: '1h' },
  );

  redis.get = async () => 'jti-123';
  const validPayload = await authService.verifyRefreshToken(token);
  assert.equal(validPayload?.sub, 'provider-3');

  redis.get = async () => 'different-jti';
  const invalidPayload = await authService.verifyRefreshToken(token);
  assert.equal(invalidPayload, null);
});

test('revokeRefreshToken deletes provider token key from redis', async () => {
  let keyDeleted: unknown;
  redis.del = async (key: unknown) => {
    keyDeleted = key;
    return 1;
  };

  await authService.revokeRefreshToken('provider-4');
  assert.equal(keyDeleted, 'refresh:provider-4');
});

test('cleanup auth service stubs', () => {
  redis.set = originalRedisSet;
  redis.get = originalRedisGet;
  redis.del = originalRedisDel;
});

test('cleanup auth service resources', () => {
  redis.disconnect?.();
  assert.ok(true);
});
