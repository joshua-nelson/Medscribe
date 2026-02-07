import { randomUUID } from 'crypto';
import path from 'path';
import fs from 'fs/promises';
import { config } from '../config';

function getExtensionForMime(mimeType?: string) {
  if (!mimeType) return '.webm';
  if (mimeType.includes('wav')) return '.wav';
  if (mimeType.includes('ogg')) return '.ogg';
  if (mimeType.includes('webm')) return '.webm';
  return '.webm';
}

export async function ensureAudioStorageDir() {
  await fs.mkdir(config.audio.storagePath, { recursive: true });
}

export async function saveAudioFile(buffers: Buffer[], mimeType?: string) {
  await ensureAudioStorageDir();
  const extension = getExtensionForMime(mimeType);
  const filename = `session-${Date.now()}-${randomUUID()}${extension}`;
  const filePath = path.join(config.audio.storagePath, filename);
  const data = Buffer.concat(buffers);

  await fs.writeFile(filePath, data);

  return {
    filePath,
    filename,
    bytes: data.length,
  };
}
