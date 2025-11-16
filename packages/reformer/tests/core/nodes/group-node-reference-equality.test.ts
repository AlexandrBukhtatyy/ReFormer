/**
 * Unit tests for GroupNode.value reference equality optimization
 *
 * Tests caching behavior and shallow comparison
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { makeForm } from '../../../src/core/utils/make-form';
import type { GroupNodeWithControls } from '../../../src';
import { ComponentInstance } from '../../test-utils/types';

describe('GroupNode - Reference Equality', () => {
  interface TestForm {
    email: string;
    password: string;
    age: number;
  }

  let form: GroupNodeWithControls<TestForm>;

  beforeEach(() => {
    form = makeForm<TestForm>({
      email: { value: 'test@mail.com', component: null as ComponentInstance },
      password: { value: 'secret', component: null as ComponentInstance },
      age: { value: 25, component: null as ComponentInstance },
    });
  });

  describe('Cache hit (reference equality)', () => {
    it('should return same reference when no fields changed', () => {
      // Первое чтение
      const value1 = form.value.value;

      // Второе чтение без изменений
      const value2 = form.value.value;

      // Должны быть одним и тем же объектом
      expect(value1).toBe(value2);
    });

    it('should return same reference after multiple reads', () => {
      const value1 = form.value.value;
      const value2 = form.value.value;
      const value3 = form.value.value;
      const value4 = form.value.value;

      expect(value1).toBe(value2);
      expect(value2).toBe(value3);
      expect(value3).toBe(value4);
    });

    it('should return same reference when touching field (no value change)', () => {
      const value1 = form.value.value;

      // Touch field (не меняет value)
      form.email.markAsTouched();

      const value2 = form.value.value;

      expect(value1).toBe(value2);
    });

    it('should return same reference when marking as dirty (no value change)', () => {
      const value1 = form.value.value;

      // Mark as dirty (не меняет value)
      form.email.markAsDirty();

      const value2 = form.value.value;

      expect(value1).toBe(value2);
    });
  });

  describe('Cache miss (new reference)', () => {
    it('should return new reference when field value changed', () => {
      const value1 = form.value.value;

      // Изменяем значение поля
      form.email.setValue('new@mail.com');

      const value2 = form.value.value;

      // Должны быть разными объектами
      expect(value1).not.toBe(value2);
      expect(value2.email).toBe('new@mail.com');
    });

    it('should return new reference when any field changed', () => {
      const value1 = form.value.value;

      // Изменяем другое поле
      form.age.setValue(30);

      const value2 = form.value.value;

      expect(value1).not.toBe(value2);
      expect(value2.age).toBe(30);
    });

    it('should return new reference after multiple field changes', () => {
      const value1 = form.value.value;

      form.email.setValue('new1@mail.com');
      const value2 = form.value.value;

      form.password.setValue('new-secret');
      const value3 = form.value.value;

      form.age.setValue(35);
      const value4 = form.value.value;

      // Каждое изменение должно создавать новый объект
      expect(value1).not.toBe(value2);
      expect(value2).not.toBe(value3);
      expect(value3).not.toBe(value4);
    });

    it('should cache new value after change', () => {
      // Изменяем значение
      form.email.setValue('changed@mail.com');

      const value1 = form.value.value;
      const value2 = form.value.value;

      // После изменения новое значение должно кэшироваться
      expect(value1).toBe(value2);
      expect(value1.email).toBe('changed@mail.com');
    });
  });

  describe('setValue() batch updates', () => {
    it('should return same reference after setValue with same values', () => {
      const value1 = form.value.value;

      // Устанавливаем те же значения через setValue
      form.setValue({
        email: 'test@mail.com',
        password: 'secret',
        age: 25,
      });

      const value2 = form.value.value;

      // Должны быть одним объектом (значения не изменились)
      expect(value1).toBe(value2);
    });

    it('should return new reference after setValue with different values', () => {
      const value1 = form.value.value;

      // Устанавливаем новые значения
      form.setValue({
        email: 'new@mail.com',
        password: 'new-secret',
        age: 30,
      });

      const value2 = form.value.value;

      expect(value1).not.toBe(value2);
      expect(value2).toEqual({
        email: 'new@mail.com',
        password: 'new-secret',
        age: 30,
      });
    });
  });

  describe('Nested GroupNode', () => {
    interface NestedForm {
      user: {
        name: string;
        email: string;
      };
      settings: {
        theme: string;
      };
    }

    it('should cache nested group values independently', () => {
      const nestedForm = makeForm<NestedForm>({
        user: {
          name: { value: 'John', component: null as ComponentInstance },
          email: { value: 'john@mail.com', component: null as ComponentInstance },
        },
        settings: {
          theme: { value: 'dark', component: null as ComponentInstance },
        },
      });

      // Читаем значения
      const rootValue1 = nestedForm.value.value;
      const userValue1 = nestedForm.user.value.value;

      // Изменяем поле в user
      nestedForm.user.name.setValue('Jane');

      const rootValue2 = nestedForm.value.value;
      const userValue2 = nestedForm.user.value.value;

      // Root value должен измениться (зависит от user)
      expect(rootValue1).not.toBe(rootValue2);

      // User value должен измениться
      expect(userValue1).not.toBe(userValue2);
    });

    it('should not invalidate cache when unrelated nested field changes', () => {
      const nestedForm = makeForm<NestedForm>({
        user: {
          name: { value: 'John', component: null as ComponentInstance },
          email: { value: 'john@mail.com', component: null as ComponentInstance },
        },
        settings: {
          theme: { value: 'dark', component: null as ComponentInstance },
        },
      });

      const userValue1 = nestedForm.user.value.value;

      // Изменяем settings (не влияет на user)
      nestedForm.settings.theme.setValue('light');

      const userValue2 = nestedForm.user.value.value;

      // User value не должен измениться (кэш user группы не зависит от settings)
      expect(userValue1).toBe(userValue2);
    });
  });

  describe('Edge cases', () => {
    it('should handle empty form', () => {
      interface EmptyForm {}

      const emptyForm = makeForm<EmptyForm>({});

      const value1 = emptyForm.value.value;
      const value2 = emptyForm.value.value;

      expect(value1).toBe(value2);
      expect(value1).toEqual({});
    });

    it('should handle form with single field', () => {
      interface SingleFieldForm {
        name: string;
      }

      const singleForm = makeForm<SingleFieldForm>({
        name: { value: 'test', component: null as ComponentInstance },
      });

      const value1 = singleForm.value.value;
      const value2 = singleForm.value.value;

      expect(value1).toBe(value2);
    });

    it('should handle reset', () => {
      // @ts-ignore
      const value1 = form.value.value;

      // Reset к исходным значениям
      form.reset();

      const value2 = form.value.value;

      // После reset значения те же, но должен создаться новый объект
      // (так как reset вызывает setValue для всех полей)
      expect(value2).toEqual({
        email: 'test@mail.com',
        password: 'secret',
        age: 25,
      });
    });

    it('should handle patchValue with no changes', () => {
      const value1 = form.value.value;

      // Patch с теми же значениями
      form.patchValue({ email: 'test@mail.com' });

      const value2 = form.value.value;

      // Должны быть одним объектом
      expect(value1).toBe(value2);
    });

    it('should handle patchValue with partial changes', () => {
      const value1 = form.value.value;

      // Patch только одного поля
      form.patchValue({ email: 'patched@mail.com' });

      const value2 = form.value.value;

      // Должны быть разными объектами
      expect(value1).not.toBe(value2);
      expect(value2.email).toBe('patched@mail.com');
      expect(value2.password).toBe('secret');
      expect(value2.age).toBe(25);
    });
  });

  describe('Performance characteristics', () => {
    it('should maintain cache across many reads without changes', () => {
      const value1 = form.value.value;

      // Множество чтений
      for (let i = 0; i < 100; i++) {
        const value = form.value.value;
        expect(value).toBe(value1);
      }
    });

    it('should create new objects only when necessary', () => {
      const references = new Set();

      // Читаем без изменений
      references.add(form.value.value);
      references.add(form.value.value);
      references.add(form.value.value);

      expect(references.size).toBe(1); // Только 1 уникальный reference

      // Изменяем
      form.email.setValue('new1@mail.com');
      references.add(form.value.value);
      expect(references.size).toBe(2);

      // Читаем без изменений
      references.add(form.value.value);
      references.add(form.value.value);
      expect(references.size).toBe(2); // Все еще 2

      // Еще одно изменение
      form.password.setValue('new-password');
      references.add(form.value.value);
      expect(references.size).toBe(3);
    });
  });
});
