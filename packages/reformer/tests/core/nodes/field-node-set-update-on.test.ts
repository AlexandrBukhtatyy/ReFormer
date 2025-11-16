/**
 * Unit tests for FieldNode.setUpdateOn()
 *
 * Tests dynamic changing of validation trigger (updateOn)
 */

import { describe, it, expect } from 'vitest';
import { FieldNode } from '../../../src/core/nodes/field-node';
import type { ValidatorFn } from '../../../src/core/types';
import { makeForm } from '../../../src/core/utils/make-form';
import { ComponentInstance } from '../../test-utils/types';

const requiredValidator: ValidatorFn<string> = (value: string) => {
  return value.trim() === '' ? { code: 'required', message: 'Field is required' } : null;
};

describe('FieldNode - setUpdateOn()', () => {
  describe('Basic functionality', () => {
    it('should change updateOn from submit to change', async () => {
      const field = new FieldNode({
        value: '',
        component: null as ComponentInstance,
        updateOn: 'submit',
        validators: [requiredValidator],
      });

      // Initially updateOn = 'submit', setValue does not trigger validation
      field.setValue('');
      await new Promise((resolve) => setTimeout(resolve, 10));

      expect(field.valid.value).toBe(true); // No validation yet

      // Change to 'change'
      field.setUpdateOn('change');

      // Now setValue triggers validation
      field.setValue('');
      await new Promise((resolve) => setTimeout(resolve, 10));

      expect(field.valid.value).toBe(false);
      expect(field.errors.value[0].code).toBe('required');
    });

    it('should change updateOn from change to blur', async () => {
      const field = new FieldNode({
        value: '',
        component: null as ComponentInstance,
        updateOn: 'change',
        validators: [requiredValidator],
      });

      // Initially updateOn = 'change', setValue triggers validation
      field.setValue('');
      await new Promise((resolve) => setTimeout(resolve, 10));

      expect(field.valid.value).toBe(false);

      // Reset state
      field.setValue('valid');
      await new Promise((resolve) => setTimeout(resolve, 10));
      expect(field.valid.value).toBe(true);

      // Change to 'blur'
      field.setUpdateOn('blur');

      // Now setValue does not trigger validation
      field.setValue('');
      await new Promise((resolve) => setTimeout(resolve, 10));

      expect(field.valid.value).toBe(true); // No validation yet

      // But markAsTouched triggers validation
      field.markAsTouched();
      await new Promise((resolve) => setTimeout(resolve, 10));

      expect(field.valid.value).toBe(false);
    });

    it('should change updateOn from blur to submit', async () => {
      const field = new FieldNode({
        value: '',
        component: null as ComponentInstance,
        updateOn: 'blur',
        validators: [requiredValidator],
      });

      // Initially updateOn = 'blur', markAsTouched triggers validation
      field.markAsTouched();
      await new Promise((resolve) => setTimeout(resolve, 10));

      expect(field.valid.value).toBe(false);

      // Reset state
      field.setValue('valid');
      await new Promise((resolve) => setTimeout(resolve, 10));
      field.markAsUntouched();

      // Change to 'submit'
      field.setUpdateOn('submit');

      // Now markAsTouched does not trigger validation
      field.setValue('');
      field.markAsTouched();
      await new Promise((resolve) => setTimeout(resolve, 10));

      expect(field.valid.value).toBe(true); // No validation yet

      // But manual validate() triggers validation
      await field.validate();

      expect(field.valid.value).toBe(false);
    });
  });

  describe('Adaptive validation after submit', () => {
    it('should switch to instant feedback after first submit', async () => {
      interface LoginForm {
        email: string;
        password: string;
      }

      const form = makeForm<LoginForm>({
        email: {
          value: '',
          component: null as ComponentInstance,
          updateOn: 'submit',
          validators: [requiredValidator],
        },
        password: {
          value: '',
          component: null as ComponentInstance,
          updateOn: 'submit',
          validators: [requiredValidator],
        },
      });

      // Initially no validation on setValue
      form.email.setValue('');
      form.password.setValue('');
      await new Promise((resolve) => setTimeout(resolve, 10));

      expect(form.email.valid.value).toBe(true);
      expect(form.password.valid.value).toBe(true);

      // First submit - validation fails
      const result = await form.submit(async (values: any) => values);

      expect(result).toBeNull();
      expect(form.email.valid.value).toBe(false);
      expect(form.password.valid.value).toBe(false);

      // After submit, switch to instant feedback
      form.email.setUpdateOn('change');
      form.password.setUpdateOn('change');

      // Now setValue triggers validation
      form.email.setValue('test@mail.com');
      await new Promise((resolve) => setTimeout(resolve, 10));

      expect(form.email.valid.value).toBe(true);

      // User fixes password
      form.password.setValue('password123');
      await new Promise((resolve) => setTimeout(resolve, 10));

      expect(form.password.valid.value).toBe(true);
    });
  });

  describe('Progressive enhancement', () => {
    it('should start with blur and switch to change on user interaction', async () => {
      const field = new FieldNode({
        value: '',
        component: null as ComponentInstance,
        updateOn: 'blur',
        validators: [requiredValidator],
      });

      // User focuses and blurs field
      field.markAsTouched();
      await new Promise((resolve) => setTimeout(resolve, 10));

      expect(field.valid.value).toBe(false);

      // After first interaction, switch to instant feedback
      field.setUpdateOn('change');

      // Now user gets immediate feedback
      field.setValue('t');
      await new Promise((resolve) => setTimeout(resolve, 10));

      expect(field.valid.value).toBe(true);
    });
  });

  describe('Multiple transitions', () => {
    it('should handle multiple updateOn changes', async () => {
      const field = new FieldNode({
        value: '',
        component: null as ComponentInstance,
        updateOn: 'submit',
        validators: [requiredValidator],
      });

      // Start: submit
      field.setValue('');
      await new Promise((resolve) => setTimeout(resolve, 10));
      expect(field.valid.value).toBe(true); // No validation

      // Change to blur
      field.setUpdateOn('blur');
      field.markAsTouched();
      await new Promise((resolve) => setTimeout(resolve, 10));
      expect(field.valid.value).toBe(false); // Validation triggered

      // Fix value
      field.setValue('valid');
      await new Promise((resolve) => setTimeout(resolve, 10));
      expect(field.valid.value).toBe(true);

      // Change to change
      field.setUpdateOn('change');
      field.setValue('');
      await new Promise((resolve) => setTimeout(resolve, 10));
      expect(field.valid.value).toBe(false); // Validation triggered

      // Change back to submit
      field.setUpdateOn('submit');
      field.setValue('valid');
      await new Promise((resolve) => setTimeout(resolve, 10));
      expect(field.valid.value).toBe(true); // No validation (but has errors from before)
    });
  });

  describe('Integration with GroupNode', () => {
    it('should update all fields in form after submit', async () => {
      interface Form {
        field1: string;
        field2: string;
        field3: string;
      }

      const form = makeForm<Form>({
        field1: {
          value: '',
          component: null as ComponentInstance,
          updateOn: 'submit',
          validators: [requiredValidator],
        },
        field2: {
          value: '',
          component: null as ComponentInstance,
          updateOn: 'submit',
          validators: [requiredValidator],
        },
        field3: {
          value: '',
          component: null as ComponentInstance,
          updateOn: 'submit',
          validators: [requiredValidator],
        },
      });

      // Submit fails
      const result = await form.submit(async (values: any) => values);
      expect(result).toBeNull();

      // Update all fields to instant feedback
      form.field1.setUpdateOn('change');
      form.field2.setUpdateOn('change');
      form.field3.setUpdateOn('change');

      // Now all fields validate on change
      form.field1.setValue('value1');
      form.field2.setValue('value2');
      form.field3.setValue('value3');
      await new Promise((resolve) => setTimeout(resolve, 10));

      expect(form.field1.valid.value).toBe(true);
      expect(form.field2.valid.value).toBe(true);
      expect(form.field3.valid.value).toBe(true);
    });
  });

  describe('Edge cases', () => {
    it('should handle setting same updateOn value', async () => {
      const field = new FieldNode({
        value: '',
        component: null as ComponentInstance,
        updateOn: 'change',
        validators: [requiredValidator],
      });

      field.setUpdateOn('change');
      field.setUpdateOn('change');

      // Should work normally
      field.setValue('');
      await new Promise((resolve) => setTimeout(resolve, 10));

      expect(field.valid.value).toBe(false);
    });

    it('should not affect existing validation state', async () => {
      const field = new FieldNode({
        value: '',
        component: null as ComponentInstance,
        updateOn: 'change',
        validators: [requiredValidator],
      });

      // Trigger validation
      field.setValue('');
      await new Promise((resolve) => setTimeout(resolve, 10));

      expect(field.valid.value).toBe(false);
      expect(field.errors.value).toHaveLength(1);

      // Change updateOn
      field.setUpdateOn('submit');

      // Errors should still be present
      expect(field.valid.value).toBe(false);
      expect(field.errors.value).toHaveLength(1);
    });

    it('should work with async validators', async () => {
      const asyncValidator = async (value: string) => {
        await new Promise((resolve) => setTimeout(resolve, 10));
        return value === '' ? { code: 'required', message: 'Required' } : null;
      };

      const field = new FieldNode({
        value: '',
        component: null as ComponentInstance,
        updateOn: 'submit',
        asyncValidators: [asyncValidator],
      });

      // No validation initially
      field.setValue('');
      await new Promise((resolve) => setTimeout(resolve, 50));
      expect(field.valid.value).toBe(true);

      // Change to 'change'
      field.setUpdateOn('change');

      // Now validation happens
      field.setValue('');
      await new Promise((resolve) => setTimeout(resolve, 50));
      expect(field.valid.value).toBe(false);
    });
  });

  describe('Real-world scenarios', () => {
    it('should implement "validate on submit, then on change" pattern', async () => {
      interface RegistrationForm {
        username: string;
        email: string;
        password: string;
      }

      const form = makeForm<RegistrationForm>({
        username: {
          value: '',
          component: null as ComponentInstance,
          updateOn: 'submit',
          validators: [requiredValidator],
        },
        email: {
          value: '',
          component: null as ComponentInstance,
          updateOn: 'submit',
          validators: [requiredValidator],
        },
        password: {
          value: '',
          component: null as ComponentInstance,
          updateOn: 'submit',
          validators: [requiredValidator],
        },
      });

      // Initial state - no validation on user input
      form.username.setValue('');
      form.email.setValue('');
      form.password.setValue('');
      await new Promise((resolve) => setTimeout(resolve, 10));

      expect(form.valid.value).toBe(true);

      // User clicks submit
      const result = await form.submit(async (values: any) => {
        // Switch to instant feedback after submit attempt
        form.username.setUpdateOn('change');
        form.email.setUpdateOn('change');
        form.password.setUpdateOn('change');

        return values;
      });

      expect(result).toBeNull(); // Form invalid

      // Now user gets instant feedback while fixing errors
      form.username.setValue('john');
      await new Promise((resolve) => setTimeout(resolve, 10));
      expect(form.username.valid.value).toBe(true);

      form.email.setValue('john@example.com');
      await new Promise((resolve) => setTimeout(resolve, 10));
      expect(form.email.valid.value).toBe(true);

      form.password.setValue('securepassword');
      await new Promise((resolve) => setTimeout(resolve, 10));
      expect(form.password.valid.value).toBe(true);

      // All fields valid, can submit again
      expect(form.valid.value).toBe(true);
    });
  });
});
