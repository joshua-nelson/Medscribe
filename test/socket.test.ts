import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'http';

const prisma = {
  encounter: {
    create: async (_args: unknown) => null,
    update: async (_args: unknown) => null,
  },
};
const prismaModulePath = require.resolve('../src/models/prisma.ts');
require.cache[prismaModulePath] = {
  exports: { default: prisma, prisma, __esModule: true },
} as NodeJS.Module;

const { initSocket } = require('../src/socket.ts') as {
  initSocket: (server: http.Server) => { close: () => Promise<void> | void };
};

test('initSocket initializes and can be closed cleanly', async () => {
  const server = http.createServer();
  const io = initSocket(server);

  assert.ok(io);
  await Promise.resolve(io.close());
  await new Promise<void>((resolve) => server.close(() => resolve()));
});

test('cleanup socket resources', async () => {
  const redis = require('../src/utils/redis.ts').default as { disconnect?: () => void };
  redis.disconnect?.();
  assert.ok(true);
});
