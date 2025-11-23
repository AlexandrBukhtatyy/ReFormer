/**
 * Unit tests for FieldNode async validator error handling
 *
 * Tests that validators that throw exceptions are handled gracefully
 */

import { describe, it, expect, vi } from 'vitest';
import { FieldNode } from '../../../src/core/nodes/field-node';
import type { AsyncValidatorFn } from '../../../src/core/types';
import { ComponentInstance } from '../../test-utils/types';

describe('FieldNode - Async Validator Error Handling', () => {
  describe('Single validator throws error', () => {
    it('should catch error and return validator_error', async () => {
      const throwingValidator: AsyncValidatorFn<string> = async () => {
        throw new Error('Network timeout');
      };

      const field = new FieldNode({
        value: 'test',
        component: null as ComponentInstance,
        asyncValidators: [throwingValidator],
      });

      await field.validate();

      expect(field.valid.value).toBe(false);
      expect(field.errors.value).toHaveLength(1);
      expect(field.errors.value[0].code).toBe('validator_error');
      expect(field.errors.value[0].message).toBe('Network timeout');
    });

    it('should handle non-Error exceptions', async () => {
      const throwingValidator: AsyncValidatorFn<string> = async () => {
        throw 'String error';
      };

      const field = new FieldNode({
        value: 'test',
        component: null as ComponentInstance,
        asyncValidators: [throwingValidator],
      });

      await field.validate();

      expect(field.valid.value).toBe(false);
      expect(field.errors.value).toHaveLength(1);
      expect(field.errors.value[0].code).toBe('validator_error');
      expect(field.errors.value[0].message).toBe('String error');
    });

    it('should log error in dev mode', async () => {
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      const throwingValidator: AsyncValidatorFn<string> = async () => {
        throw new Error('Test error');
      };

      const field = new FieldNode({
        value: 'test',
        component: null as ComponentInstance,
        asyncValidators: [throwingValidator],
      });

      await field.validate();

      // В dev mode console.error должен быть вызван
      if (import.meta.env.DEV) {
        expect(consoleErrorSpy).toHaveBeenCalledWith(
          '[FieldNode AsyncValidator]',
          expect.any(Error)
        );
      }

      consoleErrorSpy.mockRestore();
    });
  });

  describe('Multiple validators, one throws error', () => {
    it('should continue validation when one validator throws', async () => {
      const throwingValidator: AsyncValidatorFn<string> = async () => {
        throw new Error('Validator 1 failed');
      };

      const workingValidator: AsyncValidatorFn<string> = async (value) => {
        return value.length < 3 ? { code: 'minLength', message: 'Too short' } : null;
      };

      const field = new FieldNode({
        value: 'ab',
        component: null as ComponentInstance,
        asyncValidators: [throwingValidator, workingValidator],
      });

      await field.validate();

      expect(field.valid.value).toBe(false);
      expect(field.errors.value).toHaveLength(2);

      // Ошибка от throwingValidator
      expect(field.errors.value[0].code).toBe('validator_error');
      expect(field.errors.value[0].message).toBe('Validator 1 failed');

      // Ошибка от workingValidator
      expect(field.errors.value[1].code).toBe('minLength');
      expect(field.errors.value[1].message).toBe('Too short');
    });

    it('should return valid if only throwing validator and value is actually valid', async () => {
      const throwingValidator: AsyncValidatorFn<string> = async () => {
        throw new Error('Network error');
      };

      const workingValidator: AsyncValidatorFn<string> = async (value) => {
        // Валидатор проходит
        return value.length >= 3 ? null : { code: 'minLength', message: 'Too short' };
      };

      const field = new FieldNode({
        value: 'valid',
        component: null as ComponentInstance,
        asyncValidators: [throwingValidator, workingValidator],
      });

      await field.validate();

      // Поле невалидно из-за validator_error
      expect(field.valid.value).toBe(false);
      expect(field.errors.value).toHaveLength(1);
      expect(field.errors.value[0].code).toBe('validator_error');
    });

    it('should handle multiple validators throwing', async () => {
      const throwingValidator1: AsyncValidatorFn<string> = async () => {
        throw new Error('Error 1');
      };

      const throwingValidator2: AsyncValidatorFn<string> = async () => {
        throw new Error('Error 2');
      };

      const field = new FieldNode({
        value: 'test',
        component: null as ComponentInstance,
        asyncValidators: [throwingValidator1, throwingValidator2],
      });

      await field.validate();

      expect(field.valid.value).toBe(false);
      expect(field.errors.value).toHaveLength(2);
      expect(field.errors.value[0].code).toBe('validator_error');
      expect(field.errors.value[1].code).toBe('validator_error');
    });
  });

  describe('Real-world error scenarios', () => {
    it('should handle network timeout', async () => {
      const networkValidator: AsyncValidatorFn<string> = async () => {
        // Симуляция network timeout
        throw new Error('Request timeout after 5000ms');
      };

      const field = new FieldNode({
        value: 'test@example.com',
        component: null as ComponentInstance,
        asyncValidators: [networkValidator],
      });

      await field.validate();

      expect(field.valid.value).toBe(false);
      expect(field.errors.value[0].code).toBe('validator_error');
      expect(field.errors.value[0].message).toContain('timeout');
    });

    it('should handle malformed API response', async () => {
      const apiValidator: AsyncValidatorFn<string> = async () => {
        // Симуляция malformed response
        const response: unknown = null;
        // Попытка доступа к null приводит к ошибке
        return response.data.isValid ? null : { code: 'invalid', message: 'Invalid' };
      };

      const field = new FieldNode({
        value: 'test',
        component: null as ComponentInstance,
        asyncValidators: [apiValidator],
      });

      await field.validate();

      expect(field.valid.value).toBe(false);
      expect(field.errors.value[0].code).toBe('validator_error');
    });

    it('should handle rejected promise', async () => {
      const rejectingValidator: AsyncValidatorFn<string> = async () => {
        return Promise.reject(new Error('Promise rejected'));
      };

      const field = new FieldNode({
        value: 'test',
        component: null as ComponentInstance,
        asyncValidators: [rejectingValidator],
      });

      await field.validate();

      expect(field.valid.value).toBe(false);
      expect(field.errors.value[0].code).toBe('validator_error');
      expect(field.errors.value[0].message).toBe('Promise rejected');
    });
  });

  describe('Mixed sync and async validators with errors', () => {
    it('should handle sync validator passing and async throwing', async () => {
      const field = new FieldNode({
        value: 'valid',
        component: null as ComponentInstance,
        validators: [
          (value: string) =>
            value.length < 3 ? { code: 'minLength', message: 'Too short' } : null,
        ],
        asyncValidators: [
          async () => {
            throw new Error('Async error');
          },
        ],
      });

      await field.validate();

      // Sync validator проходит, async бросает ошибку
      expect(field.valid.value).toBe(false);
      expect(field.errors.value).toHaveLength(1);
      expect(field.errors.value[0].code).toBe('validator_error');
    });

    it('should handle sync validator failing before async throws', async () => {
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      const field = new FieldNode({
        value: 'ab',
        component: null as ComponentInstance,
        validators: [
          (value: string) =>
            value.length < 3 ? { code: 'minLength', message: 'Too short' } : null,
        ],
        asyncValidators: [
          async () => {
            throw new Error('This should not run');
          },
        ],
      });

      await field.validate();

      // Sync validator провалился, async не запускается
      expect(field.valid.value).toBe(false);
      expect(field.errors.value).toHaveLength(1);
      expect(field.errors.value[0].code).toBe('minLength');

      // Async validator не вызывается, поэтому console.error не должен вызваться
      expect(consoleErrorSpy).not.toHaveBeenCalled();

      consoleErrorSpy.mockRestore();
    });
  });

  describe('Error handling with debounce', () => {
    it('should handle errors in debounced validation', async () => {
      const throwingValidator: AsyncValidatorFn<string> = async () => {
        throw new Error('Debounced error');
      };

      const field = new FieldNode({
        value: 'test',
        component: null as ComponentInstance,
        asyncValidators: [throwingValidator],
        debounce: 100,
      });

      await field.validate();

      // Ждем debounce
      await new Promise((resolve) => setTimeout(resolve, 150));

      expect(field.valid.value).toBe(false);
      expect(field.errors.value[0].code).toBe('validator_error');
    });

    it('should handle rapid changes with throwing validators', async () => {
      const throwingValidator: AsyncValidatorFn<string> = async () => {
        throw new Error('Error');
      };

      const field = new FieldNode({
        value: '',
        component: null as ComponentInstance,
        asyncValidators: [throwingValidator],
        updateOn: 'change',
        debounce: 100,
      });

      // Быстрые изменения
      field.setValue('a');
      field.setValue('ab');
      field.setValue('abc');

      // Ждем debounce
      await new Promise((resolve) => setTimeout(resolve, 150));

      expect(field.valid.value).toBe(false);
      expect(field.errors.value[0].code).toBe('validator_error');
    });
  });

  describe('Edge cases', () => {
    it('should handle validator that throws undefined', async () => {
      const throwingValidator: AsyncValidatorFn<string> = async () => {
        throw undefined;
      };

      const field = new FieldNode({
        value: 'test',
        component: null as ComponentInstance,
        asyncValidators: [throwingValidator],
      });

      await field.validate();

      expect(field.valid.value).toBe(false);
      expect(field.errors.value[0].code).toBe('validator_error');
      expect(field.errors.value[0].message).toBe('undefined');
    });

    it('should handle validator that throws null', async () => {
      const throwingValidator: AsyncValidatorFn<string> = async () => {
        throw null;
      };

      const field = new FieldNode({
        value: 'test',
        component: null as ComponentInstance,
        asyncValidators: [throwingValidator],
      });

      await field.validate();

      expect(field.valid.value).toBe(false);
      expect(field.errors.value[0].code).toBe('validator_error');
    });

    it('should handle validator that throws object', async () => {
      const throwingValidator: AsyncValidatorFn<string> = async () => {
        throw { custom: 'error' };
      };

      const field = new FieldNode({
        value: 'test',
        component: null as ComponentInstance,
        asyncValidators: [throwingValidator],
      });

      await field.validate();

      expect(field.valid.value).toBe(false);
      expect(field.errors.value[0].code).toBe('validator_error');
      expect(field.errors.value[0].message).toBe('[object Object]');
    });
  });
});
