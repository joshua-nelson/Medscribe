/**
 * Shared utilities for audio MIME type handling
 */

/**
 * Returns the appropriate file extension for a given MIME type.
 * Defaults to .webm if the MIME type is unknown or not provided.
 */
export function getExtensionForMime(mimeType?: string): string {
  if (!mimeType) return '.webm';
  if (mimeType.includes('wav')) return '.wav';
  if (mimeType.includes('ogg')) return '.ogg';
  if (mimeType.includes('webm')) return '.webm';
  return '.webm';
}
