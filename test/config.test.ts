import test from 'node:test';
import assert from 'node:assert/strict';

const CONFIG_MODULE_PATH = '../src/config/index.ts';

function loadConfigWithEnv(overrides: Record<string, string | undefined>) {
  const snapshot = { ...process.env };

  for (const [key, value] of Object.entries(overrides)) {
    if (value === undefined) {
      delete process.env[key];
    } else {
      process.env[key] = value;
    }
  }

  delete require.cache[require.resolve(CONFIG_MODULE_PATH)];
  const { config } = require(CONFIG_MODULE_PATH) as {
    config: {
      jwt: { secret: string };
      audio: { storagePath: string };
      transcription: {
        mockUpdates: boolean;
        streamBufferMs: number;
        streamBufferMsMin: number;
        streamBufferMsMax: number;
        streamOverlapMs: number;
        streamStabilityMs: number;
        liveModel: string;
        finalModel: string;
        asrQueueMax: number;
        asrMaxInflight: number;
        metricsEnabled: boolean;
      };
      isProduction: boolean;
    };
  };

  for (const key of Object.keys(process.env)) {
    if (!(key in snapshot)) {
      delete process.env[key];
    }
  }
  Object.assign(process.env, snapshot);

  return config;
}

test('config uses default values when env vars are unset', () => {
  const config = loadConfigWithEnv({
    JWT_SECRET: undefined,
    AUDIO_STORAGE_PATH: undefined,
    STREAM_BUFFER_MS: undefined,
    STREAM_BUFFER_MS_MIN: undefined,
    STREAM_BUFFER_MS_MAX: undefined,
    STREAM_OVERLAP_MS: undefined,
    STREAM_STABILITY_MS: undefined,
    WHISPER_MODEL_LIVE: undefined,
    WHISPER_MODEL_FINAL: undefined,
    ASR_QUEUE_MAX: undefined,
    ASR_MAX_INFLIGHT: undefined,
    TRANSCRIPTION_METRICS_ENABLED: undefined,
    NODE_ENV: undefined,
  });

  assert.equal(config.jwt.secret, 'dev-secret-change-in-production');
  assert.equal(config.audio.storagePath, 'storage/audio');
  assert.equal(config.transcription.streamBufferMs, 3000);
  assert.equal(config.transcription.streamBufferMsMin, 1200);
  assert.equal(config.transcription.streamBufferMsMax, 3000);
  assert.equal(config.transcription.streamOverlapMs, 1200);
  assert.equal(config.transcription.streamStabilityMs, 900);
  assert.equal(config.transcription.liveModel, 'base.en');
  assert.equal(config.transcription.finalModel, 'small');
  assert.equal(config.transcription.asrQueueMax, 4);
  assert.equal(config.transcription.asrMaxInflight, 2);
  assert.equal(config.transcription.metricsEnabled, true);
  assert.equal(config.isProduction, false);
});

test('config parses boolean and positive integer env vars', () => {
  const config = loadConfigWithEnv({
    STREAM_BUFFER_MS: '4500',
    STREAM_BUFFER_MS_MIN: '1300',
    STREAM_BUFFER_MS_MAX: '2700',
    STREAM_OVERLAP_MS: '10',
    STREAM_STABILITY_MS: '700',
    WHISPER_MODEL_LIVE: 'tiny.en',
    WHISPER_MODEL_FINAL: 'small.en',
    ASR_QUEUE_MAX: '8',
    ASR_MAX_INFLIGHT: '3',
    TRANSCRIPTION_METRICS_ENABLED: 'off',
    MOCK_TRANSCRIPT_UPDATES: 'true',
    NODE_ENV: 'production',
  });

  assert.equal(config.transcription.streamBufferMs, 4500);
  assert.equal(config.transcription.streamBufferMsMin, 1300);
  assert.equal(config.transcription.streamBufferMsMax, 2700);
  assert.equal(config.transcription.streamOverlapMs, 10);
  assert.equal(config.transcription.streamStabilityMs, 700);
  assert.equal(config.transcription.liveModel, 'tiny.en');
  assert.equal(config.transcription.finalModel, 'small.en');
  assert.equal(config.transcription.asrQueueMax, 8);
  assert.equal(config.transcription.asrMaxInflight, 3);
  assert.equal(config.transcription.metricsEnabled, false);
  assert.equal(config.transcription.mockUpdates, true);
  assert.equal(config.isProduction, true);
});

test('config falls back for invalid numeric or boolean env vars', () => {
  const config = loadConfigWithEnv({
    STREAM_BUFFER_MS: '0',
    STREAM_BUFFER_MS_MIN: '-1',
    STREAM_BUFFER_MS_MAX: '20000',
    STREAM_OVERLAP_MS: '-5',
    STREAM_STABILITY_MS: 'not-a-number',
    ASR_QUEUE_MAX: '0',
    ASR_MAX_INFLIGHT: '-3',
    TRANSCRIPTION_METRICS_ENABLED: 'maybe',
    NODE_ENV: 'development',
  });

  assert.equal(config.transcription.streamBufferMs, 3000);
  assert.equal(config.transcription.streamBufferMsMin, 1200);
  assert.equal(config.transcription.streamBufferMsMax, 10000);
  assert.equal(config.transcription.streamOverlapMs, 1200);
  assert.equal(config.transcription.streamStabilityMs, 900);
  assert.equal(config.transcription.asrQueueMax, 4);
  assert.equal(config.transcription.asrMaxInflight, 2);
  assert.equal(config.transcription.metricsEnabled, true);
});
