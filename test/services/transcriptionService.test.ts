import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs/promises';
import os from 'os';
import path from 'path';

const transcriptionService = require('../../src/services/transcriptionService.ts') as {
  transcribeAudioFile: (audioPath: string, options?: { model?: string }) => Promise<{
    full_text: string;
    segments: Array<{ start: number; end: number; text: string }>;
  }>;
  transcribeAudioChunks: (chunks: Buffer[], mimeType?: string, options?: { model?: string }) => Promise<{
    full_text: string;
    segments: Array<{ start: number; end: number; text: string }>;
  }>;
  checkAsrHealth: () => Promise<{ status: string }>;
};

const originalFetch = globalThis.fetch;

function restoreFetch() {
  (globalThis as any).fetch = originalFetch;
}

function restoreEnvVar(name: string, previousValue: string | undefined) {
  if (previousValue === undefined) {
    delete process.env[name];
  } else {
    process.env[name] = previousValue;
  }
}

test('transcribeAudioFile sends multipart request to /transcribe-file', async () => {
  const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'medscribe-transcribe-file-'));
  const filePath = path.join(tmpDir, 'sample.webm');
  await fs.writeFile(filePath, Buffer.from('abc'));

  const previousAsrUrl = process.env.ASR_URL;
  const previousFallback = process.env.ASR_ENABLE_BASE64_FALLBACK;
  process.env.ASR_URL = 'http://asr.local/';
  process.env.ASR_ENABLE_BASE64_FALLBACK = 'true';

  let calledUrl = '';
  let calledBody: FormData | null = null;

  (globalThis as any).fetch = async (url: string, options: { body?: FormData }) => {
    calledUrl = url;
    calledBody = options.body || null;
    return {
      ok: true,
      async json() {
        return { full_text: 'hello', segments: [{ start: 0, end: 1, text: 'hello' }] };
      },
    };
  };

  try {
    const result = await transcriptionService.transcribeAudioFile(filePath);
    assert.equal(calledUrl, 'http://asr.local/transcribe-file');
    assert.equal(result.full_text, 'hello');
    assert.ok(calledBody instanceof FormData);
    assert.equal(calledBody.get('model'), 'small');

    const uploadedFile = calledBody.get('audio_file') as File;
    assert.equal(uploadedFile.name, 'sample.webm');
    const uploadedBytes = Buffer.from(await uploadedFile.arrayBuffer());
    assert.equal(uploadedBytes.toString(), 'abc');
  } finally {
    restoreFetch();
    restoreEnvVar('ASR_URL', previousAsrUrl);
    restoreEnvVar('ASR_ENABLE_BASE64_FALLBACK', previousFallback);
    await fs.rm(tmpDir, { recursive: true, force: true });
  }
});

test('transcribeAudioFile sends explicit model when provided', async () => {
  const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'medscribe-transcribe-model-'));
  const filePath = path.join(tmpDir, 'sample.webm');
  await fs.writeFile(filePath, Buffer.from('abc'));

  const previousAsrUrl = process.env.ASR_URL;
  process.env.ASR_URL = 'http://asr.local/';

  let calledBody: FormData | null = null;
  (globalThis as any).fetch = async (_url: string, options: { body?: FormData }) => {
    calledBody = options.body || null;
    return {
      ok: true,
      async json() {
        return { full_text: 'ok', segments: [] };
      },
    };
  };

  try {
    await transcriptionService.transcribeAudioFile(filePath, { model: 'small.en' });
    assert.ok(calledBody instanceof FormData);
    assert.equal(calledBody.get('model'), 'small.en');
  } finally {
    restoreFetch();
    restoreEnvVar('ASR_URL', previousAsrUrl);
    await fs.rm(tmpDir, { recursive: true, force: true });
  }
});

test('transcribeAudioFile falls back to base64 endpoint when multipart endpoint is unavailable', async () => {
  const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'medscribe-transcribe-fallback-'));
  const filePath = path.join(tmpDir, 'sample.webm');
  await fs.writeFile(filePath, Buffer.from('abc'));

  const previousAsrUrl = process.env.ASR_URL;
  const previousFallback = process.env.ASR_ENABLE_BASE64_FALLBACK;
  process.env.ASR_URL = 'http://asr.local';
  process.env.ASR_ENABLE_BASE64_FALLBACK = 'true';

  const calls: Array<{ url: string; body?: unknown }> = [];
  (globalThis as any).fetch = async (url: string, options: { body?: unknown }) => {
    calls.push({ url, body: options.body });
    if (url.endsWith('/transcribe-file')) {
      return {
        ok: false,
        status: 404,
        async text() {
          return 'not found';
        },
      };
    }

    return {
      ok: true,
      async json() {
        return { full_text: 'fallback text', segments: [{ start: 0, end: 1, text: 'fallback text' }] };
      },
    };
  };

  try {
    const result = await transcriptionService.transcribeAudioFile(filePath);
    assert.equal(result.full_text, 'fallback text');
    assert.equal(calls.length, 2);
    assert.equal(calls[0].url, 'http://asr.local/transcribe-file');
    assert.equal(calls[1].url, 'http://asr.local/transcribe');

    const fallbackPayload = JSON.parse(calls[1].body as string) as {
      audio_base64: string;
      filename: string;
      model: string;
    };
    assert.equal(fallbackPayload.audio_base64, Buffer.from('abc').toString('base64'));
    assert.equal(fallbackPayload.filename, 'sample.webm');
    assert.equal(fallbackPayload.model, 'small');
  } finally {
    restoreFetch();
    restoreEnvVar('ASR_URL', previousAsrUrl);
    restoreEnvVar('ASR_ENABLE_BASE64_FALLBACK', previousFallback);
    await fs.rm(tmpDir, { recursive: true, force: true });
  }
});

