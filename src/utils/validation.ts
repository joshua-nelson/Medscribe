/**
 * SEC-003: Input validation utilities
 * Provides functions to validate and sanitize user inputs
 */

export interface ValidationError {
  field: string;
  message: string;
}

/**
 * Validates email format
 */
export function isValidEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email) && email.length <= 254; // RFC 5321
}

/**
 * Validates password strength
 * SEC-003: Enforce strong password requirements
 */
export function validatePassword(password: string): ValidationError[] {
  const errors: ValidationError[] = [];

  if (password.length < 12) {
    errors.push({ field: 'password', message: 'Password must be at least 12 characters long' });
  }

  if (password.length > 128) {
    errors.push({ field: 'password', message: 'Password must not exceed 128 characters' });
  }

  if (!/[A-Z]/.test(password)) {
    errors.push({ field: 'password', message: 'Password must contain at least one uppercase letter' });
  }

  if (!/[a-z]/.test(password)) {
    errors.push({ field: 'password', message: 'Password must contain at least one lowercase letter' });
  }

  if (!/[0-9]/.test(password)) {
    errors.push({ field: 'password', message: 'Password must contain at least one number' });
  }

  if (!/[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?]/.test(password)) {
    errors.push({ field: 'password', message: 'Password must contain at least one special character' });
  }

  return errors;
}

/**
 * Validates provider name
 */
export function validateName(name: string): ValidationError[] {
  const errors: ValidationError[] = [];

  if (!name || name.trim().length === 0) {
    errors.push({ field: 'name', message: 'Name is required' });
    return errors;
  }

  if (name.length < 2) {
    errors.push({ field: 'name', message: 'Name must be at least 2 characters long' });
  }

  if (name.length > 100) {
    errors.push({ field: 'name', message: 'Name must not exceed 100 characters' });
  }

  // Check for potentially malicious content
  if (/<|>|&lt;|&gt;/.test(name)) {
    errors.push({ field: 'name', message: 'Name contains invalid characters' });
  }

  return errors;
}

/**
 * Sanitizes string input by trimming whitespace
 */
export function sanitizeString(input: string): string {
  return input.trim();
}

/**
 * Validates specialty field
 */
export function validateSpecialty(specialty: string | undefined): ValidationError[] {
  const errors: ValidationError[] = [];

  if (specialty) {
    if (specialty.length > 100) {
      errors.push({ field: 'specialty', message: 'Specialty must not exceed 100 characters' });
    }

    if (/<|>|&lt;|&gt;/.test(specialty)) {
      errors.push({ field: 'specialty', message: 'Specialty contains invalid characters' });
    }
  }

  return errors;
}
