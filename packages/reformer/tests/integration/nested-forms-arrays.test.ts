/**
 * Integration tests: Nested forms and array nodes
 */

import { describe, it, expect } from 'vitest';
import { createForm } from '../../src/core/utils/create-form';
import { required, minLength, email } from '../../src/core/validation/validators';
import { computeFrom, enableWhen } from '../../src/core/behavior/behaviors';
import type { BehaviorSchemaFn } from '../../src/core/behavior/types';
import type { ValidationSchemaFn, FieldPath } from '../../src/core/types';
import { ComponentInstance } from '../test-utils/types';

describe('Integration: Nested Forms and Arrays', () => {
  interface Address {
    street: string;
    city: string;
    zip: string;
  }

  interface ContactForm {
    name: string;
    email: string;
    address: Address;
    useShippingAddress: boolean;
    shippingAddress: Address;
  }

  describe('nested group validation', () => {
    it('should validate nested address fields', async () => {
      const form = createForm<ContactForm>({
        name: { value: 'John Doe', component: null as ComponentInstance },
        email: { value: 'john@example.com', component: null as ComponentInstance },
        address: {
          street: { value: '', component: null as ComponentInstance },
          city: { value: '', component: null as ComponentInstance },
          zip: { value: '', component: null as ComponentInstance },
        },
        useShippingAddress: { value: false, component: null as ComponentInstance },
        shippingAddress: {
          street: { value: '', component: null as ComponentInstance },
          city: { value: '', component: null as ComponentInstance },
          zip: { value: '', component: null as ComponentInstance },
        },
      });

      // Validation schema for nested fields
      const validation: ValidationSchemaFn<ContactForm> = (path: FieldPath<ContactForm>) => {
        required(path.name);
        email(path.email);
        required(path.address.street);
        required(path.address.city);
        required(path.address.zip); // required first
        minLength(path.address.zip, 5);
      };

      form.applyValidationSchema(validation);
      await form.validate();

      // Parent fields should be valid
      expect(form.name.valid.value).toBe(true);
      expect(form.email.valid.value).toBe(true);

      // Nested fields should be invalid (empty)
      expect(form.address.street.valid.value).toBe(false);
      expect(form.address.city.valid.value).toBe(false);
      expect(form.address.zip.valid.value).toBe(false); // fails required

      // Form overall should be invalid
      expect(form.valid.value).toBe(false);
    });

    it('should validate nested address with valid values', async () => {
      const form = createForm<ContactForm>({
        name: { value: 'John Doe', component: null as ComponentInstance },
        email: { value: 'john@example.com', component: null as ComponentInstance },
        address: {
          street: { value: '123 Main St', component: null as ComponentInstance },
          city: { value: 'New York', component: null as ComponentInstance },
          zip: { value: '10001', component: null as ComponentInstance },
        },
        useShippingAddress: { value: false, component: null as ComponentInstance },
        shippingAddress: {
          street: { value: '', component: null as ComponentInstance },
          city: { value: '', component: null as ComponentInstance },
          zip: { value: '', component: null as ComponentInstance },
        },
      });

      const validation: ValidationSchemaFn<ContactForm> = (path: FieldPath<ContactForm>) => {
        required(path.name);
        email(path.email);
        required(path.address.street);
        required(path.address.city);
        minLength(path.address.zip, 5);
      };

      form.applyValidationSchema(validation);
      await form.validate();

      // All validated fields should be valid
      expect(form.name.valid.value).toBe(true);
      expect(form.email.valid.value).toBe(true);
      expect(form.address.street.valid.value).toBe(true);
      expect(form.address.city.valid.value).toBe(true);
      expect(form.address.zip.valid.value).toBe(true);

      // Form should be valid
      expect(form.valid.value).toBe(true);
    });
  });

  describe('behaviors with nested fields', () => {
    it('should enable shipping address based on checkbox', async () => {
      const form = createForm<ContactForm>({
        name: { value: '', component: null as ComponentInstance },
        email: { value: '', component: null as ComponentInstance },
        address: {
          street: { value: '', component: null as ComponentInstance },
          city: { value: '', component: null as ComponentInstance },
          zip: { value: '', component: null as ComponentInstance },
        },
        useShippingAddress: { value: false, component: null as ComponentInstance },
        shippingAddress: {
          street: { value: '', component: null as ComponentInstance },
          city: { value: '', component: null as ComponentInstance },
          zip: { value: '', component: null as ComponentInstance },
        },
      });

      // Behavior: enable shipping address fields when checkbox is checked
      const behavior: BehaviorSchemaFn<ContactForm> = (path: FieldPath<ContactForm>) => {
        enableWhen(path.shippingAddress.street, () => form.useShippingAddress.value.value === true);
        enableWhen(path.shippingAddress.city, () => form.useShippingAddress.value.value === true);
        enableWhen(path.shippingAddress.zip, () => form.useShippingAddress.value.value === true);
      };

      form.applyBehaviorSchema(behavior);

      await new Promise((r) => setTimeout(r, 10));

      // Shipping fields should be disabled initially
      expect(form.shippingAddress.street.disabled.value).toBe(true);
      expect(form.shippingAddress.city.disabled.value).toBe(true);
      expect(form.shippingAddress.zip.disabled.value).toBe(true);

      // Check the useShippingAddress checkbox
      form.useShippingAddress.setValue(true);

      await new Promise((r) => setTimeout(r, 10));

      // Shipping fields should be enabled
      expect(form.shippingAddress.street.disabled.value).toBe(false);
      expect(form.shippingAddress.city.disabled.value).toBe(false);
      expect(form.shippingAddress.zip.disabled.value).toBe(false);
    });
  });

  interface OrderWithItems {
    orderNumber: string;
    items: Array<{
      name: string;
      quantity: number;
      price: number;
    }>;
    subtotal: number;
    tax: number;
    total: number;
  }

  describe('form with computed summary', () => {
    it('should compute tax and total from subtotal', async () => {
      const form = createForm<OrderWithItems>({
        orderNumber: { value: 'ORD-001', component: null as ComponentInstance },
        items: [], // Empty array initially
        subtotal: { value: 100, component: null as ComponentInstance },
        tax: { value: 0, component: null as ComponentInstance },
        total: { value: 0, component: null as ComponentInstance },
      });

      // Behavior: compute tax (10%) and total from subtotal
      const behavior: BehaviorSchemaFn<OrderWithItems> = (path: FieldPath<OrderWithItems>) => {
        // Compute tax as 10% of subtotal (sources, target)
        computeFrom([path.subtotal], path.tax, (values) => values.subtotal * 0.1);

        // Compute total as subtotal + tax (sources, target)
        computeFrom(
          [path.subtotal, path.tax],
          path.total,
          (values) => values.subtotal + values.tax
        );
      };

      form.applyBehaviorSchema(behavior);

      await new Promise((r) => setTimeout(r, 20));

      // Tax = 100 * 0.1 = 10
      expect(form.tax.value.value).toBe(10);

      // Total = 100 + 10 = 110
      expect(form.total.value.value).toBe(110);

      // Change subtotal
      form.subtotal.setValue(200);

      await new Promise((r) => setTimeout(r, 20));

      // Tax = 200 * 0.1 = 20
      expect(form.tax.value.value).toBe(20);

      // Total = 200 + 20 = 220
      expect(form.total.value.value).toBe(220);
    });
  });

  describe('form getValue and patchValue', () => {
    it('should get full form value including nested groups', async () => {
      const form = createForm<ContactForm>({
        name: { value: 'Jane', component: null as ComponentInstance },
        email: { value: 'jane@test.com', component: null as ComponentInstance },
        address: {
          street: { value: '456 Oak Ave', component: null as ComponentInstance },
          city: { value: 'Boston', component: null as ComponentInstance },
          zip: { value: '02101', component: null as ComponentInstance },
        },
        useShippingAddress: { value: true, component: null as ComponentInstance },
        shippingAddress: {
          street: { value: '789 Pine Rd', component: null as ComponentInstance },
          city: { value: 'Chicago', component: null as ComponentInstance },
          zip: { value: '60601', component: null as ComponentInstance },
        },
      });

      const value = form.getValue();

      expect(value.name).toBe('Jane');
      expect(value.email).toBe('jane@test.com');
      expect(value.address.street).toBe('456 Oak Ave');
      expect(value.address.city).toBe('Boston');
      expect(value.address.zip).toBe('02101');
      expect(value.useShippingAddress).toBe(true);
      expect(value.shippingAddress.street).toBe('789 Pine Rd');
      expect(value.shippingAddress.city).toBe('Chicago');
      expect(value.shippingAddress.zip).toBe('60601');
    });

    it('should patch nested values', async () => {
      const form = createForm<ContactForm>({
        name: { value: '', component: null as ComponentInstance },
        email: { value: '', component: null as ComponentInstance },
        address: {
          street: { value: '', component: null as ComponentInstance },
          city: { value: '', component: null as ComponentInstance },
          zip: { value: '', component: null as ComponentInstance },
        },
        useShippingAddress: { value: false, component: null as ComponentInstance },
        shippingAddress: {
          street: { value: '', component: null as ComponentInstance },
          city: { value: '', component: null as ComponentInstance },
          zip: { value: '', component: null as ComponentInstance },
        },
      });

      // Patch values
      form.patchValue({
        name: 'Updated Name',
        address: {
          city: 'San Francisco',
        },
      });

      expect(form.name.value.value).toBe('Updated Name');
      expect(form.address.city.value.value).toBe('San Francisco');
      // Other fields should remain unchanged
      expect(form.email.value.value).toBe('');
      expect(form.address.street.value.value).toBe('');
    });
  });

  describe('form reset', () => {
    it('should reset form to initial values', async () => {
      const form = createForm<ContactForm>({
        name: { value: 'Initial', component: null as ComponentInstance },
        email: { value: 'initial@test.com', component: null as ComponentInstance },
        address: {
          street: { value: 'Initial St', component: null as ComponentInstance },
          city: { value: 'Initial City', component: null as ComponentInstance },
          zip: { value: '00000', component: null as ComponentInstance },
        },
        useShippingAddress: { value: false, component: null as ComponentInstance },
        shippingAddress: {
          street: { value: '', component: null as ComponentInstance },
          city: { value: '', component: null as ComponentInstance },
          zip: { value: '', component: null as ComponentInstance },
        },
      });

      // Change values
      form.name.setValue('Changed');
      form.email.setValue('changed@test.com');
      form.address.city.setValue('Changed City');

      // Verify changes
      expect(form.name.value.value).toBe('Changed');
      expect(form.address.city.value.value).toBe('Changed City');

      // Reset form
      form.reset();

      // Values should be back to initial
      expect(form.name.value.value).toBe('Initial');
      expect(form.email.value.value).toBe('initial@test.com');
      expect(form.address.city.value.value).toBe('Initial City');
    });
  });
});