test('transcribeAudioFile does not call base64 fallback when fallback flag is disabled', async () => {
  const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'medscribe-transcribe-no-fallback-'));
  const filePath = path.join(tmpDir, 'sample.webm');
  await fs.writeFile(filePath, Buffer.from('abc'));

  const previousAsrUrl = process.env.ASR_URL;
  const previousFallback = process.env.ASR_ENABLE_BASE64_FALLBACK;
  process.env.ASR_URL = 'http://asr.local';
  process.env.ASR_ENABLE_BASE64_FALLBACK = 'false';

  const calledUrls: string[] = [];
  (globalThis as any).fetch = async (url: string) => {
    calledUrls.push(url);
    return {
      ok: false,
      status: 404,
      async text() {
        return 'not found';
      },
    };
  };

  try {
    await assert.rejects(
      transcriptionService.transcribeAudioFile(filePath),
      /ASR service error: 404 not found/,
    );
    assert.deepEqual(calledUrls, ['http://asr.local/transcribe-file']);
  } finally {
    restoreFetch();
    restoreEnvVar('ASR_URL', previousAsrUrl);
    restoreEnvVar('ASR_ENABLE_BASE64_FALLBACK', previousFallback);
    await fs.rm(tmpDir, { recursive: true, force: true });
  }
});

test('transcribeAudioFile throws if ASR returns non-OK response', async () => {
  const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'medscribe-transcribe-error-'));
  const filePath = path.join(tmpDir, 'sample.webm');
  await fs.writeFile(filePath, Buffer.from('abc'));

  const previousAsrUrl = process.env.ASR_URL;
  process.env.ASR_URL = 'http://asr.local';

  (globalThis as any).fetch = async () => ({
    ok: false,
    status: 503,
    async text() {
      return 'service unavailable';
    },
  });

  try {
    await assert.rejects(
      transcriptionService.transcribeAudioFile(filePath),
      /ASR service error: 503 service unavailable/,
    );
  } finally {
    restoreFetch();
    restoreEnvVar('ASR_URL', previousAsrUrl);
    await fs.rm(tmpDir, { recursive: true, force: true });
  }
});

test('transcribeAudioChunks returns empty result for empty chunk list', async () => {
  const result = await transcriptionService.transcribeAudioChunks([]);
  assert.deepEqual(result, { full_text: '', segments: [] });
});

test('transcribeAudioChunks sends chunk filename extension from mime type', async () => {
  const previousAsrUrl = process.env.ASR_URL;
  process.env.ASR_URL = 'http://asr.local';

  let uploadedFilename = '';
  (globalThis as any).fetch = async (_url: string, options: { body?: FormData }) => {
    const body = options.body as FormData;
    const uploadedFile = body.get('audio_file') as File;
    uploadedFilename = uploadedFile.name;

    return {
      ok: true,
      async json() {
        return { full_text: 'chunk text', segments: [{ start: 0, end: 1, text: 'chunk text' }] };
      },
    };
  };

  try {
    const result = await transcriptionService.transcribeAudioChunks([Buffer.from('x')], 'audio/ogg');
    assert.equal(result.full_text, 'chunk text');
    assert.equal(uploadedFilename.endsWith('.ogg'), true);
  } finally {
    restoreFetch();
    restoreEnvVar('ASR_URL', previousAsrUrl);
  }
});

test('transcribeAudioChunks sends explicit model when provided', async () => {
  const previousAsrUrl = process.env.ASR_URL;
  process.env.ASR_URL = 'http://asr.local';

  let sentModel = '';
  (globalThis as any).fetch = async (_url: string, options: { body?: FormData }) => {
    const body = options.body as FormData;
    sentModel = String(body.get('model') || '');
    return {
      ok: true,
      async json() {
        return { full_text: 'chunk text', segments: [] };
      },
    };
  };

  try {
    await transcriptionService.transcribeAudioChunks([Buffer.from('x')], 'audio/ogg', { model: 'tiny.en' });
    assert.equal(sentModel, 'tiny.en');
  } finally {
    restoreFetch();
    restoreEnvVar('ASR_URL', previousAsrUrl);
  }
});

test('checkAsrHealth returns unconfigured when ASR_URL is missing', async () => {
  const previousAsrUrl = process.env.ASR_URL;
  delete process.env.ASR_URL;

  try {
    const result = await transcriptionService.checkAsrHealth();
    assert.deepEqual(result, { status: 'unconfigured' });
  } finally {
    restoreEnvVar('ASR_URL', previousAsrUrl);
  }
});

test('checkAsrHealth returns ASR status and trims trailing slash', async () => {
  const previousAsrUrl = process.env.ASR_URL;
  process.env.ASR_URL = 'http://asr.local/';

  let calledUrl = '';
  (globalThis as any).fetch = async (url: string) => {
    calledUrl = url;
    return {
      ok: true,
      async json() {
        return { status: 'ok' };
      },
    };
  };

  try {
    const result = await transcriptionService.checkAsrHealth();
    assert.equal(calledUrl, 'http://asr.local/health');
    assert.deepEqual(result, { status: 'ok' });
  } finally {
    restoreFetch();
    restoreEnvVar('ASR_URL', previousAsrUrl);
  }
});

test('checkAsrHealth throws on non-OK response', async () => {
  const previousAsrUrl = process.env.ASR_URL;
  process.env.ASR_URL = 'http://asr.local';

  (globalThis as any).fetch = async () => ({
    ok: false,
    status: 500,
    async json() {
      return {};
    },
  });

  try {
    await assert.rejects(transcriptionService.checkAsrHealth(), /ASR health check failed: 500/);
  } finally {
    restoreFetch();
    restoreEnvVar('ASR_URL', previousAsrUrl);
  }
});
