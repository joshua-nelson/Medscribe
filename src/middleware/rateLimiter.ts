import rateLimit from 'express-rate-limit';
import RedisStore from 'rate-limit-redis';
import redis from '../utils/redis';

/**
 * Rate limiter for authentication endpoints (login/register)
 * Prevents brute force attacks on login/register
 * HIPAA §164.312(d) - Person or entity authentication
 */
export const authRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10, // 10 attempts per window per IP+email combo
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: false,
  store: new RedisStore({
    // @ts-expect-error - rate-limit-redis types are outdated
    sendCommand: async (...args: string[]) => redis.call(args[0], ...args.slice(1)),
  }),
  keyGenerator: (req) => {
    const email = String(req.body?.email ?? '')
      .toLowerCase()
      .trim();
    return `ratelimit:auth:${req.ip}:${email}`;
  },
  handler: (req, res) => {
    res.status(429).json({
      error: 'Too many authentication attempts. Please try again in 15 minutes.',
    });
  },
});

/**
 * Rate limiter for token refresh endpoint
 * Uses IP-based limiting since refresh requests don't contain email
 */
export const refreshRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 20, // Higher limit since refreshes are expected during normal use
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: false,
  store: new RedisStore({
    // @ts-expect-error - rate-limit-redis types are outdated
    sendCommand: async (...args: string[]) => redis.call(args[0], ...args.slice(1)),
  }),
  keyGenerator: (req) => `ratelimit:refresh:${req.ip}`,
  handler: (req, res) => {
    res.status(429).json({
      error: 'Too many token refresh attempts. Please try again in 15 minutes.',
    });
  },
});

/**
 * General API rate limiter
 * Prevents API abuse and DoS attacks
 */
export const apiRateLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 100, // 100 requests per minute
  standardHeaders: true,
  legacyHeaders: false,
  store: new RedisStore({
    // @ts-expect-error - rate-limit-redis types are outdated
    sendCommand: async (...args: string[]) => redis.call(args[0], ...args.slice(1)),
  }),
  keyGenerator: (req) => {
    // Rate limit by authenticated user ID if available, otherwise by IP
    if (req.provider?.id) {
      return `ratelimit:api:user:${req.provider.id}`;
    }
    return `ratelimit:api:ip:${req.ip}`;
  },
  handler: (req, res) => {
    res.status(429).json({
      error: 'Too many requests. Please slow down.',
    });
  },
});

/**
 * Strict rate limiter for sensitive operations
 * Used for password changes, account modifications, etc.
 */
export const strictRateLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 5, // 5 attempts per hour
  standardHeaders: true,
  legacyHeaders: false,
  store: new RedisStore({
    // @ts-expect-error - rate-limit-redis types are outdated
    sendCommand: async (...args: string[]) => redis.call(args[0], ...args.slice(1)),
  }),
  keyGenerator: (req) => `ratelimit:strict:${req.ip}:${req.provider?.id ?? 'anon'}`,
  handler: (req, res) => {
    res.status(429).json({
      error: 'Too many sensitive operations. Please try again later.',
    });
  },
});
