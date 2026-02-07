import test from 'node:test';
import assert from 'node:assert/strict';
import { createEventedResponse, createNextSpy } from '../helpers/httpMocks';

const { requestLogger } = require('../../src/middleware/requestLogger.ts') as {
  requestLogger: (req: { method: string; path: string }, res: ReturnType<typeof createEventedResponse>, next: () => void) => void;
};

test('requestLogger calls next and logs request metadata on response finish', () => {
  const req = { method: 'POST', path: '/api/encounters' };
  const res = createEventedResponse(201);
  const next = createNextSpy();

  const originalConsoleLog = console.log;
  const logs: string[] = [];
  console.log = (...args: unknown[]) => {
    logs.push(args.join(' '));
  };

  try {
    requestLogger(req, res, next.fn as () => void);
    assert.equal(next.calls.length, 1);

    res.emit('finish');

    assert.equal(logs.length, 1);
    assert.match(logs[0], /^POST \/api\/encounters 201 \d+ms$/);
  } finally {
    console.log = originalConsoleLog;
  }
});
