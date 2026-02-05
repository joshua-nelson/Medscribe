/**
 * Security Tests: Input Validation (SEC-003)
 * Tests for password strength, email validation, and sanitization
 */

import {
  isValidEmail,
  validatePassword,
  validateName,
  validateSpecialty,
  sanitizeString,
} from '../utils/validation';

describe('SEC-003: Input Validation', () => {
  describe('Email Validation', () => {
    it('should accept valid email addresses', () => {
      expect(isValidEmail('user@example.com')).toBe(true);
      expect(isValidEmail('test.user+tag@example.co.uk')).toBe(true);
      expect(isValidEmail('admin@subdomain.example.org')).toBe(true);
    });

    it('should reject invalid email addresses', () => {
      expect(isValidEmail('')).toBe(false);
      expect(isValidEmail('notanemail')).toBe(false);
      expect(isValidEmail('missing@domain')).toBe(false);
      expect(isValidEmail('@example.com')).toBe(false);
      expect(isValidEmail('user @example.com')).toBe(false);
    });

    it('should reject emails exceeding RFC 5321 length limit', () => {
      const longEmail = 'a'.repeat(250) + '@example.com';
      expect(isValidEmail(longEmail)).toBe(false);
    });
  });

  describe('Password Validation', () => {
    it('should accept strong passwords', () => {
      const errors = validatePassword('MySecureP@ssw0rd123!');
      expect(errors).toHaveLength(0);
    });

    it('should reject passwords that are too short', () => {
      const errors = validatePassword('Short1!');
      expect(errors.length).toBeGreaterThan(0);
      expect(errors.some((e) => e.message.includes('12 characters'))).toBe(true);
    });

    it('should reject passwords without uppercase letters', () => {
      const errors = validatePassword('lowercase123!password');
      expect(errors.some((e) => e.message.includes('uppercase'))).toBe(true);
    });

    it('should reject passwords without lowercase letters', () => {
      const errors = validatePassword('UPPERCASE123!PASSWORD');
      expect(errors.some((e) => e.message.includes('lowercase'))).toBe(true);
    });

    it('should reject passwords without numbers', () => {
      const errors = validatePassword('NoNumbersHere!Password');
      expect(errors.some((e) => e.message.includes('number'))).toBe(true);
    });

    it('should reject passwords without special characters', () => {
      const errors = validatePassword('NoSpecialChar123');
      expect(errors.some((e) => e.message.includes('special character'))).toBe(true);
    });

    it('should reject passwords that are too long', () => {
      const longPassword = 'A1!' + 'a'.repeat(130);
      const errors = validatePassword(longPassword);
      expect(errors.some((e) => e.message.includes('128 characters'))).toBe(true);
    });
  });

  describe('Name Validation', () => {
    it('should accept valid names', () => {
      expect(validateName('John Doe')).toHaveLength(0);
      expect(validateName('Dr. Jane Smith-Wilson')).toHaveLength(0);
    });

    it('should reject empty names', () => {
      const errors = validateName('');
      expect(errors.length).toBeGreaterThan(0);
    });

    it('should reject names that are too short', () => {
      const errors = validateName('A');
      expect(errors.some((e) => e.message.includes('2 characters'))).toBe(true);
    });

    it('should reject names that are too long', () => {
      const longName = 'A'.repeat(101);
      const errors = validateName(longName);
      expect(errors.some((e) => e.message.includes('100 characters'))).toBe(true);
    });

    it('should reject names with HTML-like content', () => {
      const errors = validateName('<script>alert("xss")</script>');
      expect(errors.some((e) => e.message.includes('invalid characters'))).toBe(true);
    });
  });

  describe('Specialty Validation', () => {
    it('should accept valid specialties', () => {
      expect(validateSpecialty('Cardiology')).toHaveLength(0);
      expect(validateSpecialty(undefined)).toHaveLength(0);
    });

    it('should reject specialties that are too long', () => {
      const longSpecialty = 'A'.repeat(101);
      const errors = validateSpecialty(longSpecialty);
      expect(errors.some((e) => e.message.includes('100 characters'))).toBe(true);
    });

    it('should reject specialties with HTML-like content', () => {
      const errors = validateSpecialty('<script>');
      expect(errors.some((e) => e.message.includes('invalid characters'))).toBe(true);
    });
  });

  describe('String Sanitization', () => {
    it('should trim whitespace from strings', () => {
      expect(sanitizeString('  hello  ')).toBe('hello');
      expect(sanitizeString('\n\ttest\n\t')).toBe('test');
    });

    it('should not modify strings without whitespace', () => {
      expect(sanitizeString('test')).toBe('test');
    });
  });
});
