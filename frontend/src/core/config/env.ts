const DEFAULT_API_URL = '/api';

function isLocalHttp(url: URL) {
  return (
    url.protocol === 'http:' &&
    (url.hostname === 'localhost' ||
      url.hostname === '127.0.0.1' ||
      url.hostname === '0.0.0.0' ||
      url.hostname.endsWith('.local'))
  );
}

function normalizeApiUrl(rawUrl?: string): string {
  const value = (rawUrl || DEFAULT_API_URL).trim();

  if (value.startsWith('//')) {
    throw new Error('NEXT_PUBLIC_API_URL must be an absolute URL or a root-relative path.');
  }

  if (value.startsWith('/')) {
    return value.replace(/\/$/, '') || '/';
  }

  const parsed = new URL(value);

  if (parsed.protocol === 'http:' && !isLocalHttp(parsed)) {
    throw new Error('NEXT_PUBLIC_API_URL must use HTTPS outside local development.');
  }

  return parsed.toString().replace(/\/$/, '');
}

export const API_URL = normalizeApiUrl(process.env.NEXT_PUBLIC_API_URL);

export function getSocketUrl(): string {
  const configuredSocketUrl = process.env.NEXT_PUBLIC_SOCKET_URL;
  if (configuredSocketUrl) {
    return normalizeApiUrl(configuredSocketUrl).replace(/\/api$/, '');
  }

  if (API_URL.startsWith('/')) {
    return '';
  }

  return API_URL.replace(/\/api$/, '');
}
