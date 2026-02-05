import rateLimit from 'express-rate-limit';
import { config } from '../config';

/**
 * SEC-002: Rate limiting to prevent brute force attacks
 * 
 * Auth endpoints have stricter limits to protect against:
 * - Credential stuffing attacks
 * - Account enumeration
 * - Password brute forcing
 */

// Strict rate limit for authentication endpoints
export const authRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: config.isProduction ? 5 : 100, // 5 attempts per 15 min in production
  message: { error: 'Too many authentication attempts, please try again later' },
  standardHeaders: true, // Return rate limit info in `RateLimit-*` headers
  legacyHeaders: false, // Disable `X-RateLimit-*` headers
  skipSuccessfulRequests: false, // Count successful requests
  // Store in memory by default (Redis store can be added for distributed systems)
});

// General API rate limit
export const apiRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: config.isProduction ? 100 : 1000, // 100 requests per 15 min in production
  message: { error: 'Too many requests, please try again later' },
  standardHeaders: true,
  legacyHeaders: false,
});
