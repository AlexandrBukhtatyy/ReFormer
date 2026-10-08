/**
 * Unit tests for FormNode.markAsTouched()
 *
 * Tests that markAsTouched() correctly marks all fields as touched recursively
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { signal } from '@preact/signals-core';
import type { ModelArrayNode } from '../../../src/form/nodes/model-array-node';
import { createModel, type FormModel } from '../../../src/model/index';
import { createFormFromModel } from '../../../src/form/create-form';
import { defineValidationSchema, validate, validateModel } from '../../../src/form/validation';
import { required } from '../../../src/form/validators';
import { FieldNode } from '../../../src/form/nodes/field-node';
import type { FormProxy } from '../../../src';
import { ComponentInstance } from '../../test-utils/types';
import { arrayFromFields, formFromFields } from '../../test-utils/form-from-fields';

describe('FormNode - markAsTouched()', () => {
  describe('FieldNode', () => {
    it('should mark field as touched', () => {
      const field = new FieldNode({
        valueSignal: signal(''),
        component: null as ComponentInstance,
      });

      expect(field.touched.value).toBe(false);

      field.markAsTouched();

      expect(field.touched.value).toBe(true);
    });

    it('should be equivalent to markAsTouched', () => {
      const field1 = new FieldNode({
        valueSignal: signal(''),
        component: null as ComponentInstance,
      });

      const field2 = new FieldNode({
        valueSignal: signal(''),
        component: null as ComponentInstance,
      });

      field1.markAsTouched();
      field2.markAsTouched();

      expect(field1.touched.value).toBe(field2.touched.value);
      expect(field1.touched.value).toBe(true);
    });
  });

  describe('GroupNode - simple form', () => {
    interface SimpleForm {
      email: string;
      password: string;
      age: number;
    }

    let form: FormProxy<SimpleForm>;

    beforeEach(() => {
      form = formFromFields({
        email: { value: '', component: null as ComponentInstance },
        password: { value: '', component: null as ComponentInstance },
        age: { value: 0, component: null as ComponentInstance },
      });
    });

    it('should mark all fields as touched', () => {
      expect(form.email.touched.value).toBe(false);
      expect(form.password.touched.value).toBe(false);
      expect(form.age.touched.value).toBe(false);

      form.markAsTouched();

      expect(form.email.touched.value).toBe(true);
      expect(form.password.touched.value).toBe(true);
      expect(form.age.touched.value).toBe(true);
    });

    it('should be equivalent to markAsTouched', () => {
      const form1 = formFromFields({
        email: { value: '', component: null as ComponentInstance },
        password: { value: '', component: null as ComponentInstance },
      });

      const form2 = formFromFields({
        email: { value: '', component: null as ComponentInstance },
        password: { value: '', component: null as ComponentInstance },
      });

      form1.markAsTouched();
      form2.markAsTouched();

      expect(form1.email.touched.value).toBe(form2.email.touched.value);
      expect(form1.password.touched.value).toBe(form2.password.touched.value);
    });
  });

  describe('GroupNode - nested form', () => {
    interface NestedForm {
      user: {
        name: string;
        email: string;
      };
      address: {
        city: string;
        street: string;
      };
    }

    let form: FormProxy<NestedForm>;

    beforeEach(() => {
      form = formFromFields({
        user: {
          name: { value: '', component: null as ComponentInstance },
          email: { value: '', component: null as ComponentInstance },
        },
        address: {
          city: { value: '', component: null as ComponentInstance },
          street: { value: '', component: null as ComponentInstance },
        },
      });
    });

    it('should mark all nested fields as touched', () => {
      expect(form.user.name.touched.value).toBe(false);
      expect(form.user.email.touched.value).toBe(false);
      expect(form.address.city.touched.value).toBe(false);
      expect(form.address.street.touched.value).toBe(false);

      form.markAsTouched();

      expect(form.user.name.touched.value).toBe(true);
      expect(form.user.email.touched.value).toBe(true);
      expect(form.address.city.touched.value).toBe(true);
      expect(form.address.street.touched.value).toBe(true);
    });

    it('should work on nested group', () => {
      expect(form.user.name.touched.value).toBe(false);
      expect(form.user.email.touched.value).toBe(false);

      // Call markAsTouched on nested group
      form.user.markAsTouched();

      expect(form.user.name.touched.value).toBe(true);
      expect(form.user.email.touched.value).toBe(true);

      // Other groups not affected
      expect(form.address.city.touched.value).toBe(false);
      expect(form.address.street.touched.value).toBe(false);
    });
  });

  describe('ModelArrayNode', () => {
    interface ItemForm {
      name: string;
      price: number;
    }

    let arrayNode: ModelArrayNode<ItemForm>;

    beforeEach(() => {
      arrayNode = arrayFromFields<ItemForm>({
        name: { value: '', component: null as ComponentInstance },
        price: { value: 0, component: null as ComponentInstance },
      });

      // Add initial items
      arrayNode.push({ name: 'Item 1', price: 100 });
      arrayNode.push({ name: 'Item 2', price: 200 });
      arrayNode.push({ name: 'Item 3', price: 300 });
    });

    it('should mark all array items as touched', () => {
      expect(arrayNode.at(0)?.name.touched.value).toBe(false);
      expect(arrayNode.at(1)?.name.touched.value).toBe(false);
      expect(arrayNode.at(2)?.name.touched.value).toBe(false);

      arrayNode.markAsTouched();

      expect(arrayNode.at(0)?.name.touched.value).toBe(true);
      expect(arrayNode.at(1)?.name.touched.value).toBe(true);
      expect(arrayNode.at(2)?.name.touched.value).toBe(true);
    });

    it('should mark all fields in all array items', () => {
      arrayNode.markAsTouched();

      // Check all fields in all items
      for (let i = 0; i < 3; i++) {
        expect(arrayNode.at(i)?.name.touched.value).toBe(true);
        expect(arrayNode.at(i)?.price.touched.value).toBe(true);
      }
    });

    it('should work on individual array item', () => {
      const item = arrayNode.at(0);

      expect(item?.name.touched.value).toBe(false);
      expect(item?.price.touched.value).toBe(false);

      // Call markAsTouched on single item
      item?.markAsTouched();

      expect(item?.name.touched.value).toBe(true);
      expect(item?.price.touched.value).toBe(true);

      // Other items not affected
      expect(arrayNode.at(1)?.name.touched.value).toBe(false);
      expect(arrayNode.at(2)?.name.touched.value).toBe(false);
    });
  });

  describe('Complex nested structure', () => {
    interface ComplexForm {
      user: {
        profile: {
          firstName: string;
          lastName: string;
        };
        contacts: Array<{
          type: string;
          value: string;
        }>;
      };
    }

    let form: FormProxy<ComplexForm>;

    beforeEach(() => {
      form = formFromFields({
        user: {
          profile: {
            firstName: { value: '', component: null as ComponentInstance },
            lastName: { value: '', component: null as ComponentInstance },
          },
          contacts: [
            {
              type: { value: 'email', component: null as ComponentInstance },
              value: { value: '', component: null as ComponentInstance },
            },
            {
              type: { value: 'phone', component: null as ComponentInstance },
              value: { value: '', component: null as ComponentInstance },
            },
          ],
        },
      });
    });

    it('should mark all deeply nested fields as touched', () => {
      form.markAsTouched();

      // Nested object fields
      expect(form.user.profile.firstName.touched.value).toBe(true);
      expect(form.user.profile.lastName.touched.value).toBe(true);

      // Array fields (поле `value` затенено `FormNode.value` — берём его через `$`)
      const item0 = form.user.contacts.at(0);
      const item1 = form.user.contacts.at(1);

      expect(item0?.type.touched.value).toBe(true);
      expect(item0?.$.value.touched.value).toBe(true);
      expect(item1?.type.touched.value).toBe(true);
      expect(item1?.$.value.touched.value).toBe(true);
    });

    it('should work on nested group', () => {
      form.user.profile.markAsTouched();

      expect(form.user.profile.firstName.touched.value).toBe(true);
      expect(form.user.profile.lastName.touched.value).toBe(true);

      // Array not affected
      expect(form.user.contacts.at(0)?.type.touched.value).toBe(false);
    });

    it('should work on nested array', () => {
      form.user.contacts.markAsTouched();

      const item0 = form.user.contacts.at(0);
      const item1 = form.user.contacts.at(1);

      expect(item0?.type.touched.value).toBe(true);
      expect(item0?.$.value.touched.value).toBe(true);
      expect(item1?.type.touched.value).toBe(true);
      expect(item1?.$.value.touched.value).toBe(true);

      // Profile not affected
      expect(form.user.profile.firstName.touched.value).toBe(false);
    });
  });

  describe('Use cases', () => {
    interface LoginForm {
      email: string;
      password: string;
    }

    const loginRules = defineValidationSchema<LoginForm>(({ model }) => {
      validate(model.$.email, [required({ message: 'Required' })]);
      validate(model.$.password, [required({ message: 'Required' })]);
    });

    let model: FormModel<LoginForm>;
    let form: FormProxy<LoginForm>;

    beforeEach(() => {
      model = createModel<LoginForm>({ email: '', password: '' });
      form = createFormFromModel<LoginForm>({ model });
    });

    it('should show all errors when markAsTouched is called before validate', async () => {
      // Before markAsTouched - errors not visible
      expect(form.email.shouldShowError.value).toBe(false);
      expect(form.password.shouldShowError.value).toBe(false);

      // Validate to trigger errors
      await validateModel(model, loginRules);

      // Still not visible because not touched
      expect(form.email.shouldShowError.value).toBe(false);
      expect(form.password.shouldShowError.value).toBe(false);

      // Touch all fields
      form.markAsTouched();

      // Now errors are visible
      expect(form.email.shouldShowError.value).toBe(true);
      expect(form.password.shouldShowError.value).toBe(true);
    });

    it('should work with submit flow', async () => {
      const onSubmit = async (values: LoginForm) => values;
      await validateModel(model, loginRules);

      // Submit marks all fields as touched internally
      const result = await form.submit(onSubmit);

      // Form invalid
      expect(result).toBeNull();

      // All fields touched
      expect(form.email.touched.value).toBe(true);
      expect(form.password.touched.value).toBe(true);

      // Errors visible
      expect(form.email.shouldShowError.value).toBe(true);
      expect(form.password.shouldShowError.value).toBe(true);
    });

    it('should be useful for "Validate All" button', async () => {
      // User clicks "Validate All" button
      form.markAsTouched();
      await validateModel(model, loginRules);

      // All errors visible even without submit
      expect(form.valid.value).toBe(false);
      expect(form.email.shouldShowError.value).toBe(true);
      expect(form.password.shouldShowError.value).toBe(true);
    });
  });

  describe('Edge cases', () => {
    it('should work on empty GroupNode', () => {
      const form = formFromFields({});

      expect(() => form.markAsTouched()).not.toThrow();
    });

    it('should work on empty array', () => {
      const arrayNode = arrayFromFields({
        name: { value: '', component: null as ComponentInstance },
      });

      expect(() => arrayNode.markAsTouched()).not.toThrow();
    });

    it('should not affect untouched fields when called on subset', () => {
      interface Form {
        section1: {
          field1: string;
          field2: string;
        };
        section2: {
          field3: string;
        };
      }

      const form = formFromFields<Form>({
        section1: {
          field1: { value: '', component: null as ComponentInstance },
          field2: { value: '', component: null as ComponentInstance },
        },
        section2: {
          field3: { value: '', component: null as ComponentInstance },
        },
      });

      form.section1.markAsTouched();

      expect(form.section1.field1.touched.value).toBe(true);
      expect(form.section1.field2.touched.value).toBe(true);
      expect(form.section2.field3.touched.value).toBe(false);
    });
  });
});
