// SEC-001: Validate JWT secret strength in production
const jwtSecret = process.env.JWT_SECRET || 'dev-secret-change-in-production';
if (process.env.NODE_ENV === 'production') {
  if (jwtSecret.length < 32 || jwtSecret.includes('dev-secret') || jwtSecret.includes('change-in-production')) {
    throw new Error('JWT_SECRET must be set to a strong value (min 32 chars) in production');
  }
}

// SEC-006: Validate frontend URL format
const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3001';
if (process.env.NODE_ENV === 'production' && !frontendUrl.startsWith('https://')) {
  throw new Error('FRONTEND_URL must use HTTPS in production');
}

export const config = {
  jwt: {
    secret: jwtSecret,
    accessExpiry: process.env.JWT_ACCESS_EXPIRY || '30m',
    refreshExpiry: process.env.JWT_REFRESH_EXPIRY || '7d',
  },
  redis: {
    url: process.env.REDIS_URL || 'redis://localhost:6379',
  },
  frontend: {
    url: frontendUrl,
  },
  isProduction: process.env.NODE_ENV === 'production',
};
