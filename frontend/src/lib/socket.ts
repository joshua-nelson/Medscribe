import { io } from 'socket.io-client';
import { getSocketUrl } from '@/core/config/env';
import { getAccessToken } from '@/lib/api';

const SOCKET_URL = getSocketUrl();

export function createSocket(token?: string | null) {
  const accessToken = token ?? getAccessToken();
  return io(SOCKET_URL, {
    auth: accessToken ? { token: accessToken } : undefined,
    transports: ['websocket'],
  });
}
