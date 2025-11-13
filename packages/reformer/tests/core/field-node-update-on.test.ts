/**
 * Unit tests for FieldNode updateOn: 'change' | 'blur' | 'submit'
 *
 * Tests validation triggering based on updateOn configuration
 */

import { describe, it, expect } from 'vitest';
import { FieldNode } from '../../src/core/nodes/field-node';
import type { ValidatorFn, AsyncValidatorFn } from '../../src/core/types';
import { makeForm } from '../../src/core/utils/make-form';

const requiredValidator: ValidatorFn<string> = (value: string) => {
  return value.trim() === '' ? { code: 'required', message: 'Field is required' } : null;
};

const minLengthValidator: ValidatorFn<string> = (value: string) => {
  return value.length < 3 ? { code: 'minLength', message: 'Min 3 characters' } : null;
};

const asyncValidator: AsyncValidatorFn<string> = async (value: string) => {
  await new Promise((resolve) => setTimeout(resolve, 10));
  return value.includes('test') ? null : { code: 'invalid', message: 'Must contain "test"' };
};

describe('FieldNode - updateOn', () => {
  describe('updateOn: "change" (default)', () => {
    it('should validate on every setValue', async () => {
      const field = new FieldNode({
        value: '',
        component: null as any,
        updateOn: 'change',
        validators: [requiredValidator],
      });

      // Initial state - valid
      expect(field.valid.value).toBe(true);

      // setValue with invalid value
      field.setValue('');
      await new Promise((resolve) => setTimeout(resolve, 10));

      expect(field.valid.value).toBe(false);
      expect(field.errors.value).toHaveLength(1);
      expect(field.errors.value[0].code).toBe('required');

      // setValue with valid value
      field.setValue('valid');
      await new Promise((resolve) => setTimeout(resolve, 10));

      expect(field.valid.value).toBe(true);
      expect(field.errors.value).toHaveLength(0);
    });

    it('should validate immediately on setValue without debounce', async () => {
      const field = new FieldNode({
        value: '',
        component: null as any,
        updateOn: 'change',
        validators: [requiredValidator],
      });

      field.setValue('');

      // Validation happens synchronously for sync validators
      expect(field.errors.value).toHaveLength(1);
    });

    it('should be default when updateOn is not specified', async () => {
      const field = new FieldNode({
        value: '',
        component: null as any,
        validators: [requiredValidator],
      });

      field.setValue('');
      await new Promise((resolve) => setTimeout(resolve, 10));

      expect(field.valid.value).toBe(false);
    });
  });

  describe('updateOn: "blur"', () => {
    it('should NOT validate on setValue', async () => {
      const field = new FieldNode({
        value: '',
        component: null as any,
        updateOn: 'blur',
        validators: [requiredValidator],
      });

      // setValue with invalid value
      field.setValue('');
      await new Promise((resolve) => setTimeout(resolve, 10));

      // Should still be valid (no validation yet)
      expect(field.valid.value).toBe(true);
      expect(field.errors.value).toHaveLength(0);
    });

    it('should validate on markAsTouched (blur)', async () => {
      const field = new FieldNode({
        value: '',
        component: null as any,
        updateOn: 'blur',
        validators: [requiredValidator],
      });

      field.setValue('');
      await new Promise((resolve) => setTimeout(resolve, 10));

      // Still valid
      expect(field.valid.value).toBe(true);

      // Trigger blur
      field.markAsTouched();
      await new Promise((resolve) => setTimeout(resolve, 10));

      // Now invalid
      expect(field.valid.value).toBe(false);
      expect(field.errors.value[0].code).toBe('required');
    });

    it('should validate on setValue if field has errors', async () => {
      const field = new FieldNode({
        value: '',
        component: null as any,
        updateOn: 'blur',
        validators: [requiredValidator],
      });

      // First blur - trigger validation
      field.markAsTouched();
      await new Promise((resolve) => setTimeout(resolve, 10));

      expect(field.valid.value).toBe(false);

      // Now setValue should validate (to allow hiding errors)
      field.setValue('valid');
      await new Promise((resolve) => setTimeout(resolve, 10));

      expect(field.valid.value).toBe(true);
      expect(field.errors.value).toHaveLength(0);
    });

    it('should NOT validate on setValue if field has NO errors', async () => {
      const field = new FieldNode({
        value: 'initial',
        component: null as any,
        updateOn: 'blur',
        validators: [requiredValidator],
      });

      // Field is valid, no errors
      expect(field.valid.value).toBe(true);

      // setValue to invalid value (but no validation yet)
      field.setValue('');
      await new Promise((resolve) => setTimeout(resolve, 10));

      // Still valid (no validation until blur)
      expect(field.valid.value).toBe(true);
    });
  });

  describe('updateOn: "submit"', () => {
    it('should NOT validate on setValue', async () => {
      const field = new FieldNode({
        value: '',
        component: null as any,
        updateOn: 'submit',
        validators: [requiredValidator],
      });

      field.setValue('');
      await new Promise((resolve) => setTimeout(resolve, 10));

      // Should still be valid (no validation yet)
      expect(field.valid.value).toBe(true);
      expect(field.errors.value).toHaveLength(0);
    });

    it('should NOT validate on markAsTouched', async () => {
      const field = new FieldNode({
        value: '',
        component: null as any,
        updateOn: 'submit',
        validators: [requiredValidator],
      });

      field.setValue('');
      field.markAsTouched();
      await new Promise((resolve) => setTimeout(resolve, 10));

      // Still valid (no validation until submit)
      expect(field.valid.value).toBe(true);
    });

    it('should validate on manual validate() call', async () => {
      const field = new FieldNode({
        value: '',
        component: null as any,
        updateOn: 'submit',
        validators: [requiredValidator],
      });

      field.setValue('');

      // Manual validation (called by GroupNode.submit())
      await field.validate();

      expect(field.valid.value).toBe(false);
      expect(field.errors.value[0].code).toBe('required');
    });

    it('should validate on setValue if field has errors', async () => {
      const field = new FieldNode({
        value: '',
        component: null as any,
        updateOn: 'submit',
        validators: [requiredValidator],
      });

      // Manual validate to trigger errors
      await field.validate();
      expect(field.valid.value).toBe(false);

      // Now setValue should validate (to allow hiding errors)
      field.setValue('valid');
      await new Promise((resolve) => setTimeout(resolve, 10));

      expect(field.valid.value).toBe(true);
      expect(field.errors.value).toHaveLength(0);
    });

    it('should work with GroupNode.submit()', async () => {
      interface TestForm {
        email: string;
        password: string;
      }

      const form = makeForm<TestForm>({
        email: {
          value: '',
          component: null as any,
          updateOn: 'submit',
          validators: [requiredValidator],
        },
        password: {
          value: '',
          component: null as any,
          updateOn: 'submit',
          validators: [minLengthValidator],
        },
      });

      // setValue doesn't trigger validation
      form.email.setValue('');
      form.password.setValue('ab');
      await new Promise((resolve) => setTimeout(resolve, 10));

      expect(form.email.valid.value).toBe(true);
      expect(form.password.valid.value).toBe(true);

      // Submit triggers validation
      const result = await form.submit(async (values: any) => values);

      expect(result).toBeNull(); // Form invalid
      expect(form.email.valid.value).toBe(false);
      expect(form.password.valid.value).toBe(false);
    });
  });

  describe('Async validators with updateOn', () => {
    it('should respect updateOn: "blur" with async validators', async () => {
      const field = new FieldNode({
        value: '',
        component: null as any,
        updateOn: 'blur',
        asyncValidators: [asyncValidator],
      });

      // setValue doesn't trigger validation
      field.setValue('invalid');
      await new Promise((resolve) => setTimeout(resolve, 50));

      expect(field.valid.value).toBe(true); // No validation yet

      // Blur triggers validation
      field.markAsTouched();
      await new Promise((resolve) => setTimeout(resolve, 50));

      expect(field.valid.value).toBe(false);
      expect(field.errors.value[0].code).toBe('invalid');
    });

    it('should respect updateOn: "submit" with async validators', async () => {
      const field = new FieldNode({
        value: '',
        component: null as any,
        updateOn: 'submit',
        asyncValidators: [asyncValidator],
      });

      field.setValue('invalid');
      field.markAsTouched();
      await new Promise((resolve) => setTimeout(resolve, 50));

      expect(field.valid.value).toBe(true); // No validation yet

      // Manual validation triggers async validators
      await field.validate();

      expect(field.valid.value).toBe(false);
      expect(field.errors.value[0].code).toBe('invalid');
    });
  });

  describe('Multiple validators with updateOn', () => {
    it('should validate all validators when triggered', async () => {
      const field = new FieldNode({
        value: '',
        component: null as any,
        updateOn: 'blur',
        validators: [requiredValidator, minLengthValidator],
      });

      field.markAsTouched();
      await new Promise((resolve) => setTimeout(resolve, 10));

      // Both validators should run (both return errors for empty string)
      expect(field.errors.value).toHaveLength(2);
      expect(field.errors.value[0].code).toBe('required');
      expect(field.errors.value[1].code).toBe('minLength');
    });

    it('should run sync and async validators', async () => {
      const field = new FieldNode({
        value: '',
        component: null as any,
        updateOn: 'blur',
        validators: [requiredValidator],
        asyncValidators: [asyncValidator],
      });

      field.markAsTouched();
      await new Promise((resolve) => setTimeout(resolve, 50));

      // Sync validator runs first
      expect(field.errors.value[0].code).toBe('required');
    });
  });

  describe('Edge cases', () => {
    it('should handle rapid changes with updateOn: "change"', async () => {
      const field = new FieldNode({
        value: '',
        component: null as any,
        updateOn: 'change',
        validators: [requiredValidator],
      });

      // Rapid changes
      field.setValue('');
      field.setValue('a');
      field.setValue('ab');
      field.setValue('abc');

      await new Promise((resolve) => setTimeout(resolve, 10));

      expect(field.valid.value).toBe(true);
      expect(field.value.value).toBe('abc');
    });

    it('should handle updateOn with emitEvent: false', async () => {
      const field = new FieldNode({
        value: '',
        component: null as any,
        updateOn: 'change',
        validators: [requiredValidator],
      });

      // setValue with emitEvent: false doesn't validate
      field.setValue('', { emitEvent: false });
      await new Promise((resolve) => setTimeout(resolve, 10));

      expect(field.valid.value).toBe(true);
    });

    it('should handle reset with updateOn', async () => {
      const field = new FieldNode({
        value: 'initial',
        component: null as any,
        updateOn: 'blur',
        validators: [requiredValidator],
      });

      field.setValue('');
      field.markAsTouched();
      await new Promise((resolve) => setTimeout(resolve, 10));

      expect(field.valid.value).toBe(false);

      // Reset clears errors
      field.reset();

      expect(field.valid.value).toBe(true);
      expect(field.errors.value).toHaveLength(0);
      expect(field.touched.value).toBe(false);
    });
  });

  describe('Error hiding behavior', () => {
    it('should hide errors when value becomes valid (updateOn: blur)', async () => {
      const field = new FieldNode({
        value: '',
        component: null as any,
        updateOn: 'blur',
        validators: [minLengthValidator],
      });

      // Trigger validation with invalid value
      field.markAsTouched();
      await new Promise((resolve) => setTimeout(resolve, 10));

      expect(field.errors.value[0].code).toBe('minLength');

      // Fix the value - should validate and hide error
      field.setValue('abc');
      await new Promise((resolve) => setTimeout(resolve, 10));

      expect(field.valid.value).toBe(true);
      expect(field.errors.value).toHaveLength(0);
    });

    it('should update error message when value still invalid (updateOn: blur)', async () => {
      const field = new FieldNode({
        value: '',
        component: null as any,
        updateOn: 'blur',
        validators: [requiredValidator, minLengthValidator],
      });

      // Trigger validation with empty value
      field.markAsTouched();
      await new Promise((resolve) => setTimeout(resolve, 10));

      expect(field.errors.value[0].code).toBe('required');

      // Change to short value - should validate and show different error
      field.setValue('ab');
      await new Promise((resolve) => setTimeout(resolve, 10));

      expect(field.errors.value[0].code).toBe('minLength');
    });

    it('should hide errors when value becomes valid (updateOn: submit)', async () => {
      const field = new FieldNode({
        value: '',
        component: null as any,
        updateOn: 'submit',
        validators: [minLengthValidator],
      });

      // Manual validation
      await field.validate();
      expect(field.errors.value[0].code).toBe('minLength');

      // Fix the value - should validate and hide error
      field.setValue('abc');
      await new Promise((resolve) => setTimeout(resolve, 10));

      expect(field.valid.value).toBe(true);
      expect(field.errors.value).toHaveLength(0);
    });
  });

  describe('Integration with debounce', () => {
    it('should combine updateOn: "change" with debounce', async () => {
      const field = new FieldNode({
        value: '',
        component: null as any,
        updateOn: 'change',
        asyncValidators: [asyncValidator],
        debounce: 100,
      });

      // Rapid changes
      field.setValue('a');
      field.setValue('ab');
      field.setValue('test');

      // Before debounce
      await new Promise((resolve) => setTimeout(resolve, 50));
      expect(['valid', 'pending']).toContain(field.status.value);

      // After debounce
      await new Promise((resolve) => setTimeout(resolve, 100));
      expect(field.valid.value).toBe(true);
    });

    it('should combine updateOn: "blur" with debounce', async () => {
      const field = new FieldNode({
        value: '',
        component: null as any,
        updateOn: 'blur',
        asyncValidators: [asyncValidator],
        debounce: 100,
      });

      field.setValue('invalid');

      // setValue doesn't trigger validation
      await new Promise((resolve) => setTimeout(resolve, 150));
      expect(field.valid.value).toBe(true);

      // Blur triggers debounced validation
      field.markAsTouched();
      await new Promise((resolve) => setTimeout(resolve, 150));

      expect(field.valid.value).toBe(false);
    });
  });
});
