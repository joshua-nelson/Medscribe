import 'express-async-errors';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import healthRouter from './routes/health';
import authRouter from './routes/auth';
import transcriptionRouter from './routes/transcriptions';
import encounterRouter from './routes/encounters';
import auditRouter from './routes/audit';
import { requestLogger } from './middleware/requestLogger';
import { errorHandler } from './middleware/errorHandler';
import { apiRateLimiter } from './middleware/rateLimiter';
import { config } from './config';

const app = express();

// Trust proxy for proper IP handling behind Nginx reverse proxy
// This enables req.ip to work correctly for rate limiting and audit logging
app.set('trust proxy', 1);

// Security middleware
app.use(helmet());
app.use(
  cors({
    origin: config.frontend.url,
    credentials: true,
  }),
);

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

// API rate limiting (DoS protection)
app.use('/api', apiRateLimiter);

// Routes
app.use('/api', healthRouter);
app.use('/api/auth', authRouter);
app.use('/api/transcriptions', transcriptionRouter);
app.use('/api/encounters', encounterRouter);
app.use('/api/audit', auditRouter);

// Error handling (must be last)
app.use(errorHandler);

export default app;
