/**
 * Unit tests for ValidationApplicator
 *
 * Покрывает:
 * - Sync validators (single, multiple)
 * - Async validators
 * - Conditional validation (applyWhen)
 * - Tree validators (cross-field)
 * - Nested field paths
 * - Error handling
 * - Clearing errors
 * - ValidationContext integration
 */

import { describe, it, expect, vi } from 'vitest';
import { ValidationApplicator } from '../../../src/core/validation/validation-applicator';
import { createForm } from '../../../src/core/utils/create-form';
import type {
  FormSchema,
  ValidatorRegistration,
  ContextualValidatorFn,
  ContextualAsyncValidatorFn,
  TreeValidatorFn,
} from '../../../src/core/types';
import { ComponentInstance } from '../../test-utils/types';

// ============================================================================
// Тестовые интерфейсы
// ============================================================================

interface SimpleForm {
  email: string;
  password: string;
  confirmPassword: string;
}

interface NestedForm {
  name: string;
  address: {
    city: string;
    country: string;
  };
}

interface ConditionalForm {
  hasAddress: boolean;
  city: string;
}

// ============================================================================
// Тестовые схемы
// ============================================================================

const createSimpleSchema = (): FormSchema<SimpleForm> => ({
  email: { value: '', component: null as ComponentInstance },
  password: { value: '', component: null as ComponentInstance },
  confirmPassword: { value: '', component: null as ComponentInstance },
});

const createNestedSchema = (): FormSchema<NestedForm> => ({
  name: { value: '', component: null as ComponentInstance },
  address: {
    city: { value: '', component: null as ComponentInstance },
    country: { value: '', component: null as ComponentInstance },
  },
});

const createConditionalSchema = (): FormSchema<ConditionalForm> => ({
  hasAddress: { value: false, component: null as ComponentInstance },
  city: { value: '', component: null as ComponentInstance },
});

// ============================================================================
// Тестовые валидаторы
// ============================================================================

const requiredValidator: ContextualValidatorFn<unknown, string> = (value) => {
  return value === '' || value === null || value === undefined
    ? { code: 'required', message: 'Field is required' }
    : null;
};

const emailValidator: ContextualValidatorFn<unknown, string> = (value) => {
  if (!value) return null;
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(value) ? null : { code: 'email', message: 'Invalid email format' };
};

const minLengthValidator =
  (min: number): ContextualValidatorFn<unknown, string> =>
  (value) => {
    if (!value) return null;
    return value.length < min
      ? { code: 'minLength', message: `Minimum ${min} characters`, params: { min } }
      : null;
  };

const asyncEmailValidator: ContextualAsyncValidatorFn<unknown, string> = async (value) => {
  await new Promise((resolve) => setTimeout(resolve, 10));
  return value === 'taken@test.com' ? { code: 'emailTaken', message: 'Email already taken' } : null;
};

// ============================================================================
// Тесты
// ============================================================================

