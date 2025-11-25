/**
 * Unit tests for FormNode.resetToInitial()
 *
 * Tests resetting to initial values vs reset() with new values
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { FieldNode } from '../../../src/core/nodes/field-node';
import { ArrayNode } from '../../../src/core/nodes/array-node';
import { makeForm } from '../../../src/core/utils/create-form';
import { ComponentInstance } from '../../test-utils/types';
import { GroupNodeWithControls } from 'packages/reformer/dist';

describe('FormNode - resetToInitial()', () => {
  describe('FieldNode', () => {
    it('should reset to initialValue', () => {
      const field = new FieldNode({
        value: 'initial',
        component: null as ComponentInstance,
      });

      field.setValue('changed');
      expect(field.value.value).toBe('changed');

      field.resetToInitial();
      expect(field.value.value).toBe('initial');
    });

    it('should reset after reset() with new value', () => {
      const field = new FieldNode({
        value: 'initial',
        component: null as ComponentInstance,
      });

      field.setValue('changed');
      field.reset('temp value');
      expect(field.value.value).toBe('temp value');

      // resetToInitial() should restore to 'initial', not 'temp value'
      field.resetToInitial();
      expect(field.value.value).toBe('initial');
    });

    it('should clear validation state', async () => {
      const field = new FieldNode({
        value: '',
        component: null as ComponentInstance,
        validators: [
          (value: string) => (value === '' ? { code: 'required', message: 'Required' } : null),
        ],
      });

      field.setValue('valid');
      field.markAsTouched();
      field.markAsDirty();
      await field.validate();

      expect(field.touched.value).toBe(true);
      expect(field.dirty.value).toBe(true);

      field.resetToInitial();

      expect(field.value.value).toBe('');
      expect(field.touched.value).toBe(false);
      expect(field.dirty.value).toBe(false);
      expect(field.errors.value).toHaveLength(0);
    });
  });

  describe('GroupNode', () => {
    interface TestForm {
      email: string;
      name: string;
      age: number;
    }

    let form: GroupNodeWithControls<TestForm>;

    beforeEach(() => {
      form = makeForm({
        email: { value: 'initial@mail.com', component: null as ComponentInstance },
        name: { value: 'John', component: null as ComponentInstance },
        age: { value: 25, component: null as ComponentInstance },
      });
    });

    it('should reset all fields to initialValues', () => {
      form.email.setValue('changed@mail.com');
      form.name.setValue('Jane');
      form.age.setValue(30);

      expect(form.getValue()).toEqual({
        email: 'changed@mail.com',
        name: 'Jane',
        age: 30,
      });

      form.resetToInitial();

      expect(form.getValue()).toEqual({
        email: 'initial@mail.com',
        name: 'John',
        age: 25,
      });
    });

    it('should reset after reset() with new values', () => {
      form.reset({
        email: 'temp@mail.com',
        name: 'Temp',
        age: 99,
      });

      expect(form.getValue()).toEqual({
        email: 'temp@mail.com',
        name: 'Temp',
        age: 99,
      });

      // resetToInitial() should restore to initial values
      form.resetToInitial();

      expect(form.getValue()).toEqual({
        email: 'initial@mail.com',
        name: 'John',
        age: 25,
      });
    });

    it('should clear validation state for all fields', async () => {
      form.email.markAsTouched();
      form.name.markAsDirty();
      await form.validate();

      expect(form.email.touched.value).toBe(true);
      expect(form.name.dirty.value).toBe(true);

      form.resetToInitial();

      expect(form.email.touched.value).toBe(false);
      expect(form.name.dirty.value).toBe(false);
      expect(form.email.errors.value).toHaveLength(0);
    });
  });

  describe('GroupNode - nested', () => {
    interface NestedForm {
      user: {
        name: string;
        email: string;
      };
      settings: {
        theme: string;
      };
    }

    let form: GroupNodeWithControls<NestedForm>;

    beforeEach(() => {
      form = makeForm({
        user: {
          name: { value: 'Initial Name', component: null as ComponentInstance },
          email: { value: 'initial@mail.com', component: null as ComponentInstance },
        },
        settings: {
          theme: { value: 'light', component: null as ComponentInstance },
        },
      });
    });

    it('should reset nested fields to initialValues', () => {
      form.user.name.setValue('Changed');
      form.user.email.setValue('changed@mail.com');
      form.settings.theme.setValue('dark');

      form.resetToInitial();

      expect(form.user.name.value.value).toBe('Initial Name');
      expect(form.user.email.value.value).toBe('initial@mail.com');
      expect(form.settings.theme.value.value).toBe('light');
    });

    it('should reset nested group independently', () => {
      form.user.name.setValue('Changed');
      form.settings.theme.setValue('dark');

      // Reset only user group
      form.user.resetToInitial();

      expect(form.user.name.value.value).toBe('Initial Name');
      expect(form.settings.theme.value.value).toBe('dark'); // Not affected
    });
  });

  describe('ArrayNode', () => {
    interface ItemForm {
      name: string;
      price: number;
    }

    let arrayNode: ArrayNode<ItemForm>;

    beforeEach(() => {
      arrayNode = new ArrayNode<ItemForm>(
        {
          name: { value: '', component: null as ComponentInstance },
          price: { value: 0, component: null as ComponentInstance },
        },
        [
          { name: 'Initial 1', price: 100 },
          { name: 'Initial 2', price: 200 },
        ]
      );
    });

    it('should reset to initialItems', () => {
      // Modify array
      arrayNode.push({ name: 'New Item', price: 300 });
      expect(arrayNode.length.value).toBe(3);

      arrayNode.resetToInitial();

      expect(arrayNode.length.value).toBe(2);
      expect(arrayNode.at(0)?.name.value.value).toBe('Initial 1');
      expect(arrayNode.at(1)?.name.value.value).toBe('Initial 2');
    });

    it('should reset after reset() with new values', () => {
      arrayNode.reset([{ name: 'Temp 1', price: 999 }]);

      expect(arrayNode.length.value).toBe(1);
      expect(arrayNode.at(0)?.name.value.value).toBe('Temp 1');

      // resetToInitial() should restore initialItems
      arrayNode.resetToInitial();

      expect(arrayNode.length.value).toBe(2);
      expect(arrayNode.at(0)?.name.value.value).toBe('Initial 1');
      expect(arrayNode.at(1)?.name.value.value).toBe('Initial 2');
    });

    it('should reset from empty array', () => {
      arrayNode.clear();
      expect(arrayNode.length.value).toBe(0);

      arrayNode.resetToInitial();

      expect(arrayNode.length.value).toBe(2);
      expect(arrayNode.at(0)?.name.value.value).toBe('Initial 1');
    });

    it('should work with empty initialItems', () => {
      const emptyArray = new ArrayNode<ItemForm>({
        name: { value: '', component: null as ComponentInstance },
        price: { value: 0, component: null as ComponentInstance },
      });

      emptyArray.push({ name: 'Item', price: 100 });
      expect(emptyArray.length.value).toBe(1);

      emptyArray.resetToInitial();

      expect(emptyArray.length.value).toBe(0);
    });
  });

  describe('Real-world scenarios', () => {
    it('should handle Cancel button in form', () => {
      interface UserForm {
        email: string;
        name: string;
        bio: string;
      }

      const form = makeForm<UserForm>({
        email: { value: 'user@example.com', component: null as ComponentInstance },
        name: { value: 'John Doe', component: null as ComponentInstance },
        bio: { value: 'Initial bio', component: null as ComponentInstance },
      });

      // User edits form
      form.email.setValue('newemail@example.com');
      form.name.setValue('Jane Doe');
      form.bio.setValue('New bio text');

      // User clicks Cancel button
      form.resetToInitial();

      // Form restored to initial state
      expect(form.getValue()).toEqual({
        email: 'user@example.com',
        name: 'John Doe',
        bio: 'Initial bio',
      });
    });

    it('should handle dynamic form with array', () => {
      interface TodoForm {
        title: string;
        items: Array<{ task: string; done: boolean }>;
      }

      const form = makeForm<TodoForm>({
        title: { value: 'My TODO List', component: null as ComponentInstance },
        items: [
          {
            task: { value: 'Initial task', component: null as ComponentInstance },
            done: { value: false, component: null as ComponentInstance },
          },
        ],
      });

      // User modifies
      form.title.setValue('Changed Title');
      form.items.push({ task: 'New task', done: false });
      form.items.at(0)?.task.setValue('Modified task');

      // Cancel changes
      form.resetToInitial();

      expect(form.title.value.value).toBe('My TODO List');
      expect(form.items.length.value).toBe(1);
      expect(form.items.at(0)?.task.value.value).toBe('Initial task');
    });

    it('should handle reset vs resetToInitial flow', () => {
      const field = new FieldNode({
        value: 'original',
        component: null as ComponentInstance,
      });

      // Scenario 1: User makes change
      field.setValue('user change');
      expect(field.value.value).toBe('user change');

      // Scenario 2: Server updates value via reset()
      field.reset('server value');
      expect(field.value.value).toBe('server value');

      // Scenario 3: User cancels and wants original
      field.resetToInitial();
      expect(field.value.value).toBe('original'); // Back to initial, not server value
    });
  });

  describe('Edge cases', () => {
    it('should work when initial value is null', () => {
      const field = new FieldNode<string | null>({
        value: null,
        component: null as ComponentInstance,
      });

      field.setValue('changed');
      field.resetToInitial();

      expect(field.value.value).toBeNull();
    });

    it('should work when initial value is empty string', () => {
      const field = new FieldNode({
        value: '',
        component: null as ComponentInstance,
      });

      field.setValue('changed');
      field.resetToInitial();

      expect(field.value.value).toBe('');
    });

    it('should work when initial value is 0', () => {
      const field = new FieldNode({
        value: 0,
        component: null as ComponentInstance,
      });

      field.setValue(100);
      field.resetToInitial();

      expect(field.value.value).toBe(0);
    });

    it('should work multiple times', () => {
      const field = new FieldNode({
        value: 'initial',
        component: null as ComponentInstance,
      });

      // First reset
      field.setValue('change1');
      field.resetToInitial();
      expect(field.value.value).toBe('initial');

      // Second reset
      field.setValue('change2');
      field.resetToInitial();
      expect(field.value.value).toBe('initial');

      // Third reset
      field.reset('temp');
      field.resetToInitial();
      expect(field.value.value).toBe('initial');
    });
  });
});
