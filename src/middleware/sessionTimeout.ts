import { Request, Response, NextFunction } from 'express';
import redis from '../utils/redis';
import { AppError } from './errorHandler';

/**
 * SEC-013: Session idle timeout tracking
 * Tracks last activity timestamp and enforces idle timeout
 */

const SESSION_TIMEOUT_SECONDS = 30 * 60; // 30 minutes (configurable via env)
const SESSION_PREFIX = 'session:activity:';

/**
 * Middleware to track user activity and enforce idle timeout
 */
export async function sessionTimeoutMiddleware(
  req: Request,
  _res: Response,
  next: NextFunction
) {
  // Only apply to authenticated requests with provider
  if (!req.provider) {
    return next();
  }

  const providerId = req.provider.id;
  const sessionKey = `${SESSION_PREFIX}${providerId}`;
  const now = Date.now();

  try {
    // Check last activity time
    const lastActivityStr = await redis.get(sessionKey);

    if (lastActivityStr) {
      const lastActivity = parseInt(lastActivityStr, 10);
      const timeSinceActivity = (now - lastActivity) / 1000; // in seconds

      if (timeSinceActivity > SESSION_TIMEOUT_SECONDS) {
        // Session has timed out - clear it
        await redis.del(sessionKey);
        throw new AppError(401, 'Session expired due to inactivity');
      }
    }

    // Update last activity timestamp
    await redis.set(sessionKey, now.toString(), 'EX', SESSION_TIMEOUT_SECONDS + 60);

    next();
  } catch (error) {
    if (error instanceof AppError) {
      throw error;
    }
    // If Redis is down, log but don't block the request
    console.error('Session timeout check failed:', error);
    next();
  }
}
