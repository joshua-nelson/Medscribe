import { EventEmitter } from 'node:events';

type CookieCall = {
  name: string;
  value: unknown;
  options?: unknown;
};

export function createMockResponse() {
  const response = {
    statusCode: 200,
    body: undefined as unknown,
    cookieCalls: [] as CookieCall[],
    clearCookieCalls: [] as CookieCall[],
    status(code: number) {
      this.statusCode = code;
      return this;
    },
    json(payload: unknown) {
      this.body = payload;
      return this;
    },
    cookie(name: string, value: unknown, options?: unknown) {
      this.cookieCalls.push({ name, value, options });
      return this;
    },
    clearCookie(name: string, options?: unknown) {
      this.clearCookieCalls.push({ name, value: undefined, options });
      return this;
    },
  };

  return response as unknown as {
    statusCode: number;
    body: unknown;
    cookieCalls: CookieCall[];
    clearCookieCalls: CookieCall[];
    status: (code: number) => any;
    json: (payload: unknown) => any;
    cookie: (name: string, value: unknown, options?: unknown) => any;
    clearCookie: (name: string, options?: unknown) => any;
  };
}

export function createNextSpy() {
  const calls: unknown[][] = [];
  return {
    calls,
    fn: (...args: unknown[]) => {
      calls.push(args);
    },
  };
}

export function createEventedResponse(statusCode = 200) {
  const emitter = new EventEmitter();
  const response = {
    statusCode,
    on: emitter.on.bind(emitter),
    emit: emitter.emit.bind(emitter),
  };

  return response as unknown as {
    statusCode: number;
    on: (event: string, listener: (...args: unknown[]) => void) => unknown;
    emit: (event: string, ...args: unknown[]) => boolean;
  };
}