describe('ValidationApplicator', () => {
  // ==========================================================================
  // 1. Sync Validators
  // ==========================================================================

  describe('Sync Validators', () => {
    it('should apply sync validator and set error', async () => {
      const form = createForm(createSimpleSchema());
      const applicator = new ValidationApplicator(form);

      const validators: ValidatorRegistration[] = [
        {
          fieldPath: 'email',
          type: 'sync',
          validator: requiredValidator,
        },
      ];

      await applicator.apply(validators);

      expect(form.email.errors.value).toHaveLength(1);
      expect(form.email.errors.value[0].code).toBe('required');
    });

    it('should clear errors when sync validator passes', async () => {
      const form = createForm(createSimpleSchema());
      const applicator = new ValidationApplicator(form);

      // First set an error
      form.email.setErrors([{ code: 'old', message: 'Old error' }]);
      expect(form.email.errors.value).toHaveLength(1);

      // Now apply validator that passes
      form.email.setValue('valid@email.com');

      const validators: ValidatorRegistration[] = [
        {
          fieldPath: 'email',
          type: 'sync',
          validator: requiredValidator,
        },
      ];

      await applicator.apply(validators);

      expect(form.email.errors.value).toHaveLength(0);
    });

    it('should apply multiple sync validators to same field', async () => {
      const form = createForm(createSimpleSchema());
      const applicator = new ValidationApplicator(form);

      form.email.setValue('ab'); // short but not empty

      const validators: ValidatorRegistration[] = [
        {
          fieldPath: 'email',
          type: 'sync',
          validator: requiredValidator,
        },
        {
          fieldPath: 'email',
          type: 'sync',
          validator: emailValidator,
        },
        {
          fieldPath: 'email',
          type: 'sync',
          validator: minLengthValidator(5),
        },
      ];

      await applicator.apply(validators);

      // Should have errors from email and minLength validators (not required)
      expect(form.email.errors.value).toHaveLength(2);
      const errorCodes = form.email.errors.value.map((e) => e.code);
      expect(errorCodes).toContain('email');
      expect(errorCodes).toContain('minLength');
    });

    it('should apply validators to different fields', async () => {
      const form = createForm(createSimpleSchema());
      const applicator = new ValidationApplicator(form);

      const validators: ValidatorRegistration[] = [
        {
          fieldPath: 'email',
          type: 'sync',
          validator: requiredValidator,
        },
        {
          fieldPath: 'password',
          type: 'sync',
          validator: requiredValidator,
        },
      ];

      await applicator.apply(validators);

      expect(form.email.errors.value).toHaveLength(1);
      expect(form.password.errors.value).toHaveLength(1);
    });
  });

  // ==========================================================================
  // 2. Async Validators
  // ==========================================================================

  describe('Async Validators', () => {
    it('should apply async validator and set error', async () => {
      const form = createForm(createSimpleSchema());
      const applicator = new ValidationApplicator(form);

      form.email.setValue('taken@test.com');

      const validators: ValidatorRegistration[] = [
        {
          fieldPath: 'email',
          type: 'async',
          validator: asyncEmailValidator,
        },
      ];

      await applicator.apply(validators);

      expect(form.email.errors.value).toHaveLength(1);
      expect(form.email.errors.value[0].code).toBe('emailTaken');
    });

    it('should clear errors when async validator passes', async () => {
      const form = createForm(createSimpleSchema());
      const applicator = new ValidationApplicator(form);

      form.email.setValue('available@test.com');

      const validators: ValidatorRegistration[] = [
        {
          fieldPath: 'email',
          type: 'async',
          validator: asyncEmailValidator,
        },
      ];

      await applicator.apply(validators);

      expect(form.email.errors.value).toHaveLength(0);
    });

    it('should combine sync and async validators', async () => {
      const form = createForm(createSimpleSchema());
      const applicator = new ValidationApplicator(form);

      form.email.setValue('taken@test.com');

      const validators: ValidatorRegistration[] = [
        {
          fieldPath: 'email',
          type: 'sync',
          validator: minLengthValidator(50), // Will fail
        },
        {
          fieldPath: 'email',
          type: 'async',
          validator: asyncEmailValidator, // Will also fail
        },
      ];

      await applicator.apply(validators);

      expect(form.email.errors.value).toHaveLength(2);
      const errorCodes = form.email.errors.value.map((e) => e.code);
      expect(errorCodes).toContain('minLength');
      expect(errorCodes).toContain('emailTaken');
    });
  });

  // ==========================================================================
  // 3. Nested Field Paths
  // ==========================================================================

  describe('Nested Field Paths', () => {
    it('should validate nested field by path', async () => {
      const form = createForm(createNestedSchema());
      const applicator = new ValidationApplicator(form);

      const validators: ValidatorRegistration[] = [
        {
          fieldPath: 'address.city',
          type: 'sync',
          validator: requiredValidator,
        },
      ];

      await applicator.apply(validators);

      expect(form.address.city.errors.value).toHaveLength(1);
      expect(form.address.city.errors.value[0].code).toBe('required');
    });

    it('should validate multiple nested fields', async () => {
      const form = createForm(createNestedSchema());
      const applicator = new ValidationApplicator(form);

      const validators: ValidatorRegistration[] = [
        {
          fieldPath: 'address.city',
          type: 'sync',
          validator: requiredValidator,
        },
        {
          fieldPath: 'address.country',
          type: 'sync',
          validator: requiredValidator,
        },
      ];

      await applicator.apply(validators);

      expect(form.address.city.errors.value).toHaveLength(1);
      expect(form.address.country.errors.value).toHaveLength(1);
    });
  });

  // ==========================================================================
  // 4. Conditional Validators
  // ==========================================================================

  describe('Conditional Validators', () => {
    it('should apply validator when condition is true', async () => {
      const form = createForm(createConditionalSchema());
      const applicator = new ValidationApplicator(form);

      form.hasAddress.setValue(true);

      const validators: ValidatorRegistration[] = [
        {
          fieldPath: 'city',
          type: 'sync',
          validator: requiredValidator,
          condition: {
            fieldPath: 'hasAddress',
            conditionFn: (value) => value === true,
          },
        },
      ];

      await applicator.apply(validators);

      expect(form.city.errors.value).toHaveLength(1);
      expect(form.city.errors.value[0].code).toBe('required');
    });

    it('should skip validator when condition is false', async () => {
      const form = createForm(createConditionalSchema());
      const applicator = new ValidationApplicator(form);

      form.hasAddress.setValue(false);

      const validators: ValidatorRegistration[] = [
        {
          fieldPath: 'city',
          type: 'sync',
          validator: requiredValidator,
          condition: {
            fieldPath: 'hasAddress',
            conditionFn: (value) => value === true,
          },
        },
      ];

      await applicator.apply(validators);

      // When condition is false and no validators are applied, errors should be cleared
      expect(form.city.errors.value).toHaveLength(0);
    });

    it('should apply validator with nested condition field', async () => {
      const form = createForm(createNestedSchema());
      const applicator = new ValidationApplicator(form);

      form.address.country.setValue('USA');

      const validators: ValidatorRegistration[] = [
        {
          fieldPath: 'address.city',
          type: 'sync',
          validator: requiredValidator,
          condition: {
            fieldPath: 'address.country',
            conditionFn: (value) => value === 'USA',
          },
        },
      ];

      await applicator.apply(validators);

      expect(form.address.city.errors.value).toHaveLength(1);
    });
  });

  // ==========================================================================
  // 5. Tree Validators (Cross-field validation)
  // ==========================================================================

  describe('Tree Validators', () => {
    it('should apply tree validator and set error on targetField', async () => {
      const form = createForm(createSimpleSchema());
      const applicator = new ValidationApplicator(form);

      form.password.setValue('password123');
      form.confirmPassword.setValue('different');

      const passwordMatchValidator: TreeValidatorFn<SimpleForm> = (ctx) => {
        const password = ctx.form.password.value.value;
        const confirm = ctx.form.confirmPassword.value.value;
        return password !== confirm
          ? { code: 'passwordMismatch', message: 'Passwords must match' }
          : null;
      };

      const validators: ValidatorRegistration[] = [
        {
          fieldPath: '',
          type: 'tree',
          validator: passwordMatchValidator,
          options: { targetField: 'confirmPassword' },
        },
      ];

      await applicator.apply(validators);

      expect(form.confirmPassword.errors.value).toHaveLength(1);
      expect(form.confirmPassword.errors.value[0].code).toBe('passwordMismatch');
    });

    it('should not set error when tree validator passes', async () => {
      const form = createForm(createSimpleSchema());
      const applicator = new ValidationApplicator(form);

      form.password.setValue('password123');
      form.confirmPassword.setValue('password123');

      const passwordMatchValidator: TreeValidatorFn<SimpleForm> = (ctx) => {
        const password = ctx.form.password.value.value;
        const confirm = ctx.form.confirmPassword.value.value;
        return password !== confirm
          ? { code: 'passwordMismatch', message: 'Passwords must match' }
          : null;
      };

      const validators: ValidatorRegistration[] = [
        {
          fieldPath: '',
          type: 'tree',
          validator: passwordMatchValidator,
          options: { targetField: 'confirmPassword' },
        },
      ];

      await applicator.apply(validators);

      expect(form.confirmPassword.errors.value).toHaveLength(0);
    });

    it('should apply conditional tree validator', async () => {
      const form = createForm(createSimpleSchema());
      const applicator = new ValidationApplicator(form);

      form.password.setValue('password123');
      form.confirmPassword.setValue('different');

      const passwordMatchValidator: TreeValidatorFn<SimpleForm> = (ctx) => {
        const password = ctx.form.password.value.value;
        const confirm = ctx.form.confirmPassword.value.value;
        return password !== confirm
          ? { code: 'passwordMismatch', message: 'Passwords must match' }
          : null;
      };

      const validators: ValidatorRegistration[] = [
        {
          fieldPath: '',
          type: 'tree',
          validator: passwordMatchValidator,
          options: { targetField: 'confirmPassword' },
          condition: {
            fieldPath: 'password',
            conditionFn: (value) => (value as string).length > 0,
          },
        },
      ];

      await applicator.apply(validators);

      expect(form.confirmPassword.errors.value).toHaveLength(1);
    });

    it('should skip tree validator when condition is false', async () => {
      const form = createForm(createSimpleSchema());
      const applicator = new ValidationApplicator(form);

      // password is empty, so condition fails
      form.confirmPassword.setValue('different');

      const passwordMatchValidator: TreeValidatorFn<SimpleForm> = (ctx) => {
        const password = ctx.form.password.value.value;
        const confirm = ctx.form.confirmPassword.value.value;
        return password !== confirm
          ? { code: 'passwordMismatch', message: 'Passwords must match' }
          : null;
      };

      const validators: ValidatorRegistration[] = [
        {
          fieldPath: '',
          type: 'tree',
          validator: passwordMatchValidator,
          options: { targetField: 'confirmPassword' },
          condition: {
            fieldPath: 'password',
            conditionFn: (value) => (value as string).length > 0,
          },
        },
      ];

      await applicator.apply(validators);

      expect(form.confirmPassword.errors.value).toHaveLength(0);
    });

    it('should append tree validator error to existing errors', async () => {
      const form = createForm(createSimpleSchema());
      const applicator = new ValidationApplicator(form);

      form.password.setValue('password123');
      form.confirmPassword.setValue(''); // Empty - will fail required

      // Set existing error on confirmPassword
      form.confirmPassword.setErrors([{ code: 'required', message: 'Field is required' }]);

      const passwordMatchValidator: TreeValidatorFn<SimpleForm> = (ctx) => {
        const password = ctx.form.password.value.value;
        const confirm = ctx.form.confirmPassword.value.value;
        return password !== confirm
          ? { code: 'passwordMismatch', message: 'Passwords must match' }
          : null;
      };

      const validators: ValidatorRegistration[] = [
        {
          fieldPath: '',
          type: 'tree',
          validator: passwordMatchValidator,
          options: { targetField: 'confirmPassword' },
        },
      ];

      await applicator.apply(validators);

      // Should have both existing error and tree validator error
      expect(form.confirmPassword.errors.value).toHaveLength(2);
      const errorCodes = form.confirmPassword.errors.value.map((e) => e.code);
      expect(errorCodes).toContain('required');
      expect(errorCodes).toContain('passwordMismatch');
    });
  });

  // ==========================================================================
  // 6. Error Handling
  // ==========================================================================

  describe('Error Handling', () => {
    it('should handle sync validator throwing error', async () => {
      const form = createForm(createSimpleSchema());
      const applicator = new ValidationApplicator(form);

      const throwingValidator: ContextualValidatorFn<unknown, string> = () => {
        throw new Error('Validator error');
      };

      const validators: ValidatorRegistration[] = [
        {
          fieldPath: 'email',
          type: 'sync',
          validator: throwingValidator,
        },
      ];

      // Should not throw, error is handled internally
      await expect(applicator.apply(validators)).resolves.not.toThrow();
    });

    it('should handle async validator throwing error', async () => {
      const form = createForm(createSimpleSchema());
      const applicator = new ValidationApplicator(form);

      const throwingAsyncValidator: ContextualAsyncValidatorFn<unknown, string> = async () => {
        throw new Error('Async validator error');
      };

      const validators: ValidatorRegistration[] = [
        {
          fieldPath: 'email',
          type: 'async',
          validator: throwingAsyncValidator,
        },
      ];

      // Should not throw, error is handled internally
      await expect(applicator.apply(validators)).resolves.not.toThrow();
    });

    it('should handle tree validator throwing error', async () => {
      const form = createForm(createSimpleSchema());
      const applicator = new ValidationApplicator(form);

      const throwingTreeValidator: TreeValidatorFn<SimpleForm> = () => {
        throw new Error('Tree validator error');
      };

      const validators: ValidatorRegistration[] = [
        {
          fieldPath: '',
          type: 'tree',
          validator: throwingTreeValidator,
          options: { targetField: 'email' },
        },
      ];

      // Should not throw, error is handled internally
      await expect(applicator.apply(validators)).resolves.not.toThrow();
    });
  });

  // ==========================================================================
  // 7. Edge Cases
  // ==========================================================================

  describe('Edge Cases', () => {
    it('should handle empty validators array', async () => {
      const form = createForm(createSimpleSchema());
      const applicator = new ValidationApplicator(form);

      await expect(applicator.apply([])).resolves.not.toThrow();
    });

    it('should handle non-existent field path gracefully', async () => {
      const form = createForm(createSimpleSchema());
      const applicator = new ValidationApplicator(form);

      // Suppress console.warn for this test
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      const validators: ValidatorRegistration[] = [
        {
          fieldPath: 'nonExistentField',
          type: 'sync',
          validator: requiredValidator,
        },
      ];

      // In DEV mode throws an error, in production logs a warning
      // We test that it either throws with expected message or completes
      try {
        await applicator.apply(validators);
      } catch (error) {
        expect((error as Error).message).toContain('not found');
      }

      warnSpy.mockRestore();
    });

    it('should handle non-existent condition field', async () => {
      const form = createForm(createSimpleSchema());
      const applicator = new ValidationApplicator(form);

      const validators: ValidatorRegistration[] = [
        {
          fieldPath: 'email',
          type: 'sync',
          validator: requiredValidator,
          condition: {
            fieldPath: 'nonExistentConditionField',
            conditionFn: () => true,
          },
        },
      ];

      // Validator should be skipped when condition field doesn't exist
      await applicator.apply(validators);

      // Email should have no errors because condition field not found
      expect(form.email.errors.value).toHaveLength(0);
    });

    it('should handle tree validator without targetField', async () => {
      const form = createForm(createSimpleSchema());
      const applicator = new ValidationApplicator(form);

      const treeValidator: TreeValidatorFn<SimpleForm> = () => {
        return { code: 'formError', message: 'Form-level error' };
      };

      const validators: ValidatorRegistration[] = [
        {
          fieldPath: '',
          type: 'tree',
          validator: treeValidator,
          // No targetField specified
        },
      ];

      // Should not throw, but error won't be set anywhere
      await expect(applicator.apply(validators)).resolves.not.toThrow();
    });
  });

  // ==========================================================================
  // 8. Integration with ValidationContext
  // ==========================================================================

  describe('ValidationContext Integration', () => {
    it('should provide form access through context', async () => {
      const form = createForm(createSimpleSchema());
      const applicator = new ValidationApplicator(form);

      form.email.setValue('test@test.com');

      const contextAwareValidator: ContextualValidatorFn<SimpleForm, string> = (value, ctx) => {
        // Access other field through context
        const password = ctx.form.password.value.value;
        if (value && !password) {
          return { code: 'needPassword', message: 'Password required when email is set' };
        }
        return null;
      };

      const validators: ValidatorRegistration[] = [
        {
          fieldPath: 'email',
          type: 'sync',
          validator: contextAwareValidator as ContextualValidatorFn<unknown, unknown>,
        },
      ];

      await applicator.apply(validators);

      expect(form.email.errors.value).toHaveLength(1);
      expect(form.email.errors.value[0].code).toBe('needPassword');
    });

    it('should allow setFieldValue through context', async () => {
      const form = createForm(createSimpleSchema());
      const applicator = new ValidationApplicator(form);

      form.email.setValue('uppercase@TEST.COM');

      const normalizingValidator: ContextualValidatorFn<SimpleForm, string> = (value, ctx) => {
        if (value && value !== value.toLowerCase()) {
          ctx.setFieldValue('email', value.toLowerCase());
        }
        return null;
      };

      const validators: ValidatorRegistration[] = [
        {
          fieldPath: 'email',
          type: 'sync',
          validator: normalizingValidator as ContextualValidatorFn<unknown, unknown>,
        },
      ];

      await applicator.apply(validators);

      // Email should be normalized to lowercase
      expect(form.email.value.value).toBe('uppercase@test.com');
    });
  });
});
