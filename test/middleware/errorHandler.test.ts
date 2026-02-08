import test from 'node:test';
import assert from 'node:assert/strict';
import { createMockResponse } from '../helpers/httpMocks';

const { AppError, errorHandler } = require('../../src/middleware/errorHandler.ts') as {
  AppError: new (statusCode: number, message: string) => Error & { statusCode: number };
  errorHandler: (
    err: Error,
    req: unknown,
    res: ReturnType<typeof createMockResponse>,
    next: (...args: unknown[]) => void,
  ) => unknown;
};

test('errorHandler formats AppError status and message', () => {
  const res = createMockResponse();
  errorHandler(new AppError(404, 'Not found'), {}, res, () => undefined);

  assert.equal(res.statusCode, 404);
  assert.deepEqual(res.body, { error: 'Not found' });
});

test('errorHandler hides unexpected error details', () => {
  const res = createMockResponse();
  const originalConsoleError = console.error;
  const logs: unknown[][] = [];
  console.error = (...args: unknown[]) => {
    logs.push(args);
  };

  try {
    errorHandler(new Error('db crashed'), {}, res, () => undefined);

    assert.equal(res.statusCode, 500);
    assert.deepEqual(res.body, { error: 'Internal server error' });
    assert.equal(logs.length, 1);
  } finally {
    console.error = originalConsoleError;
  }
});
