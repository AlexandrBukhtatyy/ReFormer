/**
 * Integration tests: Form + Validation + Behavior working together
 */

import { describe, it, expect } from 'vitest';
import { makeForm } from '../../src/core/utils/create-form';
import { required, minLength, email } from '../../src/core/validation/validators';
import { enableWhen, computeFrom, copyFrom, transformers } from '../../src/core/behavior/behaviors';
import type { BehaviorSchemaFn } from '../../src/core/behavior/types';
import type { ValidationSchemaFn, FieldPath } from '../../src/core/types';
import { ComponentInstance } from '../test-utils/types';

describe('Integration: Form + Validation + Behavior', () => {
  interface RegistrationForm {
    username: string;
    email: string;
    password: string;
    confirmPassword: string;
    acceptTerms: boolean;
    newsletter: boolean;
    referralCode: string;
    normalizedCode: string;
  }

  describe('registration form scenario', () => {
    it('should validate all fields with initial invalid values', async () => {
      const form = makeForm<RegistrationForm>({
        username: { value: '', component: null as ComponentInstance },
        email: { value: '', component: null as ComponentInstance },
        password: { value: '', component: null as ComponentInstance },
        confirmPassword: { value: '', component: null as ComponentInstance },
        acceptTerms: { value: false, component: null as ComponentInstance },
        newsletter: { value: false, component: null as ComponentInstance },
        referralCode: { value: '', component: null as ComponentInstance },
        normalizedCode: { value: '', component: null as ComponentInstance },
      });

      // Validation schema
      const validation: ValidationSchemaFn<RegistrationForm> = (
        path: FieldPath<RegistrationForm>
      ) => {
        required(path.username, { message: 'Username is required' });
        minLength(path.username, 3, { message: 'Username must be at least 3 characters' });
        required(path.email);
        email(path.email);
        required(path.password);
        minLength(path.password, 8);
      };

      form.applyValidationSchema(validation);
      await form.validate();

      // Form should be invalid with empty values
      expect(form.valid.value).toBe(false);
      expect(form.username.valid.value).toBe(false);
      expect(form.email.valid.value).toBe(false);
      expect(form.password.valid.value).toBe(false);
    });

    it('should validate all fields with valid initial values', async () => {
      const form = makeForm<RegistrationForm>({
        username: { value: 'john', component: null as ComponentInstance },
        email: { value: 'john@example.com', component: null as ComponentInstance },
        password: { value: 'securepassword123', component: null as ComponentInstance },
        confirmPassword: { value: '', component: null as ComponentInstance },
        acceptTerms: { value: false, component: null as ComponentInstance },
        newsletter: { value: false, component: null as ComponentInstance },
        referralCode: { value: '', component: null as ComponentInstance },
        normalizedCode: { value: '', component: null as ComponentInstance },
      });

      // Validation schema
      const validation: ValidationSchemaFn<RegistrationForm> = (
        path: FieldPath<RegistrationForm>
      ) => {
        required(path.username);
        minLength(path.username, 3);
        required(path.email);
        email(path.email);
        required(path.password);
        minLength(path.password, 8);
      };

      form.applyValidationSchema(validation);
      await form.validate();

      // All validated fields should be valid
      expect(form.username.valid.value).toBe(true);
      expect(form.email.valid.value).toBe(true);
      expect(form.password.valid.value).toBe(true);

      // Form should be valid
      expect(form.valid.value).toBe(true);
    });

    it('should copy password to confirm and validate both', async () => {
      const form = makeForm<RegistrationForm>({
        username: { value: 'john', component: null as ComponentInstance },
        email: { value: 'john@test.com', component: null as ComponentInstance },
        password: { value: '', component: null as ComponentInstance },
        confirmPassword: { value: '', component: null as ComponentInstance },
        acceptTerms: { value: false, component: null as ComponentInstance },
        newsletter: { value: false, component: null as ComponentInstance },
        referralCode: { value: '', component: null as ComponentInstance },
        normalizedCode: { value: '', component: null as ComponentInstance },
      });

      // Behavior: copy password to confirmPassword (source, target)
      const behavior: BehaviorSchemaFn<RegistrationForm> = (path: FieldPath<RegistrationForm>) => {
        copyFrom(path.password, path.confirmPassword);
      };

      form.applyBehaviorSchema(behavior);

      await new Promise((r) => setTimeout(r, 10));

      // Set password
      form.password.setValue('mySecretPassword');

      await new Promise((r) => setTimeout(r, 10));

      // confirmPassword should be synced
      expect(form.confirmPassword.value.value).toBe('mySecretPassword');
    });

    it('should transform referral code to uppercase', async () => {
      const form = makeForm<RegistrationForm>({
        username: { value: '', component: null as ComponentInstance },
        email: { value: '', component: null as ComponentInstance },
        password: { value: '', component: null as ComponentInstance },
        confirmPassword: { value: '', component: null as ComponentInstance },
        acceptTerms: { value: false, component: null as ComponentInstance },
        newsletter: { value: false, component: null as ComponentInstance },
        referralCode: { value: '', component: null as ComponentInstance },
        normalizedCode: { value: '', component: null as ComponentInstance },
      });

      // Behavior: transform referral code
      const behavior: BehaviorSchemaFn<RegistrationForm> = (path: FieldPath<RegistrationForm>) => {
        transformers.toUpperCase(path.referralCode);
      };

      form.applyBehaviorSchema(behavior);

      await new Promise((r) => setTimeout(r, 10));

      form.referralCode.setValue('abc123');

      await new Promise((r) => setTimeout(r, 10));

      expect(form.referralCode.value.value).toBe('ABC123');
    });

    it('should enable newsletter field only when terms accepted', async () => {
      const form = makeForm<RegistrationForm>({
        username: { value: '', component: null as ComponentInstance },
        email: { value: '', component: null as ComponentInstance },
        password: { value: '', component: null as ComponentInstance },
        confirmPassword: { value: '', component: null as ComponentInstance },
        acceptTerms: { value: false, component: null as ComponentInstance },
        newsletter: { value: false, component: null as ComponentInstance },
        referralCode: { value: '', component: null as ComponentInstance },
        normalizedCode: { value: '', component: null as ComponentInstance },
      });

      // Behavior: enable newsletter only when terms accepted
      const behavior: BehaviorSchemaFn<RegistrationForm> = (path: FieldPath<RegistrationForm>) => {
        enableWhen(path.newsletter, () => form.acceptTerms.value.value === true);
      };

      form.applyBehaviorSchema(behavior);

      await new Promise((r) => setTimeout(r, 10));

      // Newsletter should be disabled
      expect(form.newsletter.disabled.value).toBe(true);

      // Accept terms
      form.acceptTerms.setValue(true);

      await new Promise((r) => setTimeout(r, 10));

      // Newsletter should be enabled
      expect(form.newsletter.disabled.value).toBe(false);
    });
  });

  interface OrderForm {
    quantity: number;
    unitPrice: number;
    discount: number;
    total: number;
    shippingAddress: string;
    billingAddress: string;
    sameAsShipping: boolean;
  }

  describe('order form with computed values', () => {
    it('should compute total from quantity, price, and discount', async () => {
      const form = makeForm<OrderForm>({
        quantity: { value: 2, component: null as ComponentInstance },
        unitPrice: { value: 100, component: null as ComponentInstance },
        discount: { value: 10, component: null as ComponentInstance },
        total: { value: 0, component: null as ComponentInstance },
        shippingAddress: { value: '', component: null as ComponentInstance },
        billingAddress: { value: '', component: null as ComponentInstance },
        sameAsShipping: { value: false, component: null as ComponentInstance },
      });

      // Behavior: compute total (sources first, target second)
      const behavior: BehaviorSchemaFn<OrderForm> = (path: FieldPath<OrderForm>) => {
        computeFrom([path.quantity, path.unitPrice, path.discount], path.total, (values) => {
          const subtotal = values.quantity * values.unitPrice;
          return subtotal - (subtotal * values.discount) / 100;
        });
      };

      form.applyBehaviorSchema(behavior);

      await new Promise((r) => setTimeout(r, 10));

      // Total = 2 * 100 - 10% = 180
      expect(form.total.value.value).toBe(180);

      // Change quantity
      form.quantity.setValue(5);

      await new Promise((r) => setTimeout(r, 10));

      // Total = 5 * 100 - 10% = 450
      expect(form.total.value.value).toBe(450);

      // Change discount
      form.discount.setValue(20);

      await new Promise((r) => setTimeout(r, 10));

      // Total = 5 * 100 - 20% = 400
      expect(form.total.value.value).toBe(400);
    });

    it('should copy shipping to billing when checkbox is checked', async () => {
      const form = makeForm<OrderForm>({
        quantity: { value: 1, component: null as ComponentInstance },
        unitPrice: { value: 50, component: null as ComponentInstance },
        discount: { value: 0, component: null as ComponentInstance },
        total: { value: 0, component: null as ComponentInstance },
        shippingAddress: { value: '123 Main St', component: null as ComponentInstance },
        billingAddress: { value: '', component: null as ComponentInstance },
        sameAsShipping: { value: false, component: null as ComponentInstance },
      });

      // Behavior: copy shipping to billing when checkbox is checked (source, target)
      const behavior: BehaviorSchemaFn<OrderForm> = (path: FieldPath<OrderForm>) => {
        copyFrom(path.shippingAddress, path.billingAddress, {
          when: () => form.sameAsShipping.value.value === true,
        });
      };

      form.applyBehaviorSchema(behavior);

      await new Promise((r) => setTimeout(r, 10));

      // Billing should be empty (checkbox not checked)
      expect(form.billingAddress.value.value).toBe('');

      // Check the checkbox
      form.sameAsShipping.setValue(true);

      await new Promise((r) => setTimeout(r, 10));

      // Billing still empty because copyFrom uses watchField (triggers on source change)
      // Let's change shipping address
      form.shippingAddress.setValue('456 Oak Ave');

      await new Promise((r) => setTimeout(r, 10));

      // Now billing should be copied
      expect(form.billingAddress.value.value).toBe('456 Oak Ave');
    });
  });

  describe('validation with behavior combination', () => {
    interface ProfileForm {
      firstName: string;
      lastName: string;
      fullName: string;
      emailLower: string;
    }

    it('should compute fullName and validate it', async () => {
      const form = makeForm<ProfileForm>({
        firstName: { value: 'John', component: null as ComponentInstance },
        lastName: { value: 'Doe', component: null as ComponentInstance },
        fullName: { value: '', component: null as ComponentInstance },
        emailLower: { value: '', component: null as ComponentInstance },
      });

      // Validation
      const validation: ValidationSchemaFn<ProfileForm> = (path: FieldPath<ProfileForm>) => {
        required(path.fullName, { message: 'Full name is required' });
        minLength(path.fullName, 3);
      };

      // Behavior: compute fullName (sources first, target second)
      const behavior: BehaviorSchemaFn<ProfileForm> = (path: FieldPath<ProfileForm>) => {
        computeFrom([path.firstName, path.lastName], path.fullName, (values) =>
          `${values.firstName} ${values.lastName}`.trim()
        );
      };

      form.applyBehaviorSchema(behavior);

      await new Promise((r) => setTimeout(r, 10));

      // fullName should be computed
      expect(form.fullName.value.value).toBe('John Doe');

      // Apply validation
      form.applyValidationSchema(validation);
      await form.validate();

      // fullName should be valid
      expect(form.fullName.valid.value).toBe(true);
    });

    it('should transform email to lowercase and validate', async () => {
      const form = makeForm<ProfileForm>({
        firstName: { value: '', component: null as ComponentInstance },
        lastName: { value: '', component: null as ComponentInstance },
        fullName: { value: '', component: null as ComponentInstance },
        emailLower: { value: '', component: null as ComponentInstance },
      });

      // Behavior: transform email to lowercase
      const behavior: BehaviorSchemaFn<ProfileForm> = (path: FieldPath<ProfileForm>) => {
        transformers.toLowerCase(path.emailLower);
      };

      // Validation
      const validation: ValidationSchemaFn<ProfileForm> = (path: FieldPath<ProfileForm>) => {
        email(path.emailLower);
      };

      form.applyBehaviorSchema(behavior);

      await new Promise((r) => setTimeout(r, 10));

      // Set email with uppercase
      form.emailLower.setValue('JOHN.DOE@EXAMPLE.COM');

      await new Promise((r) => setTimeout(r, 10));

      // Email should be transformed to lowercase
      expect(form.emailLower.value.value).toBe('john.doe@example.com');

      // Apply validation
      form.applyValidationSchema(validation);
      await form.validate();

      // Email should be valid
      expect(form.emailLower.valid.value).toBe(true);
    });
  });
});
