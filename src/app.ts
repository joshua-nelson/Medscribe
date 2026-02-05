import 'express-async-errors';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import healthRouter from './routes/health';
import authRouter from './routes/auth';
import { requestLogger } from './middleware/requestLogger';
import { errorHandler } from './middleware/errorHandler';
import { apiRateLimiter } from './middleware/rateLimiter';
import { sessionTimeoutMiddleware } from './middleware/sessionTimeout';
import { csrfTokenGenerator } from './middleware/csrfProtection';
import { config } from './config';

const app = express();

// SEC-007: Enhanced security headers with strict helmet configuration
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'"], // May need adjustment based on frontend
        imgSrc: ["'self'", 'data:', 'https:'],
        connectSrc: ["'self'"],
        fontSrc: ["'self'"],
        objectSrc: ["'none'"],
        mediaSrc: ["'self'"],
        frameSrc: ["'none'"],
      },
    },
    hsts: {
      maxAge: 31536000, // 1 year
      includeSubDomains: true,
      preload: true,
    },
    frameguard: {
      action: 'deny',
    },
    noSniff: true,
    xssFilter: true,
    referrerPolicy: {
      policy: 'strict-origin-when-cross-origin',
    },
  })
);

app.use(cors({
  origin: config.frontend.url,
  credentials: true,
}));

// SEC-002: Apply rate limiting to all API routes
app.use('/api', apiRateLimiter);

// Body parsing with size limits (SEC-011)
app.use(express.json({ limit: '10mb' }));

// SEC-016: Cookie parser - CSRF protection via:
// 1. JWT Bearer tokens (not vulnerable to CSRF)
// 2. SameSite=Strict on all cookies
// 3. CSRF token generator middleware (defense-in-depth)
// CodeQL alert is false positive - multiple layers of protection in place
app.use(cookieParser());

// Request logging (HIPAA-safe)
app.use(requestLogger);

// SEC-016: CSRF token generation (Note: JWT + SameSite=strict already provides CSRF protection)
// This provides additional defense-in-depth for cookie-based endpoints
app.use(csrfTokenGenerator);

// SEC-013: Session idle timeout tracking
app.use(sessionTimeoutMiddleware);

// Routes
app.use('/api', healthRouter);
app.use('/api/auth', authRouter);

// Error handling (must be last)
app.use(errorHandler);

export default app;
