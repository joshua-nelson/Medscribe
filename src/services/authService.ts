import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { randomUUID } from 'crypto';
import { config } from '../config';
import redis from '../utils/redis';

const SALT_ROUNDS = 10;
const REFRESH_TOKEN_PREFIX = 'refresh:';

interface AccessTokenPayload {
  sub: string;
  type: 'access';
}

interface RefreshTokenPayload {
  sub: string;
  type: 'refresh';
  jti: string;
}

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, SALT_ROUNDS);
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

export function generateAccessToken(providerId: string): string {
  const payload: AccessTokenPayload = { sub: providerId, type: 'access' };
  return jwt.sign(payload, config.jwt.secret, {
    expiresIn: config.jwt.accessExpiry as jwt.SignOptions['expiresIn'],
  });
}

export async function generateRefreshToken(providerId: string): Promise<string> {
  const jti = randomUUID();
  const payload: RefreshTokenPayload = { sub: providerId, type: 'refresh', jti };
  const token = jwt.sign(payload, config.jwt.secret, {
    expiresIn: config.jwt.refreshExpiry as jwt.SignOptions['expiresIn'],
  });

  // Store in Redis with 7-day TTL
  const ttlSeconds = 7 * 24 * 60 * 60;
  await redis.set(`${REFRESH_TOKEN_PREFIX}${providerId}`, jti, 'EX', ttlSeconds);

  return token;
}

export function verifyAccessToken(token: string): AccessTokenPayload | null {
  try {
    const payload = jwt.verify(token, config.jwt.secret) as AccessTokenPayload;
    if (payload.type !== 'access') return null;
    return payload;
  } catch {
    return null;
  }
}

export async function verifyRefreshToken(token: string): Promise<RefreshTokenPayload | null> {
  try {
    const payload = jwt.verify(token, config.jwt.secret) as RefreshTokenPayload;
    if (payload.type !== 'refresh') return null;

    // Check if jti matches what's stored in Redis
    const storedJti = await redis.get(`${REFRESH_TOKEN_PREFIX}${payload.sub}`);
    if (storedJti !== payload.jti) return null;

    return payload;
  } catch {
    return null;
  }
}

export async function revokeRefreshToken(providerId: string): Promise<void> {
  await redis.del(`${REFRESH_TOKEN_PREFIX}${providerId}`);
}
