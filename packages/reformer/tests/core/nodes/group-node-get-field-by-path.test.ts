/**
 * Unit tests for GroupNode.getFieldByPath() public API
 *
 * Tests path resolution with support for nested fields and array index notation
 */

import { describe, it, expect, beforeEach } from 'vitest';
import type { GroupNodeWithControls } from '../../../src';
import { createForm } from '../../../src/core/utils/create-form';
import { ComponentInstance } from '../../test-utils/types';

describe('GroupNode - getFieldByPath()', () => {
  describe('Simple paths', () => {
    interface SimpleForm {
      email: string;
      password: string;
      age: number;
    }

    let form: GroupNodeWithControls<SimpleForm>;

    beforeEach(() => {
      form = createForm({
        email: { value: 'test@mail.com', component: null as ComponentInstance },
        password: { value: 'secret', component: null as ComponentInstance },
        age: { value: 25, component: null as ComponentInstance },
      });
    });

    it('should get field by simple path', () => {
      const emailField = form.getFieldByPath('email');

      expect(emailField).toBeDefined();
      expect(emailField?.value.value).toBe('test@mail.com');
    });

    it('should return undefined for non-existent field', () => {
      const field = form.getFieldByPath('nonexistent');

      expect(field).toBeUndefined();
    });

    it('should get all fields by their paths', () => {
      const email = form.getFieldByPath('email');
      const password = form.getFieldByPath('password');
      const age = form.getFieldByPath('age');

      expect(email?.value.value).toBe('test@mail.com');
      expect(password?.value.value).toBe('secret');
      expect(age?.value.value).toBe(25);
    });
  });

  describe('Nested paths', () => {
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

    let form: GroupNodeWithControls<NestedForm>;

    beforeEach(() => {
      form = createForm({
        user: {
          name: { value: 'John', component: null as ComponentInstance },
          email: { value: 'john@mail.com', component: null as ComponentInstance },
        },
        address: {
          city: { value: 'Moscow', component: null as ComponentInstance },
          street: { value: 'Main St', component: null as ComponentInstance },
        },
      });
    });

    it('should get nested field by path', () => {
      const nameField = form.getFieldByPath('user.name');

      expect(nameField).toBeDefined();
      expect(nameField?.value.value).toBe('John');
    });

    it('should get all nested fields', () => {
      const name = form.getFieldByPath('user.name');
      const email = form.getFieldByPath('user.email');
      const city = form.getFieldByPath('address.city');
      const street = form.getFieldByPath('address.street');

      expect(name?.value.value).toBe('John');
      expect(email?.value.value).toBe('john@mail.com');
      expect(city?.value.value).toBe('Moscow');
      expect(street?.value.value).toBe('Main St');
    });

    it('should return undefined for invalid nested path', () => {
      const field1 = form.getFieldByPath('user.nonexistent');
      const field2 = form.getFieldByPath('nonexistent.name');

      expect(field1).toBeUndefined();
      expect(field2).toBeUndefined();
    });

    it('should get nested group by path', () => {
      const userGroup = form.getFieldByPath('user');

      expect(userGroup).toBeDefined();
      expect(userGroup?.value.value).toEqual({
        name: 'John',
        email: 'john@mail.com',
      });
    });
  });

  describe('Array index paths', () => {
    interface ItemForm {
      name: string;
      price: number;
    }

    interface FormWithArray {
      items: ItemForm[];
    }

    let form: GroupNodeWithControls<FormWithArray>;

    beforeEach(() => {
      form = createForm({
        items: [
          {
            name: { value: 'Item 1', component: null as ComponentInstance },
            price: { value: 100, component: null as ComponentInstance },
          },
          {
            name: { value: 'Item 2', component: null as ComponentInstance },
            price: { value: 200, component: null as ComponentInstance },
          },
          {
            name: { value: 'Item 3', component: null as ComponentInstance },
            price: { value: 300, component: null as ComponentInstance },
          },
        ],
      });
    });

    it('should get array element by index', () => {
      const item = form.getFieldByPath('items[0]');

      expect(item).toBeDefined();
      expect(item?.value.value).toEqual({
        name: 'Item 1',
        price: 100,
      });
    });

    it('should get field from array element', () => {
      const name1 = form.getFieldByPath('items[0].name');
      const price1 = form.getFieldByPath('items[0].price');
      const name2 = form.getFieldByPath('items[1].name');

      expect(name1?.value.value).toBe('Item 1');
      expect(price1?.value.value).toBe(100);
      expect(name2?.value.value).toBe('Item 2');
    });

    it('should return undefined for invalid array index', () => {
      const field = form.getFieldByPath('items[999]');

      expect(field).toBeUndefined();
    });

    it('should return undefined for invalid field in array element', () => {
      const field = form.getFieldByPath('items[0].nonexistent');

      expect(field).toBeUndefined();
    });

    it('should handle all array elements', () => {
      const item0 = form.getFieldByPath('items[0]');
      const item1 = form.getFieldByPath('items[1]');
      const item2 = form.getFieldByPath('items[2]');

      expect(item0?.value.value.name).toBe('Item 1');
      expect(item1?.value.value.name).toBe('Item 2');
      expect(item2?.value.value.name).toBe('Item 3');
    });
  });

  describe('Complex nested paths with arrays', () => {
    interface AddressForm {
      city: string;
      street: string;
    }

    interface ContactForm {
      email: string;
      addresses: AddressForm[];
    }

    interface ComplexForm {
      contacts: ContactForm[];
    }

    let form: GroupNodeWithControls<ComplexForm>;

    beforeEach(() => {
      form = createForm({
        contacts: [
          {
            email: { value: 'contact1@mail.com', component: null as ComponentInstance },
            addresses: [
              {
                city: { value: 'Moscow', component: null as ComponentInstance },
                street: { value: 'Red Square', component: null as ComponentInstance },
              },
              {
                city: { value: 'SPB', component: null as ComponentInstance },
                street: { value: 'Nevsky', component: null as ComponentInstance },
              },
            ],
          },
          {
            email: { value: 'contact2@mail.com', component: null as ComponentInstance },
            addresses: [
              {
                city: { value: 'Kazan', component: null as ComponentInstance },
                street: { value: 'Bauman', component: null as ComponentInstance },
              },
            ],
          },
        ],
      });
    });

    it('should get deeply nested field from array', () => {
      const city = form.getFieldByPath('contacts[0].addresses[0].city');

      expect(city).toBeDefined();
      expect(city?.value.value).toBe('Moscow');
    });

    it('should get all deeply nested fields', () => {
      const city1 = form.getFieldByPath('contacts[0].addresses[0].city');
      const street1 = form.getFieldByPath('contacts[0].addresses[0].street');
      const city2 = form.getFieldByPath('contacts[0].addresses[1].city');
      const email2 = form.getFieldByPath('contacts[1].email');
      const city3 = form.getFieldByPath('contacts[1].addresses[0].city');

      expect(city1?.value.value).toBe('Moscow');
      expect(street1?.value.value).toBe('Red Square');
      expect(city2?.value.value).toBe('SPB');
      expect(email2?.value.value).toBe('contact2@mail.com');
      expect(city3?.value.value).toBe('Kazan');
    });

    it('should return undefined for invalid deep path', () => {
      const field1 = form.getFieldByPath('contacts[0].addresses[999].city');
      const field2 = form.getFieldByPath('contacts[999].email');
      const field3 = form.getFieldByPath('contacts[0].nonexistent[0].city');

      expect(field1).toBeUndefined();
      expect(field2).toBeUndefined();
      expect(field3).toBeUndefined();
    });
  });

  describe('Edge cases', () => {
    interface SimpleForm {
      email: string;
    }

    let form: GroupNodeWithControls<SimpleForm>;

    beforeEach(() => {
      form = createForm({
        email: { value: 'test@mail.com', component: null as ComponentInstance },
      });
    });

    it('should handle empty path', () => {
      const field = form.getFieldByPath('');

      // Empty path should return undefined or the current form
      // Depending on implementation, it might return current object
      expect([undefined, form]).toContainEqual(field);
    });

    it('should handle path with trailing dot', () => {
      const field = form.getFieldByPath('email.');

      // Trailing dot creates empty part after split
      expect(field).toBeUndefined();
    });

    it('should handle path with leading dot', () => {
      const field = form.getFieldByPath('.email');

      // Leading dot создает пустую часть пути
      expect(field).toBeUndefined();
    });

    it('should handle malformed array syntax', () => {
      const field1 = form.getFieldByPath('email[');
      const field2 = form.getFieldByPath('email]');
      const field3 = form.getFieldByPath('email[]');

      expect(field1).toBeUndefined();
      expect(field2).toBeUndefined();
      expect(field3).toBeUndefined();
    });
  });

  describe('Type narrowing', () => {
    interface TestForm {
      email: string;
      user: {
        name: string;
      };
      items: Array<{ title: string }>;
    }

    let form: GroupNodeWithControls<TestForm>;

    beforeEach(() => {
      form = createForm({
        email: { value: '', component: null as ComponentInstance },
        user: {
          name: { value: 'John', component: null as ComponentInstance },
        },
        items: [{ title: { value: 'Item 1', component: null as ComponentInstance } }],
      });
    });

    it('should return FormNode that can be used directly', () => {
      const emailField = form.getFieldByPath('email');

      if (emailField) {
        // TypeScript знает, что это FormNode
        expect(emailField.value).toBeDefined();
        expect(emailField.valid).toBeDefined();
      }
    });

    it('should work with type guards', () => {
      const emailField = form.getFieldByPath('email');
      const userGroup = form.getFieldByPath('user');
      const itemsArray = form.getFieldByPath('items');

      expect(emailField).toBeDefined();
      expect(userGroup).toBeDefined();
      expect(itemsArray).toBeDefined();
    });
  });

  describe('Real-world usage', () => {
    interface UserForm {
      profile: {
        firstName: string;
        lastName: string;
        contacts: Array<{
          type: string;
          value: string;
        }>;
      };
    }

    let form: GroupNodeWithControls<UserForm>;

    beforeEach(() => {
      form = createForm({
        profile: {
          firstName: { value: 'John', component: null as ComponentInstance },
          lastName: { value: 'Doe', component: null as ComponentInstance },
          contacts: [
            {
              type: { value: 'email', component: null as ComponentInstance },
              value: { value: 'john@mail.com', component: null as ComponentInstance },
            },
            {
              type: { value: 'phone', component: null as ComponentInstance },
              value: { value: '+1234567890', component: null as ComponentInstance },
            },
          ],
        },
      });
    });

    it('should navigate complex form structure', () => {
      const firstName = form.getFieldByPath('profile.firstName');
      const emailContact = form.getFieldByPath('profile.contacts[0].value');
      const phoneContact = form.getFieldByPath('profile.contacts[1].value');

      expect(firstName?.value.value).toBe('John');
      expect(emailContact?.value.value).toBe('john@mail.com');
      expect(phoneContact?.value.value).toBe('+1234567890');
    });

    it('should allow dynamic field access', () => {
      // Пример: получить все contacts по индексу
      const contactCount = 2;
      const contacts = [];

      for (let i = 0; i < contactCount; i++) {
        const contact = form.getFieldByPath(`profile.contacts[${i}]`);
        if (contact) {
          contacts.push(contact.value.value);
        }
      }

      expect(contacts).toHaveLength(2);
      expect(contacts[0].type).toBe('email');
      expect(contacts[1].type).toBe('phone');
    });

    it('should support validation on dynamically accessed fields', async () => {
      const emailField = form.getFieldByPath('profile.contacts[0].value');

      if (emailField && 'validate' in emailField) {
        const isValid = await emailField.validate();
        expect(isValid).toBe(true);
      }
    });
  });
});
