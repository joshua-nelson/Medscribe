import { Request, Response, NextFunction } from 'express';
import { config } from '../config';

export class AppError extends Error {
  constructor(
    public statusCode: number,
    message: string
  ) {
    super(message);
    this.name = 'AppError';
  }
}

export const errorHandler = (
  err: Error,
  _req: Request,
  res: Response,
  _next: NextFunction
) => {
  if (err instanceof AppError) {
    return res.status(err.statusCode).json({ error: err.message });
  }

  // SEC-005: Log unexpected errors but don't expose details to client in production
  if (config.isProduction) {
    console.error('Unhandled error:', err.message);
    // Never expose stack traces or internal error details in production
    return res.status(500).json({ error: 'Internal server error' });
  } else {
    // In development, provide more details for debugging
    console.error('Unhandled error:', err);
    return res.status(500).json({
      error: 'Internal server error',
      message: err.message,
      stack: err.stack,
    });
  }
};
