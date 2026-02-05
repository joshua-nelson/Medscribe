import { Request, Response, NextFunction } from 'express';
import { randomBytes } from 'crypto';
import { config } from '../config';

/**
 * SEC-016: CSRF Protection
 * 
 * Implements Double Submit Cookie pattern for CSRF protection
 * Combined with SameSite=Strict cookies for defense in depth
 */

const CSRF_TOKEN_LENGTH = 32;
const CSRF_COOKIE_NAME = 'csrf-token';
const CSRF_HEADER_NAME = 'x-csrf-token';

/**
 * Generates a random CSRF token
 */
function generateCsrfToken(): string {
  return randomBytes(CSRF_TOKEN_LENGTH).toString('hex');
}

/**
 * Middleware to generate and set CSRF token cookie
 */
export function csrfTokenGenerator(req: Request, res: Response, next: NextFunction) {
  // Check if CSRF token already exists in cookie
  let token = req.cookies[CSRF_COOKIE_NAME];

  if (!token) {
    // Generate new token
    token = generateCsrfToken();
    
    // Set CSRF token cookie
    res.cookie(CSRF_COOKIE_NAME, token, {
      httpOnly: false, // Must be readable by JavaScript to send in headers
      secure: config.isProduction,
      sameSite: 'strict',
      maxAge: 24 * 60 * 60 * 1000, // 24 hours
      path: '/',
    });
  }

  // Make token available to views/client
  res.locals.csrfToken = token;
  next();
}

/**
 * Middleware to validate CSRF token for state-changing operations
 * Only validates POST, PUT, PATCH, DELETE requests
 */
export function csrfProtection(req: Request, res: Response, next: NextFunction) {
  // Skip validation for safe methods
  if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) {
    return next();
  }

  // Get token from cookie
  const cookieToken = req.cookies[CSRF_COOKIE_NAME];
  
  // Get token from header
  const headerToken = req.headers[CSRF_HEADER_NAME] as string;

  // Validate tokens exist and match
  if (!cookieToken || !headerToken) {
    return res.status(403).json({ error: 'CSRF token missing' });
  }

  if (cookieToken !== headerToken) {
    return res.status(403).json({ error: 'CSRF token validation failed' });
  }

  next();
}

/**
 * Endpoint to get CSRF token
 * Frontend can call this to get the token before making requests
 */
export function getCsrfToken(req: Request, res: Response) {
  const token = req.cookies[CSRF_COOKIE_NAME] || generateCsrfToken();
  
  res.cookie(CSRF_COOKIE_NAME, token, {
    httpOnly: false,
    secure: config.isProduction,
    sameSite: 'strict',
    maxAge: 24 * 60 * 60 * 1000,
    path: '/',
  });

  res.json({ csrfToken: token });
}
