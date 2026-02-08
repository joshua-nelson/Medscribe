import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'http';

const prisma = {
  provider: { findUnique: async (_args: unknown) => null },
  encounter: {
    create: async (_args: unknown) => null,
    update: async (_args: unknown) => null,
    findFirst: async (_args: unknown) => null,
    findMany: async (_args: unknown) => [],
  },
  transcript: { create: async (_args: unknown) => null },
};
const prismaModulePath = require.resolve('../src/models/prisma.ts');
require.cache[prismaModulePath] = {
  exports: { default: prisma, prisma, __esModule: true },
} as NodeJS.Module;

const app = require('../src/app.ts').default as http.RequestListener;

function getJson(url: string): Promise<{ statusCode: number; body: any }> {
  return new Promise((resolve, reject) => {
    const req = http.get(url, (res) => {
      let data = '';
      res.setEncoding('utf8');
      res.on('data', (chunk) => {
        data += chunk;
      });
      res.on('end', () => {
        try {
          resolve({
            statusCode: res.statusCode || 0,
            body: JSON.parse(data),
          });
        } catch (err) {
          reject(err);
        }
      });
    });
    req.on('error', reject);
  });
}

test('GET /api/health returns status payload', async () => {
  const server = http.createServer(app);
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', () => resolve()));

  const address = server.address();
  assert.ok(address && typeof address === 'object');
  const url = `http://127.0.0.1:${address.port}/api/health`;

  try {
    const response = await getJson(url);
    assert.equal(response.statusCode, 200);
    assert.equal(response.body.status, 'ok');
    assert.equal(typeof response.body.timestamp, 'string');
    assert.equal(typeof response.body.uptime, 'number');
  } finally {
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
});

test('cleanup app resources', async () => {
  const redis = require('../src/utils/redis.ts').default as { disconnect?: () => void };
  redis.disconnect?.();
  assert.ok(true);
});
