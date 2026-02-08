import api, { setAccessToken } from '@/lib/api';
import { AuthResponse } from '@/types';

export type AuthResult = {
  accessToken: string;
  user: Omit<AuthResponse, 'accessToken'>;
};

function normalizeAuthResponse(response: AuthResponse): AuthResult {
  const { accessToken, ...user } = response;
  return {
    accessToken,
    user,
  };
}

export async function loginWithPassword(email: string, password: string): Promise<AuthResult> {
  const response = await api.post<AuthResponse>('/auth/login', { email, password });
  return normalizeAuthResponse(response.data);
}

export async function refreshAuth(): Promise<AuthResult> {
  const response = await api.post<AuthResponse>('/auth/refresh');
  return normalizeAuthResponse(response.data);
}

export async function logoutSession(): Promise<void> {
  await api.post('/auth/logout');
}

export function clearInMemoryToken() {
  setAccessToken(null);
}

export function setInMemoryToken(token: string | null) {
  setAccessToken(token);
}
