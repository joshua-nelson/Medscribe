import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs/promises';
import os from 'os';
import path from 'path';

const { config } = require('../../src/config/index.ts');
const { ensureAudioStorageDir, saveAudioFile } = require('../../src/services/audioStorage.ts') as {
  ensureAudioStorageDir: () => Promise<void>;
  saveAudioFile: (buffers: Buffer[], mimeType?: string) => Promise<{
    filePath: string;
    filename: string;
    bytes: number;
  }>;
};

test('ensureAudioStorageDir creates the configured directory', async () => {
  const tmpRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'medscribe-audio-test-'));
  const storagePath = path.join(tmpRoot, 'audio');
  const previousPath = config.audio.storagePath;
  config.audio.storagePath = storagePath;

  try {
    await ensureAudioStorageDir();
    const stat = await fs.stat(storagePath);
    assert.equal(stat.isDirectory(), true);
  } finally {
    config.audio.storagePath = previousPath;
    await fs.rm(tmpRoot, { recursive: true, force: true });
  }
});

test('saveAudioFile writes concatenated buffers with expected metadata', async () => {
  const tmpRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'medscribe-audio-save-'));
  const previousPath = config.audio.storagePath;
  config.audio.storagePath = tmpRoot;

  try {
    const result = await saveAudioFile([Buffer.from('abc'), Buffer.from('def')], 'audio/wav');

    assert.equal(result.bytes, 6);
    assert.equal(result.filename.endsWith('.wav'), true);
    assert.equal(result.filePath.startsWith(tmpRoot), true);

    const written = await fs.readFile(result.filePath, 'utf8');
    assert.equal(written, 'abcdef');
  } finally {
    config.audio.storagePath = previousPath;
    await fs.rm(tmpRoot, { recursive: true, force: true });
  }
});

test('saveAudioFile defaults to .webm for unsupported mime type', async () => {
  const tmpRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'medscribe-audio-default-ext-'));
  const previousPath = config.audio.storagePath;
  config.audio.storagePath = tmpRoot;

  try {
    const result = await saveAudioFile([Buffer.from('x')], 'audio/unknown');
    assert.equal(result.filename.endsWith('.webm'), true);
  } finally {
    config.audio.storagePath = previousPath;
    await fs.rm(tmpRoot, { recursive: true, force: true });
  }
});
