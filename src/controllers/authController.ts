import { Request, Response } from 'express';
import prisma from '../models/prisma';
import * as authService from '../services/authService';
import { auditFromRequest } from '../services/auditService';
import { AppError } from '../middleware/errorHandler';
import { config } from '../config';

const REFRESH_COOKIE_OPTIONS = {
  httpOnly: true,
  secure: config.isProduction,
  sameSite: 'strict' as const,
  maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
  path: '/api/auth',
};

export async function register(req: Request, res: Response) {
  const { email, password, name, specialty } = req.body;

  if (!email || !password || !name) {
    throw new AppError(400, 'Email, password, and name are required');
  }

  const existing = await prisma.provider.findUnique({ where: { email } });
  if (existing) {
    throw new AppError(409, 'Email already registered');
  }

  const passwordHash = await authService.hashPassword(password);
  const provider = await prisma.provider.create({
    data: { email, passwordHash, name, specialty },
    select: { id: true, email: true, name: true, specialty: true },
  });

  const accessToken = authService.generateAccessToken(provider.id);
  const refreshToken = await authService.generateRefreshToken(provider.id);

  await auditFromRequest(req, 'auth.register', 'provider', provider.id, {
    email: provider.email,
    actorId: provider.id,
  });

  res.cookie('refreshToken', refreshToken, REFRESH_COOKIE_OPTIONS);
  res.status(201).json({ ...provider, accessToken });
}

export async function login(req: Request, res: Response) {
  const { email, password } = req.body;

  if (!email || !password) {
    throw new AppError(400, 'Email and password are required');
  }

  const provider = await prisma.provider.findUnique({ where: { email } });
  if (!provider) {
    throw new AppError(401, 'Invalid credentials');
  }

  const valid = await authService.verifyPassword(password, provider.passwordHash);
  if (!valid) {
    await auditFromRequest(req, 'auth.failed_login', 'provider', provider.id, {
      email,
      reason: 'invalid_password',
      actorId: provider.id,
    });
    throw new AppError(401, 'Invalid credentials');
  }

  const accessToken = authService.generateAccessToken(provider.id);
  const refreshToken = await authService.generateRefreshToken(provider.id);

  await auditFromRequest(req, 'auth.login', 'provider', provider.id, {
    email: provider.email,
    actorId: provider.id,
  });

  res.cookie('refreshToken', refreshToken, REFRESH_COOKIE_OPTIONS);
  res.json({
    id: provider.id,
    email: provider.email,
    name: provider.name,
    specialty: provider.specialty,
    accessToken,
  });
}

export async function logout(req: Request, res: Response) {
  const refreshToken = req.cookies.refreshToken;

  if (refreshToken) {
    const payload = await authService.verifyRefreshToken(refreshToken);
    if (payload) {
      await authService.revokeRefreshToken(payload.sub);
      // HIPAA audit: Log logout
      await auditFromRequest(req, 'auth.logout', 'provider', payload.sub);
    }
  }

  res.clearCookie('refreshToken', { path: '/api/auth' });
  res.json({ success: true });
}

export async function refresh(req: Request, res: Response) {
  const refreshToken = req.cookies.refreshToken;

  if (!refreshToken) {
    throw new AppError(401, 'No refresh token provided');
  }

  const payload = await authService.verifyRefreshToken(refreshToken);
  if (!payload) {
    res.clearCookie('refreshToken', { path: '/api/auth' });
    throw new AppError(401, 'Invalid or expired refresh token');
  }

  const provider = await prisma.provider.findUnique({
    where: { id: payload.sub },
    select: { id: true, email: true, name: true, specialty: true },
  });

  if (!provider) {
    throw new AppError(401, 'Provider not found');
  }

  const accessToken = authService.generateAccessToken(provider.id);
  const newRefreshToken = await authService.generateRefreshToken(provider.id);

  // HIPAA audit: Log token refresh
  await auditFromRequest(req, 'auth.refresh_token', 'provider', provider.id);

  res.cookie('refreshToken', newRefreshToken, REFRESH_COOKIE_OPTIONS);
  res.json({ ...provider, accessToken });
}

export async function me(req: Request, res: Response) {
  res.json(req.provider);
}
