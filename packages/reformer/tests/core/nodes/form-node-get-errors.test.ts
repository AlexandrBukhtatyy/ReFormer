/**
 * Unit tests for FormNode.getErrors() method
 *
 * Tests filtering errors by code, message, params, and custom predicate
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { FieldNode } from '../../../src/core/nodes/field-node';
import { GroupNode } from '../../../src/core/nodes/group-node';
import type { ValidationError } from '../../../src/core/types';

describe('FormNode.getErrors()', () => {
  describe('FieldNode', () => {
    let field: FieldNode<string>;

    beforeEach(() => {
      field = new FieldNode({
        value: '',
        component: null as any,
      });
    });

    it('should return all errors when called without options', () => {
      const errors: ValidationError[] = [
        { code: 'required', message: 'Field is required' },
        { code: 'minLength', message: 'Minimum length is 5', params: { minLength: 5 } },
      ];

      field.setErrors(errors);

      const result = field.getErrors();
      expect(result).toEqual(errors);
      expect(result.length).toBe(2);
    });

    it('should return empty array when no errors', () => {
      const result = field.getErrors();
      expect(result).toEqual([]);
    });

    it('should filter by single error code', () => {
      const errors: ValidationError[] = [
        { code: 'required', message: 'Field is required' },
        { code: 'minLength', message: 'Minimum length is 5', params: { minLength: 5 } },
        { code: 'maxLength', message: 'Maximum length is 10', params: { maxLength: 10 } },
      ];

      field.setErrors(errors);

      const result = field.getErrors({ code: 'required' });
      expect(result.length).toBe(1);
      expect(result[0].code).toBe('required');
    });

    it('should filter by multiple error codes', () => {
      const errors: ValidationError[] = [
        { code: 'required', message: 'Field is required' },
        { code: 'minLength', message: 'Minimum length is 5', params: { minLength: 5 } },
        { code: 'maxLength', message: 'Maximum length is 10', params: { maxLength: 10 } },
        { code: 'email', message: 'Invalid email' },
      ];

      field.setErrors(errors);

      const result = field.getErrors({ code: ['minLength', 'maxLength'] });
      expect(result.length).toBe(2);
      expect(result[0].code).toBe('minLength');
      expect(result[1].code).toBe('maxLength');
    });

    it('should filter by message (partial match)', () => {
      const errors: ValidationError[] = [
        { code: 'required', message: 'Email is required' },
        { code: 'minLength', message: 'Password must be at least 8 characters' },
        { code: 'email', message: 'Invalid email format' },
      ];

      field.setErrors(errors);

      const result = field.getErrors({ message: 'email' });
      expect(result.length).toBe(2);
      expect(result[0].code).toBe('required');
      expect(result[1].code).toBe('email');
    });

    it('should filter by params', () => {
      const errors: ValidationError[] = [
        { code: 'minLength', message: 'Too short', params: { minLength: 5 } },
        { code: 'minLength', message: 'Too short', params: { minLength: 8 } },
        { code: 'maxLength', message: 'Too long', params: { maxLength: 20 } },
      ];

      field.setErrors(errors);

      const result = field.getErrors({ params: { minLength: 8 } });
      expect(result.length).toBe(1);
      expect(result[0].params?.minLength).toBe(8);
    });

    it('should filter by multiple params', () => {
      const errors: ValidationError[] = [
        { code: 'custom', message: 'Error 1', params: { min: 5, max: 10, type: 'number' } },
        { code: 'custom', message: 'Error 2', params: { min: 5, max: 20, type: 'number' } },
        { code: 'custom', message: 'Error 3', params: { min: 5, max: 10, type: 'string' } },
      ];

      field.setErrors(errors);

      const result = field.getErrors({ params: { min: 5, max: 10 } });
      expect(result.length).toBe(2);
      expect(result[0].params?.type).toBe('number');
      expect(result[1].params?.type).toBe('string');
    });

    it('should return empty array when params filter does not match', () => {
      const errors: ValidationError[] = [
        { code: 'minLength', message: 'Too short', params: { minLength: 5 } },
      ];

      field.setErrors(errors);

      const result = field.getErrors({ params: { minLength: 10 } });
      expect(result).toEqual([]);
    });

    it('should return empty array when error has no params and filter has params', () => {
      const errors: ValidationError[] = [{ code: 'required', message: 'Field is required' }];

      field.setErrors(errors);

      const result = field.getErrors({ params: { minLength: 5 } });
      expect(result).toEqual([]);
    });

    it('should filter by custom predicate', () => {
      const errors: ValidationError[] = [
        { code: 'custom_error_1', message: 'Custom error 1' },
        { code: 'custom_error_2', message: 'Custom error 2' },
        { code: 'required', message: 'Required' },
      ];

      field.setErrors(errors);

      const result = field.getErrors({
        predicate: (err) => err.code.startsWith('custom_'),
      });

      expect(result.length).toBe(2);
      expect(result[0].code).toBe('custom_error_1');
      expect(result[1].code).toBe('custom_error_2');
    });

    it('should combine multiple filters (AND logic)', () => {
      const errors: ValidationError[] = [
        { code: 'minLength', message: 'Password too short', params: { minLength: 8 } },
        { code: 'minLength', message: 'Username too short', params: { minLength: 5 } },
        { code: 'maxLength', message: 'Password too long', params: { maxLength: 20 } },
      ];

      field.setErrors(errors);

      const result = field.getErrors({
        code: 'minLength',
        message: 'Password',
        params: { minLength: 8 },
      });

      expect(result.length).toBe(1);
      expect(result[0].code).toBe('minLength');
      expect(result[0].message).toBe('Password too short');
      expect(result[0].params?.minLength).toBe(8);
    });

    it('should combine code filter with predicate', () => {
      const errors: ValidationError[] = [
        { code: 'minLength', message: 'Too short', params: { minLength: 5 } },
        { code: 'minLength', message: 'Too short', params: { minLength: 8 } },
        { code: 'maxLength', message: 'Too long', params: { maxLength: 20 } },
      ];

      field.setErrors(errors);

      const result = field.getErrors({
        code: 'minLength',
        predicate: (err) => (err.params?.minLength ?? 0) >= 8,
      });

      expect(result.length).toBe(1);
      expect(result[0].params?.minLength).toBe(8);
    });

    it('should return empty array when no errors match filters', () => {
      const errors: ValidationError[] = [
        { code: 'required', message: 'Field is required' },
        { code: 'email', message: 'Invalid email' },
      ];

      field.setErrors(errors);

      const result = field.getErrors({ code: 'minLength' });
      expect(result).toEqual([]);
    });
  });

  describe('GroupNode', () => {
    let form: GroupNode<{ email: string; password: string }>;

    beforeEach(() => {
      form = new GroupNode({
        email: { value: '', component: null as any },
        password: { value: '', component: null as any },
      });
    });

    it('should return all form-level errors', () => {
      const errors: ValidationError[] = [
        { code: 'passwordMismatch', message: 'Passwords do not match' },
        { code: 'invalidCredentials', message: 'Invalid credentials' },
      ];

      form.setErrors(errors);

      const result = form.getErrors();
      expect(result).toEqual(errors);
      expect(result.length).toBe(2);
    });

    it('should filter form-level errors by code', () => {
      const errors: ValidationError[] = [
        { code: 'passwordMismatch', message: 'Passwords do not match' },
        { code: 'invalidCredentials', message: 'Invalid credentials' },
        { code: 'serverError', message: 'Server error occurred' },
      ];

      form.setErrors(errors);

      const result = form.getErrors({ code: 'passwordMismatch' });
      expect(result.length).toBe(1);
      expect(result[0].code).toBe('passwordMismatch');
    });

    it('should filter by predicate for complex logic', () => {
      const errors: ValidationError[] = [
        { code: 'error1', message: 'Error 1', params: { severity: 'high' } },
        { code: 'error2', message: 'Error 2', params: { severity: 'low' } },
        { code: 'error3', message: 'Error 3', params: { severity: 'high' } },
      ];

      form.setErrors(errors);

      const result = form.getErrors({
        predicate: (err) => err.params?.severity === 'high',
      });

      expect(result.length).toBe(2);
      expect(result[0].params?.severity).toBe('high');
      expect(result[1].params?.severity).toBe('high');
    });
  });

  describe('Edge cases', () => {
    let field: FieldNode<string>;

    beforeEach(() => {
      field = new FieldNode({
        value: '',
        component: null as any,
      });
    });

    it('should handle empty error array', () => {
      field.setErrors([]);
      const result = field.getErrors({ code: 'required' });
      expect(result).toEqual([]);
    });

    it('should handle error with undefined params', () => {
      const errors: ValidationError[] = [
        { code: 'required', message: 'Required', params: undefined },
      ];

      field.setErrors(errors);

      const result = field.getErrors({ params: { minLength: 5 } });
      expect(result).toEqual([]);
    });

    it('should handle error with empty params object', () => {
      const errors: ValidationError[] = [{ code: 'required', message: 'Required', params: {} }];

      field.setErrors(errors);

      const result = field.getErrors({ params: {} });
      expect(result.length).toBe(1);
    });

    it('should handle case-insensitive message filtering', () => {
      const errors: ValidationError[] = [{ code: 'error', message: 'Password is required' }];

      field.setErrors(errors);

      //  Поиск регистронезависимый - оба варианта должны найти ошибку
      const result1 = field.getErrors({ message: 'password' });
      const result2 = field.getErrors({ message: 'Password' });
      const result3 = field.getErrors({ message: 'PASSWORD' });

      expect(result1.length).toBe(1);
      expect(result2.length).toBe(1);
      expect(result3.length).toBe(1);
    });

    it('should handle predicate that throws error gracefully', () => {
      const errors: ValidationError[] = [{ code: 'error', message: 'Error' }];

      field.setErrors(errors);

      expect(() => {
        field.getErrors({
          predicate: (err) => {
            if (err.code === 'error') {
              throw new Error('Predicate error');
            }
            return true;
          },
        });
      }).toThrow('Predicate error');
    });
  });

  describe('Real-world scenarios', () => {
    let form: GroupNode<{
      email: string;
      password: string;
      confirmPassword: string;
    }>;

    beforeEach(() => {
      form = new GroupNode({
        email: { value: '', component: null as any },
        password: { value: '', component: null as any },
        confirmPassword: { value: '', component: null as any },
      });
    });

    it('should get all validation errors for UI display', () => {
      const errors: ValidationError[] = [
        { code: 'passwordMismatch', message: 'Passwords do not match' },
        { code: 'weakPassword', message: 'Password is too weak' },
      ];

      form.setErrors(errors);

      const allErrors = form.getErrors();
      expect(allErrors.length).toBe(2);
    });

    it('should get only required field errors for summary', () => {
      const errors: ValidationError[] = [
        { code: 'required', message: 'Email is required' },
        { code: 'required', message: 'Password is required' },
        { code: 'email', message: 'Invalid email format' },
      ];

      form.setErrors(errors);

      const requiredErrors = form.getErrors({ code: 'required' });
      expect(requiredErrors.length).toBe(2);
    });

    it('should get errors with specific severity for priority handling', () => {
      const errors: ValidationError[] = [
        { code: 'error1', message: 'Critical error', params: { severity: 'critical' } },
        { code: 'error2', message: 'Warning', params: { severity: 'warning' } },
        { code: 'error3', message: 'Info', params: { severity: 'info' } },
      ];

      form.setErrors(errors);

      const criticalErrors = form.getErrors({
        predicate: (err) => err.params?.severity === 'critical',
      });

      expect(criticalErrors.length).toBe(1);
      expect(criticalErrors[0].message).toBe('Critical error');
    });

    it('should get validation errors vs server errors', () => {
      const errors: ValidationError[] = [
        { code: 'required', message: 'Field required', params: { type: 'validation' } },
        { code: 'serverError', message: 'Server error', params: { type: 'server' } },
        { code: 'minLength', message: 'Too short', params: { type: 'validation', minLength: 5 } },
      ];

      form.setErrors(errors);

      const validationErrors = form.getErrors({
        predicate: (err) => err.params?.type === 'validation',
      });

      const serverErrors = form.getErrors({
        predicate: (err) => err.params?.type === 'server',
      });

      expect(validationErrors.length).toBe(2);
      expect(serverErrors.length).toBe(1);
    });
  });
});
