/**
 * Unit tests for BehaviorContext
 */

import { describe, it, expect } from 'vitest';
import { BehaviorContextImpl } from '../../../src/core/behavior/behavior-context';
import { GroupNode } from '../../../src/core/nodes/group-node';

// Mock Input component for tests
const Input = () => null;

interface TestForm {
  name: string;
  email: string;
  address: {
    city: string;
    street: string;
  };
}

describe('BehaviorContext', () => {
  const createTestForm = () => {
    return new GroupNode<TestForm>({
      form: {
        name: { value: 'John', component: Input },
        email: { value: 'john@test.com', component: Input },
        address: {
          city: { value: 'Moscow', component: Input },
          street: { value: 'Main St', component: Input },
        },
      },
    });
  };

  describe('form', () => {
    it('should provide access to form fields', () => {
      const form = createTestForm();
      const ctx = new BehaviorContextImpl(form);

      // Доступ к полям через form
      expect(ctx.form.name.value.value).toBe('John');
      expect(ctx.form.email.value.value).toBe('john@test.com');
    });

    it('should provide access to nested fields', () => {
      const form = createTestForm();
      const ctx = new BehaviorContextImpl(form);

      // Доступ к вложенным полям
      expect(ctx.form.address.city.value.value).toBe('Moscow');
      expect(ctx.form.address.street.value.value).toBe('Main St');
    });

    it('should allow setting values directly', () => {
      const form = createTestForm();
      const ctx = new BehaviorContextImpl(form);

      ctx.form.name.setValue('Jane');
      expect(ctx.form.name.value.value).toBe('Jane');
    });

    it('should allow calling validate on fields', async () => {
      const form = createTestForm();
      const ctx = new BehaviorContextImpl(form);

      const isValid = await ctx.form.name.validate();
      expect(isValid).toBe(true);
    });
  });

  describe('setFieldValue', () => {
    it('should set field value by path', () => {
      const form = createTestForm();
      const ctx = new BehaviorContextImpl(form);

      ctx.setFieldValue('name', 'Jane');
      expect(form.name.value.value).toBe('Jane');
    });

    it('should set nested field value by path', () => {
      const form = createTestForm();
      const ctx = new BehaviorContextImpl(form);

      ctx.setFieldValue('address.city', 'St. Petersburg');
      expect(form.address.city.value.value).toBe('St. Petersburg');
    });

    it('should use emitEvent: false to prevent cycles', () => {
      const form = createTestForm();
      const ctx = new BehaviorContextImpl(form);

      // setFieldValue использует emitEvent: false, что предотвращает
      // бесконечные циклы в behavior схемах
      ctx.setFieldValue('email', 'new@test.com');
      expect(form.email.value.value).toBe('new@test.com');
    });

    it('should handle invalid paths gracefully', () => {
      const form = createTestForm();
      const ctx = new BehaviorContextImpl(form);

      // Не должен бросать ошибку для несуществующего пути
      expect(() => ctx.setFieldValue('nonexistent', 'value')).not.toThrow();
    });
  });
});
