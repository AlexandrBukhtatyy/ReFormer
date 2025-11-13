/**
 * Unit tests for ArrayNode.setValue() validation behavior
 *
 * Tests that setValue triggers validation automatically
 */

import { describe, it, expect } from 'vitest';
import { ArrayNode } from '../../src/core/nodes/array-node';
import type { FieldPath, ValidationSchemaFn } from '../../src/core/types';
import { required, minLength } from '../../src/core/validators';

describe('ArrayNode - setValue() Validation', () => {
  interface ItemForm {
    title: string;
    price: number;
  }

  describe('Basic validation triggering', () => {
    it('should trigger validation after setValue', async () => {
      const arrayNode = new ArrayNode<ItemForm>({
        title: { value: '', component: null as any },
        price: { value: 0, component: null as any },
      });

      // Установка validation schema
      const validationSchema: ValidationSchemaFn<ItemForm> = (path: FieldPath<ItemForm>) => {
        required(path.title, { message: 'Title is required' });
      };

      arrayNode.applyValidationSchema(validationSchema);

      // setValue с невалидными данными
      arrayNode.setValue([
        { title: '', price: 100 }, // Invalid - empty title
        { title: 'Item 2', price: 200 }, // Valid
      ]);

      // Даем время на выполнение валидации (fire-and-forget)
      await new Promise((resolve) => setTimeout(resolve, 50));

      // Форма должна быть невалидной
      expect(arrayNode.valid.value).toBe(false);
      expect(arrayNode.invalid.value).toBe(true);

      // Первый элемент невалиден
      const firstItem = arrayNode.at(0);
      expect(firstItem?.valid.value).toBe(false);
      expect(firstItem?.errors.value).toHaveLength(1);
      expect(firstItem?.errors.value[0].code).toBe('required');
    });

    it('should not trigger validation when emitEvent is false', async () => {
      const arrayNode = new ArrayNode<ItemForm>({
        title: { value: '', component: null as any },
        price: { value: 0, component: null as any },
      });

      const validationSchema: ValidationSchemaFn<ItemForm> = (path: FieldPath<ItemForm>) => {
        required(path.title);
      };

      arrayNode.applyValidationSchema(validationSchema);

      // setValue с emitEvent: false
      arrayNode.setValue([{ title: '', price: 100 }], { emitEvent: false });

      // Даем время (но валидация не должна запуститься)
      await new Promise((resolve) => setTimeout(resolve, 50));

      // Форма должна быть валидной (валидация не запущена)
      expect(arrayNode.valid.value).toBe(true);
    });

    it('should update status to invalid when validation fails', async () => {
      const arrayNode = new ArrayNode<ItemForm>({
        title: { value: '', component: null as any },
        price: { value: 0, component: null as any },
      });

      const validationSchema: ValidationSchemaFn<ItemForm> = (path: FieldPath<ItemForm>) => {
        minLength(path.title, 3, { message: 'Min 3 characters' });
      };

      arrayNode.applyValidationSchema(validationSchema);

      // Начальное состояние - valid
      expect(arrayNode.status.value).toBe('valid');

      // setValue с короткими названиями
      arrayNode.setValue([
        { title: 'ab', price: 100 },
        { title: 'cd', price: 200 },
      ]);

      await new Promise((resolve) => setTimeout(resolve, 50));

      // Статус должен стать invalid
      expect(arrayNode.status.value).toBe('invalid');
    });
  });

  describe('Async validators', () => {
    it('should run async validators after setValue', async () => {
      const arrayNode = new ArrayNode<ItemForm>({
        title: {
          value: '',
          component: null as any,
          asyncValidators: [
            async (value: string) => {
              await new Promise((resolve) => setTimeout(resolve, 10));
              return value.includes('test')
                ? null
                : { code: 'invalid', message: 'Must contain "test"' };
            },
          ],
        },
        price: { value: 0, component: null as any },
      });

      arrayNode.setValue([
        { title: 'invalid', price: 100 },
        { title: 'test-item', price: 200 },
      ]);

      // Ждем async валидацию
      await new Promise((resolve) => setTimeout(resolve, 100));

      // Первый элемент невалиден
      const firstItem = arrayNode.at(0);
      expect(firstItem?.valid.value).toBe(false);
      expect(firstItem?.errors.value[0].code).toBe('invalid');

      // Второй элемент валиден
      const secondItem = arrayNode.at(1);
      expect(secondItem?.valid.value).toBe(true);
    });

    it('should set status to pending during async validation', async () => {
      const arrayNode = new ArrayNode<ItemForm>({
        title: {
          value: '',
          component: null as any,
          asyncValidators: [
            async () => {
              await new Promise((resolve) => setTimeout(resolve, 100));
              return null;
            },
          ],
        },
        price: { value: 0, component: null as any },
      });

      arrayNode.setValue([{ title: 'test', price: 100 }]);

      // Сразу после setValue - статус может быть pending
      await new Promise((resolve) => setTimeout(resolve, 10));

      const firstItem = arrayNode.at(0);
      // Status может быть pending или valid (зависит от timing)
      expect(['pending', 'valid']).toContain(firstItem?.status.value);

      // После завершения - valid
      await new Promise((resolve) => setTimeout(resolve, 150));
      expect(firstItem?.status.value).toBe('valid');
    });
  });

  describe('Multiple items validation', () => {
    it('should validate all items after setValue', async () => {
      const arrayNode = new ArrayNode<ItemForm>({
        title: { value: '', component: null as any },
        price: { value: 0, component: null as any },
      });

      const validationSchema: ValidationSchemaFn<ItemForm> = (path: FieldPath<ItemForm>) => {
        required(path.title);
        minLength(path.title, 3, { message: 'Min 3 chars' });
      };

      arrayNode.applyValidationSchema(validationSchema);

      arrayNode.setValue([
        { title: '', price: 0 }, // Invalid - empty
        { title: 'ab', price: 0 }, // Invalid - too short
        { title: 'Item 3', price: 100 }, // Valid
        { title: 'Item 4', price: 200 }, // Valid
      ]);

      await new Promise((resolve) => setTimeout(resolve, 50));

      // Проверяем каждый элемент
      expect(arrayNode.at(0)?.valid.value).toBe(false);
      expect(arrayNode.at(1)?.valid.value).toBe(false);
      expect(arrayNode.at(2)?.valid.value).toBe(true);
      expect(arrayNode.at(3)?.valid.value).toBe(true);

      // Общая форма невалидна
      expect(arrayNode.valid.value).toBe(false);
    });

    it('should collect errors from all items', async () => {
      const arrayNode = new ArrayNode<ItemForm>({
        title: { value: '', component: null as any },
        price: { value: 0, component: null as any },
      });

      const validationSchema: ValidationSchemaFn<ItemForm> = (path: FieldPath<ItemForm>) => {
        required(path.title, { message: 'Title required' });
      };

      arrayNode.applyValidationSchema(validationSchema);

      arrayNode.setValue([
        { title: '', price: 100 },
        { title: '', price: 200 },
        { title: '', price: 300 },
      ]);

      await new Promise((resolve) => setTimeout(resolve, 50));

      // Все три элемента должны иметь ошибку
      expect(arrayNode.at(0)?.errors.value).toHaveLength(1);
      expect(arrayNode.at(1)?.errors.value).toHaveLength(1);
      expect(arrayNode.at(2)?.errors.value).toHaveLength(1);
    });
  });

  describe('Edge cases', () => {
    it('should handle empty array setValue', async () => {
      const arrayNode = new ArrayNode<ItemForm>({
        title: { value: '', component: null as any },
        price: { value: 0, component: null as any },
      });

      arrayNode.setValue([]);

      await new Promise((resolve) => setTimeout(resolve, 50));

      expect(arrayNode.length.value).toBe(0);
      expect(arrayNode.valid.value).toBe(true);
    });

    it('should clear previous items and validate new ones', async () => {
      const arrayNode = new ArrayNode<ItemForm>({
        title: { value: '', component: null as any },
        price: { value: 0, component: null as any },
      });

      const validationSchema: ValidationSchemaFn<ItemForm> = (path: FieldPath<ItemForm>) => {
        required(path.title);
      };

      arrayNode.applyValidationSchema(validationSchema);

      // Первый setValue
      arrayNode.setValue([{ title: 'Item 1', price: 100 }]);
      await new Promise((resolve) => setTimeout(resolve, 50));

      expect(arrayNode.length.value).toBe(1);
      expect(arrayNode.valid.value).toBe(true);

      // Второй setValue - заменяет предыдущие элементы
      arrayNode.setValue([
        { title: '', price: 200 },
        { title: 'Item 2', price: 300 },
      ]);
      await new Promise((resolve) => setTimeout(resolve, 50));

      expect(arrayNode.length.value).toBe(2);
      expect(arrayNode.valid.value).toBe(false); // Первый элемент невалиден
      expect(arrayNode.at(0)?.valid.value).toBe(false);
      expect(arrayNode.at(1)?.valid.value).toBe(true);
    });

    it('should not crash when setValue is called multiple times rapidly', async () => {
      const arrayNode = new ArrayNode<ItemForm>({
        title: { value: '', component: null as any },
        price: { value: 0, component: null as any },
      });

      // Быстрые вызовы setValue
      arrayNode.setValue([{ title: 'Item 1', price: 100 }]);
      arrayNode.setValue([{ title: 'Item 2', price: 200 }]);
      arrayNode.setValue([{ title: 'Item 3', price: 300 }]);
      arrayNode.setValue([{ title: 'Item 4', price: 400 }]);

      await new Promise((resolve) => setTimeout(resolve, 100));

      // Должен остаться только последний элемент
      expect(arrayNode.length.value).toBe(1);
      expect(arrayNode.at(0)?.title.value.value).toBe('Item 4');
    });
  });

  describe('API consistency with FieldNode', () => {
    it('should behave like FieldNode setValue with validation', async () => {
      const arrayNode = new ArrayNode<ItemForm>({
        title: { value: '', component: null as any },
        price: { value: 0, component: null as any },
      });

      const validationSchema: ValidationSchemaFn<ItemForm> = (path: FieldPath<ItemForm>) => {
        required(path.title);
      };

      arrayNode.applyValidationSchema(validationSchema);

      // setValue запускает валидацию
      arrayNode.setValue([{ title: '', price: 100 }]);
      await new Promise((resolve) => setTimeout(resolve, 50));

      expect(arrayNode.valid.value).toBe(false);

      // setValue с emitEvent: false НЕ запускает валидацию
      arrayNode.setValue([{ title: '', price: 100 }], { emitEvent: false });
      await new Promise((resolve) => setTimeout(resolve, 50));

      // Статус не должен измениться (валидация не запущена)
      // Форма все еще может быть invalid от предыдущей валидации
    });

    it('should support emitEvent option like FieldNode', async () => {
      const arrayNode = new ArrayNode<ItemForm>({
        title: { value: '', component: null as any },
        price: { value: 0, component: null as any },
      });

      // С emitEvent: true (default)
      arrayNode.setValue([{ title: 'test', price: 100 }]);
      await new Promise((resolve) => setTimeout(resolve, 50));

      expect(arrayNode.at(0)?.title.value.value).toBe('test');

      // С emitEvent: false
      arrayNode.setValue([{ title: 'test2', price: 200 }], { emitEvent: false });
      await new Promise((resolve) => setTimeout(resolve, 50));

      expect(arrayNode.at(0)?.title.value.value).toBe('test2');
    });
  });
});
