/**
 * FieldRegistry - тесты
 */

import { describe, it, expect } from 'vitest';
import { FieldRegistry } from '../../../../src/core/nodes/group-node/field-registry';
import { FieldNode } from '../../../../src/core/nodes/field-node';
import { ComponentInstance } from 'packages/reformer/tests/test-utils/types';

describe('FieldRegistry', () => {
  describe('Basic operations', () => {
    it('should create empty registry', () => {
      const registry = new FieldRegistry<{ email: string }>();

      expect(registry.size()).toBe(0);
    });

    it('should set and get field', () => {
      const registry = new FieldRegistry<{ email: string }>();
      const emailField = new FieldNode({
        value: 'test@mail.com',
        component: null as ComponentInstance,
      });

      registry.set('email', emailField);

      expect(registry.get('email')).toBe(emailField);
      expect(registry.size()).toBe(1);
    });

    it('should return undefined for non-existent field', () => {
      const registry = new FieldRegistry<{ email: string; name: string }>();

      expect(registry.get('email')).toBeUndefined();
    });

    it('should check field existence with has()', () => {
      const registry = new FieldRegistry<{ email: string; name: string }>();
      const emailField = new FieldNode({ value: '', component: null as ComponentInstance });

      registry.set('email', emailField);

      expect(registry.has('email')).toBe(true);
      expect(registry.has('name')).toBe(false);
    });

    it('should delete field', () => {
      const registry = new FieldRegistry<{ email: string }>();
      const emailField = new FieldNode({ value: '', component: null as ComponentInstance });

      registry.set('email', emailField);
      expect(registry.has('email')).toBe(true);

      const deleted = registry.delete('email');

      expect(deleted).toBe(true);
      expect(registry.has('email')).toBe(false);
      expect(registry.size()).toBe(0);
    });

    it('should return false when deleting non-existent field', () => {
      const registry = new FieldRegistry<{ email: string }>();

      const deleted = registry.delete('email');

      expect(deleted).toBe(false);
    });

    it('should clear all fields', () => {
      const registry = new FieldRegistry<{ email: string; name: string; age: number }>();
      const emailField = new FieldNode({ value: '', component: null as ComponentInstance });
      const nameField = new FieldNode({ value: '', component: null as ComponentInstance });
      const ageField = new FieldNode({ value: 0, component: null as ComponentInstance });

      registry.set('email', emailField);
      registry.set('name', nameField);
      registry.set('age', ageField);

      expect(registry.size()).toBe(3);

      registry.clear();

      expect(registry.size()).toBe(0);
      expect(registry.has('email')).toBe(false);
      expect(registry.has('name')).toBe(false);
      expect(registry.has('age')).toBe(false);
    });
  });

  describe('Iteration', () => {
    it('should iterate with forEach()', () => {
      const registry = new FieldRegistry<{ email: string; name: string }>();
      const emailField = new FieldNode({
        value: 'test@mail.com',
        component: null as ComponentInstance,
      });
      const nameField = new FieldNode({ value: 'John', component: null as ComponentInstance });

      registry.set('email', emailField);
      registry.set('name', nameField);

      const collected: Array<[string, FieldNode<any>]> = [];
      registry.forEach((field, key) => {
        collected.push([key as string, field]);
      });

      expect(collected).toHaveLength(2);
      expect(collected.some(([key]) => key === 'email')).toBe(true);
      expect(collected.some(([key]) => key === 'name')).toBe(true);
    });

    it('should iterate with values()', () => {
      const registry = new FieldRegistry<{ email: string; name: string }>();
      const emailField = new FieldNode({
        value: 'test@mail.com',
        component: null as ComponentInstance,
      });
      const nameField = new FieldNode({ value: 'John', component: null as ComponentInstance });

      registry.set('email', emailField);
      registry.set('name', nameField);

      const values = Array.from(registry.values());

      expect(values).toHaveLength(2);
      expect(values).toContain(emailField);
      expect(values).toContain(nameField);
    });

    it('should iterate with entries()', () => {
      const registry = new FieldRegistry<{ email: string; name: string }>();
      const emailField = new FieldNode({
        value: 'test@mail.com',
        component: null as ComponentInstance,
      });
      const nameField = new FieldNode({ value: 'John', component: null as ComponentInstance });

      registry.set('email', emailField);
      registry.set('name', nameField);

      const entries = Array.from(registry.entries());

      expect(entries).toHaveLength(2);
      expect(entries.some(([key, field]) => key === 'email' && field === emailField)).toBe(true);
      expect(entries.some(([key, field]) => key === 'name' && field === nameField)).toBe(true);
    });

    it('should iterate with keys()', () => {
      const registry = new FieldRegistry<{ email: string; name: string }>();
      const emailField = new FieldNode({ value: '', component: null as ComponentInstance });
      const nameField = new FieldNode({ value: '', component: null as ComponentInstance });

      registry.set('email', emailField);
      registry.set('name', nameField);

      const keys = Array.from(registry.keys());

      expect(keys).toHaveLength(2);
      expect(keys).toContain('email');
      expect(keys).toContain('name');
    });
  });

  describe('Utility methods', () => {
    it('should convert to array with toArray()', () => {
      const registry = new FieldRegistry<{ email: string; name: string }>();
      const emailField = new FieldNode({
        value: 'test@mail.com',
        component: null as ComponentInstance,
      });
      const nameField = new FieldNode({ value: 'John', component: null as ComponentInstance });

      registry.set('email', emailField);
      registry.set('name', nameField);

      const array = registry.toArray();

      expect(array).toHaveLength(2);
      expect(array).toContain(emailField);
      expect(array).toContain(nameField);
    });

    it('should return Map view with asMap()', () => {
      const registry = new FieldRegistry<{ email: string }>();
      const emailField = new FieldNode({ value: '', component: null as ComponentInstance });

      registry.set('email', emailField);

      const mapView = registry.asMap();

      expect(mapView.get('email')).toBe(emailField);
      expect(mapView.size).toBe(1);
    });
  });

  describe('Multiple fields', () => {
    it('should handle multiple fields correctly', () => {
      const registry = new FieldRegistry<{
        email: string;
        password: string;
        age: number;
        isActive: boolean;
      }>();

      const emailField = new FieldNode({
        value: 'test@mail.com',
        component: null as ComponentInstance,
      });
      const passwordField = new FieldNode({
        value: 'secret',
        component: null as ComponentInstance,
      });
      const ageField = new FieldNode({ value: 25, component: null as ComponentInstance });
      const isActiveField = new FieldNode({ value: true, component: null as ComponentInstance });

      registry.set('email', emailField);
      registry.set('password', passwordField);
      registry.set('age', ageField);
      registry.set('isActive', isActiveField);

      expect(registry.size()).toBe(4);
      expect(registry.get('email')).toBe(emailField);
      expect(registry.get('password')).toBe(passwordField);
      expect(registry.get('age')).toBe(ageField);
      expect(registry.get('isActive')).toBe(isActiveField);
    });

    it('should allow overwriting field', () => {
      const registry = new FieldRegistry<{ email: string }>();
      const field1 = new FieldNode({
        value: 'first@mail.com',
        component: null as ComponentInstance,
      });
      const field2 = new FieldNode({
        value: 'second@mail.com',
        component: null as ComponentInstance,
      });

      registry.set('email', field1);
      expect(registry.get('email')).toBe(field1);

      registry.set('email', field2);
      expect(registry.get('email')).toBe(field2);
      expect(registry.size()).toBe(1); // Размер не изменился
    });
  });

  describe('Edge cases', () => {
    it('should handle empty registry operations', () => {
      const registry = new FieldRegistry<{ email: string }>();

      expect(registry.size()).toBe(0);
      expect(registry.get('email')).toBeUndefined();
      expect(registry.has('email')).toBe(false);
      expect(registry.delete('email')).toBe(false);
      expect(Array.from(registry.values())).toEqual([]);
      expect(Array.from(registry.keys())).toEqual([]);
      expect(Array.from(registry.entries())).toEqual([]);
      expect(registry.toArray()).toEqual([]);
    });

    it('should handle forEach on empty registry', () => {
      const registry = new FieldRegistry<{ email: string }>();

      let callCount = 0;
      registry.forEach(() => {
        callCount++;
      });

      expect(callCount).toBe(0);
    });

    it('should handle clear on empty registry', () => {
      const registry = new FieldRegistry<{ email: string }>();

      expect(() => registry.clear()).not.toThrow();
      expect(registry.size()).toBe(0);
    });
  });

  describe('Type safety', () => {
    it('should maintain type safety with complex types', () => {
      type ComplexForm = {
        user: { name: string; email: string };
        settings: { theme: string };
      };

      const registry = new FieldRegistry<ComplexForm>();
      const userField = new FieldNode({
        value: { name: '', email: '' },
        component: null as ComponentInstance,
      });
      const settingsField = new FieldNode({
        value: { theme: 'dark' },
        component: null as ComponentInstance,
      });

      registry.set('user', userField);
      registry.set('settings', settingsField);

      expect(registry.size()).toBe(2);
      expect(registry.get('user')).toBe(userField);
      expect(registry.get('settings')).toBe(settingsField);
    });
  });
});
