import 'express-async-errors';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import healthRouter from './routes/health';
import authRouter from './routes/auth';
import { requestLogger } from './middleware/requestLogger';
import { errorHandler } from './middleware/errorHandler';
import { config } from './config';

const app = express();

// Security middleware
app.use(helmet());
app.use(cors({
  origin: config.frontend.url,
  credentials: true,
}));

// Body parsing
app.use(express.json());
app.use(cookieParser());

// Request logging (HIPAA-safe)
app.use(requestLogger);

// Routes
app.use('/api', healthRouter);
app.use('/api/auth', authRouter);

// Error handling (must be last)
app.use(errorHandler);

export default app;
