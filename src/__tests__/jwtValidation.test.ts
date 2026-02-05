/**
 * Security Tests: JWT Secret Validation (SEC-001)
 * Tests for environment validation and JWT secret strength
 */

import { validateJwtSecret } from '../utils/validateEnv';

describe('SEC-001: JWT Secret Validation', () => {
  const originalEnv = process.env.NODE_ENV;

  afterEach(() => {
    process.env.NODE_ENV = originalEnv;
  });

  describe('Development Environment', () => {
    beforeEach(() => {
      process.env.NODE_ENV = 'development';
    });

    it('should accept weak secrets in development', () => {
      const result = validateJwtSecret('weak');
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should accept short secrets in development', () => {
      const result = validateJwtSecret('short');
      expect(result.isValid).toBe(true);
    });
  });

  describe('Production Environment', () => {
    beforeEach(() => {
      process.env.NODE_ENV = 'production';
    });

    it('should reject secrets shorter than 32 characters', () => {
      const result = validateJwtSecret('short');
      expect(result.isValid).toBe(false);
      expect(result.errors.some((e) => e.includes('32 characters'))).toBe(true);
    });

    it('should reject default/placeholder secrets', () => {
      let result = validateJwtSecret('dev-secret-please-change');
      expect(result.isValid).toBe(false);
      expect(result.errors.some((e) => e.includes('default/placeholder'))).toBe(true);

      result = validateJwtSecret('your-secret-key-change-in-production');
      expect(result.isValid).toBe(false);
      expect(result.errors.some((e) => e.includes('default/placeholder'))).toBe(true);
    });

    it('should reject secrets without complexity', () => {
      const result = validateJwtSecret('a'.repeat(40));
      expect(result.isValid).toBe(false);
      expect(result.errors.some((e) => e.includes('uppercase, lowercase, and numeric'))).toBe(true);
    });

    it('should accept strong secrets in production', () => {
      const result = validateJwtSecret('MySecureJWT123Secret456KeyForProduction');
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });
  });
});
