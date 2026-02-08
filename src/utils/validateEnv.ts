/**
 * Environment variable validation utility
 * Ensures critical security configuration is properly set
 */

interface ValidationResult {
  isValid: boolean;
  errors: string[];
}

/**
 * Validates that JWT secret meets minimum security requirements
 */
export function validateJwtSecret(secret: string): ValidationResult {
  const errors: string[] = [];

  // In production, require a strong secret
  if (process.env.NODE_ENV === 'production') {
    if (secret.length < 32) {
      errors.push('JWT_SECRET must be at least 32 characters in production');
    }
    if (secret.includes('dev-secret') || secret.includes('change-in-production')) {
      errors.push('JWT_SECRET cannot contain default/placeholder values in production');
    }
    if (!/[A-Z]/.test(secret) || !/[a-z]/.test(secret) || !/[0-9]/.test(secret)) {
      errors.push('JWT_SECRET should contain uppercase, lowercase, and numeric characters');
    }
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
}

/**
 * Validates all required environment variables are set and secure
 */
export function validateEnvironment(): void {
  const errors: string[] = [];

  // Check JWT secret
  const jwtSecret = process.env.JWT_SECRET;
  if (!jwtSecret) {
    errors.push('JWT_SECRET environment variable is required');
  } else {
    const jwtValidation = validateJwtSecret(jwtSecret);
    errors.push(...jwtValidation.errors);
  }

  // Check database URL
  if (!process.env.DATABASE_URL) {
    errors.push('DATABASE_URL environment variable is required');
  }

  // Check Redis URL
  if (!process.env.REDIS_URL) {
    errors.push('REDIS_URL environment variable is required');
  }

  // Fail fast if validation errors exist
  if (errors.length > 0) {
    console.error('Environment validation failed:');
    errors.forEach((error) => console.error(`  - ${error}`));
    process.exit(1);
  }

  console.log('Environment validation passed');
}
