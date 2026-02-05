import { Request, Response, NextFunction } from 'express';
import prisma from '../models/prisma';
import * as authService from '../services/authService';
import { AppError } from './errorHandler';

export async function authMiddleware(req: Request, _res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    throw new AppError(401, 'Authorization header required');
  }

  const token = authHeader.slice(7);
  const payload = authService.verifyAccessToken(token);

  if (!payload) {
    throw new AppError(401, 'Invalid or expired token');
  }

  const provider = await prisma.provider.findUnique({
    where: { id: payload.sub },
    select: { id: true, email: true, name: true, specialty: true, createdAt: true, updatedAt: true },
  });

  if (!provider) {
    throw new AppError(401, 'Provider not found');
  }

  req.provider = provider;
  next();
}
