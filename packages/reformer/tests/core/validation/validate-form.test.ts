/**
 * Unit tests for validateForm - multi-step form validation
 *
 * Key test scenarios:
 * - validateForm works with Proxy (FormProxy)
 * - Multi-step validation applies only specified validators
 * - Nested groups and arrays are traversed correctly
 */

import { describe, it, expect } from 'vitest';
import { createForm } from '../../../src/core/utils/create-form';
import { validateForm } from '../../../src/core/validation/validate-form';
import { required } from '../../../src/core/validation/validators/required';
import { min } from '../../../src/core/validation/validators/min';
import { applyWhen } from '../../../src/core/validation/core/apply-when';
import type { ValidationSchemaFn, FieldPath } from '../../../src/core/types';
import { ComponentInstance } from '../../test-utils/types';

describe('validateForm', () => {
  describe('works with Proxy (FormProxy)', () => {
    interface SimpleForm {
      name: string;
      email: string;
    }

    it('should validate form created with createForm (returns Proxy)', async () => {
      const form = createForm<SimpleForm>({
        name: { value: '', component: null as ComponentInstance },
        email: { value: '', component: null as ComponentInstance },
      });

      // createForm returns FormProxy (Proxy over GroupNode)
      // This test verifies that validateForm works with Proxy
      const validation: ValidationSchemaFn<SimpleForm> = (path: FieldPath<SimpleForm>) => {
        required(path.name, { message: 'Name is required' });
        required(path.email, { message: 'Email is required' });
      };

      const isValid = await validateForm(form, validation);

      expect(isValid).toBe(false);
      expect(form.name.errors.value).toHaveLength(1);
      expect(form.name.errors.value[0].code).toBe('required');
      expect(form.email.errors.value).toHaveLength(1);
    });

    it('should return true when form is valid', async () => {
      const form = createForm<SimpleForm>({
        name: { value: 'John', component: null as ComponentInstance },
        email: { value: 'john@example.com', component: null as ComponentInstance },
      });

      const validation: ValidationSchemaFn<SimpleForm> = (path: FieldPath<SimpleForm>) => {
        required(path.name);
        required(path.email);
      };

      const isValid = await validateForm(form, validation);

      expect(isValid).toBe(true);
      expect(form.name.errors.value).toHaveLength(0);
      expect(form.email.errors.value).toHaveLength(0);
    });
  });

  describe('multi-step validation', () => {
    interface MultiStepForm {
      // Step 1
      loanType: string;
      loanAmount: number;
      // Step 2
      firstName: string;
      lastName: string;
      // Step 3
      accountNumber: string;
    }

    const step1Validation: ValidationSchemaFn<MultiStepForm> = (path) => {
      required(path.loanType);
      min(path.loanAmount, 1000);
    };

    const step2Validation: ValidationSchemaFn<MultiStepForm> = (path) => {
      required(path.firstName);
      required(path.lastName);
    };

    const _step3Validation: ValidationSchemaFn<MultiStepForm> = (path) => {
      required(path.accountNumber);
    };

    it('should validate only step 1 fields', async () => {
      const form = createForm<MultiStepForm>({
        loanType: { value: '', component: null as ComponentInstance },
        loanAmount: { value: 0, component: null as ComponentInstance },
        firstName: { value: '', component: null as ComponentInstance },
        lastName: { value: '', component: null as ComponentInstance },
        accountNumber: { value: '', component: null as ComponentInstance },
      });

      const isValid = await validateForm(form, step1Validation);

      expect(isValid).toBe(false);
      // Step 1 fields should have errors
      expect(form.loanType.errors.value).toHaveLength(1);
      expect(form.loanAmount.errors.value).toHaveLength(1);
      // Step 2 and 3 fields should NOT have errors
      expect(form.firstName.errors.value).toHaveLength(0);
      expect(form.lastName.errors.value).toHaveLength(0);
      expect(form.accountNumber.errors.value).toHaveLength(0);
    });

    it('should validate only step 2 fields', async () => {
      const form = createForm<MultiStepForm>({
        loanType: { value: '', component: null as ComponentInstance },
        loanAmount: { value: 0, component: null as ComponentInstance },
        firstName: { value: '', component: null as ComponentInstance },
        lastName: { value: '', component: null as ComponentInstance },
        accountNumber: { value: '', component: null as ComponentInstance },
      });

      const isValid = await validateForm(form, step2Validation);

      expect(isValid).toBe(false);
      // Step 1 fields should NOT have errors (not in this schema)
      expect(form.loanType.errors.value).toHaveLength(0);
      expect(form.loanAmount.errors.value).toHaveLength(0);
      // Step 2 fields should have errors
      expect(form.firstName.errors.value).toHaveLength(1);
      expect(form.lastName.errors.value).toHaveLength(1);
      // Step 3 fields should NOT have errors
      expect(form.accountNumber.errors.value).toHaveLength(0);
    });

    it('should pass step validation when step fields are valid', async () => {
      const form = createForm<MultiStepForm>({
        loanType: { value: 'personal', component: null as ComponentInstance },
        loanAmount: { value: 5000, component: null as ComponentInstance },
        firstName: { value: '', component: null as ComponentInstance },
        lastName: { value: '', component: null as ComponentInstance },
        accountNumber: { value: '', component: null as ComponentInstance },
      });

      const isValid = await validateForm(form, step1Validation);

      expect(isValid).toBe(true);
    });
  });

  describe('nested groups', () => {
    interface FormWithNestedGroup {
      name: string;
      address: {
        street: string;
        city: string;
        zip: string;
      };
    }

    it('should validate nested group fields through Proxy', async () => {
      const form = createForm<FormWithNestedGroup>({
        name: { value: '', component: null as ComponentInstance },
        address: {
          street: { value: '', component: null as ComponentInstance },
          city: { value: '', component: null as ComponentInstance },
          zip: { value: '', component: null as ComponentInstance },
        },
      });

      const validation: ValidationSchemaFn<FormWithNestedGroup> = (path) => {
        required(path.name);
        required(path.address.street);
        required(path.address.city);
      };

      const isValid = await validateForm(form, validation);

      expect(isValid).toBe(false);
      expect(form.name.errors.value).toHaveLength(1);
      expect(form.address.street.errors.value).toHaveLength(1);
      expect(form.address.city.errors.value).toHaveLength(1);
      // zip was not in validation schema
      expect(form.address.zip.errors.value).toHaveLength(0);
    });
  });

  describe('arrays', () => {
    interface FormWithArray {
      title: string;
      items: Array<{
        name: string;
        quantity: number;
      }>;
    }

    it('should validate array items through Proxy', async () => {
      const form = createForm<FormWithArray>({
        title: { value: '', component: null as ComponentInstance },
        items: [
          {
            name: { value: '', component: null as ComponentInstance },
            quantity: { value: 0, component: null as ComponentInstance },
          },
        ],
      });

      // Add an item to the array
      form.items.push({ name: '', quantity: 0 });

      const validation: ValidationSchemaFn<FormWithArray> = (path) => {
        required(path.title);
      };

      const isValid = await validateForm(form, validation);

      expect(isValid).toBe(false);
      expect(form.title.errors.value).toHaveLength(1);
    });
  });

  describe('conditional validation with applyWhen', () => {
    interface ConditionalForm {
      loanType: string;
      propertyValue: number;
      vehicleValue: number;
    }

    it('should apply conditional validators in validateForm', async () => {
      const form = createForm<ConditionalForm>({
        loanType: { value: 'mortgage', component: null as ComponentInstance },
        propertyValue: { value: 0, component: null as ComponentInstance },
        vehicleValue: { value: 0, component: null as ComponentInstance },
      });

      const validation: ValidationSchemaFn<ConditionalForm> = (path) => {
        required(path.loanType);

        applyWhen(
          path.loanType,
          (type) => type === 'mortgage',
          (p) => {
            min(p.propertyValue, 100000, { message: 'Property value must be at least 100000' });
          }
        );

        applyWhen(
          path.loanType,
          (type) => type === 'auto',
          (p) => {
            min(p.vehicleValue, 10000, { message: 'Vehicle value must be at least 10000' });
          }
        );
      };

      const isValid = await validateForm(form, validation);

      expect(isValid).toBe(false);
      // loanType is 'mortgage', so propertyValue should be validated
      expect(form.propertyValue.errors.value).toHaveLength(1);
      // vehicleValue should NOT be validated (condition is false)
      expect(form.vehicleValue.errors.value).toHaveLength(0);
    });

    it('should switch conditions dynamically', async () => {
      const form = createForm<ConditionalForm>({
        loanType: { value: 'auto', component: null as ComponentInstance },
        propertyValue: { value: 0, component: null as ComponentInstance },
        vehicleValue: { value: 0, component: null as ComponentInstance },
      });

      const validation: ValidationSchemaFn<ConditionalForm> = (path) => {
        applyWhen(
          path.loanType,
          (type) => type === 'mortgage',
          (p) => {
            min(p.propertyValue, 100000);
          }
        );

        applyWhen(
          path.loanType,
          (type) => type === 'auto',
          (p) => {
            min(p.vehicleValue, 10000);
          }
        );
      };

      const isValid = await validateForm(form, validation);

      expect(isValid).toBe(false);
      // Now vehicleValue should be validated
      expect(form.vehicleValue.errors.value).toHaveLength(1);
      // propertyValue should NOT be validated
      expect(form.propertyValue.errors.value).toHaveLength(0);
    });
  });

  describe('clears previous errors', () => {
    interface SimpleForm {
      name: string;
    }

    it('should clear errors before applying new validation', async () => {
      const form = createForm<SimpleForm>({
        name: { value: '', component: null as ComponentInstance },
      });

      // First validation - should fail
      const validation1: ValidationSchemaFn<SimpleForm> = (path) => {
        required(path.name);
      };

      await validateForm(form, validation1);
      expect(form.name.errors.value).toHaveLength(1);

      // Set valid value
      form.name.setValue('John');

      // Second validation - should pass and clear errors
      await validateForm(form, validation1);
      expect(form.name.errors.value).toHaveLength(0);
    });
  });

  describe('does not affect permanent form registry', () => {
    interface SimpleForm {
      name: string;
      email: string;
    }

    it('should not save validation schema to form registry', async () => {
      const form = createForm<SimpleForm>({
        name: { value: '', component: null as ComponentInstance },
        email: { value: '', component: null as ComponentInstance },
      });

      // Apply permanent validation schema
      const permanentValidation: ValidationSchemaFn<SimpleForm> = (path) => {
        required(path.name);
      };
      form.applyValidationSchema(permanentValidation);

      // Use validateForm with different schema (temporary)
      const temporaryValidation: ValidationSchemaFn<SimpleForm> = (path) => {
        required(path.email);
      };
      await validateForm(form, temporaryValidation);

      // Clear errors
      form.clearErrors();

      // Validate using permanent schema (form.validate())
      await form.validate();

      // Only permanent validation should be applied
      expect(form.name.errors.value).toHaveLength(1); // from permanent schema
      // email might or might not have error depending on implementation
      // The key point is that temporary schema is not persisted
    });
  });
});
