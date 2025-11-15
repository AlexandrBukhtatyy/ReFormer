/**
 * Unit tests for ArrayNode
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { ArrayNode } from '../../src/core/nodes/array-node';
import type { BehaviorSchemaFn } from '../../src/core/behavior/types';
import { required, minLength } from '../../src/core/validation/validators';
import type { FieldPath, ValidationSchemaFn } from '../../src/core/types';

describe('ArrayNode', () => {
  interface ItemForm {
    title: string;
    price: number;
  }

  let arrayNode: ArrayNode<ItemForm>;

  beforeEach(() => {
    arrayNode = new ArrayNode<ItemForm>({
      title: { value: '', component: null as any },
      price: { value: 0, component: null as any },
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('CRUD operations', () => {
    it('should push new item', () => {
      expect(arrayNode.length.value).toBe(0);

      arrayNode.push({ title: 'Item 1', price: 100 });

      expect(arrayNode.length.value).toBe(1);
      expect(arrayNode.at(0)?.title.value.value).toBe('Item 1');
      expect(arrayNode.at(0)?.price.value.value).toBe(100);
    });

    it('should push multiple items', () => {
      arrayNode.push({ title: 'Item 1', price: 100 });
      arrayNode.push({ title: 'Item 2', price: 200 });
      arrayNode.push({ title: 'Item 3', price: 300 });

      expect(arrayNode.length.value).toBe(3);
      expect(arrayNode.at(1)?.title.value.value).toBe('Item 2');
    });

    it('should remove item by index', () => {
      arrayNode.push({ title: 'Item 1', price: 100 });
      arrayNode.push({ title: 'Item 2', price: 200 });
      arrayNode.push({ title: 'Item 3', price: 300 });

      arrayNode.removeAt(1);

      expect(arrayNode.length.value).toBe(2);
      expect(arrayNode.at(0)?.title.value.value).toBe('Item 1');
      expect(arrayNode.at(1)?.title.value.value).toBe('Item 3');
    });

    it('should not remove item with invalid index', () => {
      arrayNode.push({ title: 'Item 1', price: 100 });

      const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      arrayNode.removeAt(-1);
      arrayNode.removeAt(10);

      expect(arrayNode.length.value).toBe(1);
      expect(consoleWarnSpy).toHaveBeenCalledTimes(2);
    });

    it('should insert item at specific index', () => {
      arrayNode.push({ title: 'Item 1', price: 100 });
      arrayNode.push({ title: 'Item 3', price: 300 });

      arrayNode.insert(1, { title: 'Item 2', price: 200 });

      expect(arrayNode.length.value).toBe(3);
      expect(arrayNode.at(0)?.title.value.value).toBe('Item 1');
      expect(arrayNode.at(1)?.title.value.value).toBe('Item 2');
      expect(arrayNode.at(2)?.title.value.value).toBe('Item 3');
    });

    it('should insert item at beginning', () => {
      arrayNode.push({ title: 'Item 2', price: 200 });

      arrayNode.insert(0, { title: 'Item 1', price: 100 });

      expect(arrayNode.length.value).toBe(2);
      expect(arrayNode.at(0)?.title.value.value).toBe('Item 1');
    });

    it('should insert item at end', () => {
      arrayNode.push({ title: 'Item 1', price: 100 });

      arrayNode.insert(1, { title: 'Item 2', price: 200 });

      expect(arrayNode.length.value).toBe(2);
      expect(arrayNode.at(1)?.title.value.value).toBe('Item 2');
    });

    it('should not insert item with invalid index', () => {
      arrayNode.push({ title: 'Item 1', price: 100 });

      const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      arrayNode.insert(-1, { title: 'Invalid', price: 0 });
      arrayNode.insert(10, { title: 'Invalid', price: 0 });

      expect(arrayNode.length.value).toBe(1);
      expect(consoleWarnSpy).toHaveBeenCalledTimes(2);
    });

    it('should clear all items', () => {
      arrayNode.push({ title: 'Item 1', price: 100 });
      arrayNode.push({ title: 'Item 2', price: 200 });
      arrayNode.push({ title: 'Item 3', price: 300 });

      expect(arrayNode.length.value).toBe(3);

      arrayNode.clear();

      expect(arrayNode.length.value).toBe(0);
      expect(arrayNode.at(0)).toBeUndefined();
    });

    it('should get item by index using at()', () => {
      arrayNode.push({ title: 'Item 1', price: 100 });
      arrayNode.push({ title: 'Item 2', price: 200 });

      const item = arrayNode.at(1);

      expect(item?.title.value.value).toBe('Item 2');
      expect(item?.price.value.value).toBe(200);
    });

    it('should return undefined for invalid index in at()', () => {
      arrayNode.push({ title: 'Item 1', price: 100 });

      expect(arrayNode.at(-1)).toBeUndefined();
      expect(arrayNode.at(10)).toBeUndefined();
    });
  });

  describe('Reactivity', () => {
    it('should update value signal when items change', () => {
      arrayNode.push({ title: 'Item 1', price: 100 });
      arrayNode.push({ title: 'Item 2', price: 200 });

      expect(arrayNode.value.value).toEqual([
        { title: 'Item 1', price: 100 },
        { title: 'Item 2', price: 200 },
      ]);

      arrayNode.at(0)?.title.setValue('Updated Item 1');

      expect(arrayNode.value.value).toEqual([
        { title: 'Updated Item 1', price: 100 },
        { title: 'Item 2', price: 200 },
      ]);
    });

    it('should update length signal when items are added/removed', () => {
      expect(arrayNode.length.value).toBe(0);

      arrayNode.push({ title: 'Item 1', price: 100 });
      expect(arrayNode.length.value).toBe(1);

      arrayNode.push({ title: 'Item 2', price: 200 });
      expect(arrayNode.length.value).toBe(2);

      arrayNode.removeAt(0);
      expect(arrayNode.length.value).toBe(1);

      arrayNode.clear();
      expect(arrayNode.length.value).toBe(0);
    });

    it('should update valid signal based on item validity', async () => {
      const validationSchema: ValidationSchemaFn<ItemForm> = (path: FieldPath<ItemForm>) => {
        required(path.title, { message: 'Title is required' });
      };

      arrayNode.applyValidationSchema(validationSchema);

      arrayNode.push({ title: 'Item 1', price: 100 });
      arrayNode.push({ title: '', price: 200 }); // Invalid

      await arrayNode.validate();

      expect(arrayNode.valid.value).toBe(false);
      expect(arrayNode.invalid.value).toBe(true);

      // Fix invalid item
      const item = arrayNode.at(1);
      expect(item).toBeDefined();

      item!.title.setValue('Item 2');

      // Важно: сначала нужно очистить старые ошибки перед повторной валидацией
      item!.clearErrors();

      await arrayNode.validate();

      expect(arrayNode.valid.value).toBe(true);
      expect(arrayNode.invalid.value).toBe(false);
    });

    it('should collect errors from all items', async () => {
      const validationSchema: ValidationSchemaFn<ItemForm> = (path: FieldPath<ItemForm>) => {
        required(path.title, { message: 'Title is required' });
        minLength(path.title, 3, { message: 'Min 3 chars' });
      };

      arrayNode.applyValidationSchema(validationSchema);

      arrayNode.push({ title: '', price: 100 }); // 2 errors
      arrayNode.push({ title: 'AB', price: 200 }); // 1 error

      await arrayNode.validate();

      expect(arrayNode.errors.value.length).toBeGreaterThan(0);
    });
  });

  describe('Validation Schema', () => {
    it('should apply validation schema to existing items', async () => {
      arrayNode.push({ title: '', price: 100 });
      arrayNode.push({ title: 'Item 2', price: 200 });

      const validationSchema: ValidationSchemaFn<ItemForm> = (path: FieldPath<ItemForm>) => {
        required(path.title, { message: 'Title is required' });
      };

      arrayNode.applyValidationSchema(validationSchema);

      await arrayNode.validate();

      expect(arrayNode.at(0)?.valid.value).toBe(false); // Empty title
      expect(arrayNode.at(1)?.valid.value).toBe(true); // Valid title
    });

    it('should auto-apply validation schema to new items', async () => {
      const validationSchema: ValidationSchemaFn<ItemForm> = (path: FieldPath<ItemForm>) => {
        required(path.title, { message: 'Title is required' });
      };

      arrayNode.applyValidationSchema(validationSchema);

      // Push new item after applying validation schema
      arrayNode.push({ title: '', price: 100 });

      await arrayNode.validate();

      expect(arrayNode.at(0)?.valid.value).toBe(false);
      expect(arrayNode.at(0)?.errors.value.length).toBeGreaterThan(0);
    });

    it('should auto-apply validation schema to inserted items', async () => {
      const validationSchema: ValidationSchemaFn<ItemForm> = (path: FieldPath<ItemForm>) => {
        required(path.title, { message: 'Title is required' });
      };

      arrayNode.applyValidationSchema(validationSchema);

      arrayNode.push({ title: 'Item 1', price: 100 });

      // Insert new item after applying validation schema
      arrayNode.insert(0, { title: '', price: 50 });

      await arrayNode.validate();

      expect(arrayNode.at(0)?.valid.value).toBe(false);
    });

    it('should validate all items in parallel', async () => {
      const validationSchema: ValidationSchemaFn<ItemForm> = (path: FieldPath<ItemForm>) => {
        required(path.title, { message: 'Title is required' });
      };

      arrayNode.applyValidationSchema(validationSchema);

      arrayNode.push({ title: 'Item 1', price: 100 });
      arrayNode.push({ title: 'Item 2', price: 200 });
      arrayNode.push({ title: '', price: 300 }); // Invalid

      const isValid = await arrayNode.validate();

      expect(isValid).toBe(false);
      expect(arrayNode.valid.value).toBe(false);
    });
  });

  describe('Behavior Schema', () => {
    it('should apply behavior schema to existing items', async () => {
      arrayNode.push({ title: 'item1', price: 100 });
      arrayNode.push({ title: 'item2', price: 200 });

      const behaviorSchema: BehaviorSchemaFn<ItemForm> = (path: FieldPath<ItemForm>) => {
        // Auto-capitalize title
        path.title; // Reference field to register behavior
      };

      arrayNode.applyBehaviorSchema(behaviorSchema);

      // Behavior should be applied
      expect(arrayNode.at(0)?.title.value.value).toBe('item1');
    });

    it('should auto-apply behavior schema to new items pushed', async () => {
      let appliedCount = 0;

      const behaviorSchema: BehaviorSchemaFn<ItemForm> = (path: FieldPath<ItemForm>) => {
        appliedCount++;
        path.title; // Reference field
      };

      arrayNode.applyBehaviorSchema(behaviorSchema);

      const initialCount = appliedCount;

      // Push new item - behavior should auto-apply
      arrayNode.push({ title: 'New Item', price: 500 });

      // Behavior was applied to the new item
      expect(appliedCount).toBeGreaterThan(initialCount);
    });

    it('should auto-apply behavior schema to inserted items', async () => {
      let appliedCount = 0;

      const behaviorSchema: BehaviorSchemaFn<ItemForm> = (path: FieldPath<ItemForm>) => {
        appliedCount++;
        path.title; // Reference field
      };

      arrayNode.applyBehaviorSchema(behaviorSchema);

      arrayNode.push({ title: 'Item 1', price: 100 });

      const countAfterFirst = appliedCount;

      // Insert new item - behavior should auto-apply
      arrayNode.insert(0, { title: 'Inserted Item', price: 50 });

      expect(appliedCount).toBeGreaterThan(countAfterFirst);
    });
  });

  describe('Iteration methods', () => {
    beforeEach(() => {
      arrayNode.push({ title: 'Item 1', price: 100 });
      arrayNode.push({ title: 'Item 2', price: 200 });
      arrayNode.push({ title: 'Item 3', price: 300 });
    });

    it('should iterate with forEach', () => {
      const titles: string[] = [];

      arrayNode.forEach((item, index) => {
        titles.push(item.title.value.value);
        expect(index).toBeGreaterThanOrEqual(0);
        expect(index).toBeLessThan(3);
      });

      expect(titles).toEqual(['Item 1', 'Item 2', 'Item 3']);
    });

    it('should map items to new array', () => {
      const prices = arrayNode.map((item) => item.price.value.value);

      expect(prices).toEqual([100, 200, 300]);
    });

    it('should map items with index', () => {
      const indexed = arrayNode.map((item, index) => ({
        index,
        title: item.title.value.value,
      }));

      expect(indexed).toEqual([
        { index: 0, title: 'Item 1' },
        { index: 1, title: 'Item 2' },
        { index: 2, title: 'Item 3' },
      ]);
    });
  });

  describe('FormNode methods', () => {
    it('should get value with getValue()', () => {
      arrayNode.push({ title: 'Item 1', price: 100 });
      arrayNode.push({ title: 'Item 2', price: 200 });

      const value = arrayNode.getValue();

      expect(value).toEqual([
        { title: 'Item 1', price: 100 },
        { title: 'Item 2', price: 200 },
      ]);
    });

    it('should set value with setValue()', () => {
      arrayNode.setValue([
        { title: 'New Item 1', price: 150 },
        { title: 'New Item 2', price: 250 },
      ]);

      expect(arrayNode.length.value).toBe(2);
      expect(arrayNode.at(0)?.title.value.value).toBe('New Item 1');
      expect(arrayNode.at(1)?.price.value.value).toBe(250);
    });

    it('should replace existing items on setValue()', () => {
      arrayNode.push({ title: 'Old Item', price: 50 });

      arrayNode.setValue([
        { title: 'New Item 1', price: 100 },
        { title: 'New Item 2', price: 200 },
      ]);

      expect(arrayNode.length.value).toBe(2);
      expect(arrayNode.at(0)?.title.value.value).toBe('New Item 1');
    });

    it('should patch values with patchValue()', () => {
      arrayNode.push({ title: 'Item 1', price: 100 });
      arrayNode.push({ title: 'Item 2', price: 200 });

      arrayNode.patchValue([
        { title: 'Updated Item 1', price: 100 } as any, // Partial update via type assertion
        { title: 'Item 2', price: 250 } as any, // Partial update via type assertion
      ]);

      expect(arrayNode.at(0)?.title.value.value).toBe('Updated Item 1');
      expect(arrayNode.at(0)?.price.value.value).toBe(100); // Unchanged

      expect(arrayNode.at(1)?.title.value.value).toBe('Item 2'); // Unchanged
      expect(arrayNode.at(1)?.price.value.value).toBe(250);
    });

    it('should reset with reset()', () => {
      arrayNode.push({ title: 'Item 1', price: 100 });
      arrayNode.push({ title: 'Item 2', price: 200 });

      arrayNode.reset([{ title: 'Reset Item', price: 0 }]);

      expect(arrayNode.length.value).toBe(1);
      expect(arrayNode.at(0)?.title.value.value).toBe('Reset Item');
    });

    it('should clear on reset() without arguments', () => {
      arrayNode.push({ title: 'Item 1', price: 100 });

      arrayNode.reset();

      expect(arrayNode.length.value).toBe(0);
    });

    it('should mark all items as touched', () => {
      arrayNode.push({ title: 'Item 1', price: 100 });
      arrayNode.push({ title: 'Item 2', price: 200 });

      expect(arrayNode.touched.value).toBe(false);

      arrayNode.markAsTouched();

      expect(arrayNode.touched.value).toBe(true);
      expect(arrayNode.at(0)?.touched.value).toBe(true);
      expect(arrayNode.at(1)?.touched.value).toBe(true);
    });

    it('should mark all items as untouched', () => {
      arrayNode.push({ title: 'Item 1', price: 100 });

      arrayNode.markAsTouched();
      expect(arrayNode.touched.value).toBe(true);

      arrayNode.markAsUntouched();

      expect(arrayNode.touched.value).toBe(false);
      expect(arrayNode.at(0)?.touched.value).toBe(false);
    });

    it('should mark all items as dirty', () => {
      arrayNode.push({ title: 'Item 1', price: 100 });
      arrayNode.push({ title: 'Item 2', price: 200 });

      // После push элементы могут быть dirty из-за setValue в createItem
      // Сначала отметим как pristine
      arrayNode.markAsPristine();
      expect(arrayNode.dirty.value).toBe(false);

      arrayNode.markAsDirty();

      expect(arrayNode.dirty.value).toBe(true);
      expect(arrayNode.at(0)?.dirty.value).toBe(true);
      expect(arrayNode.at(1)?.dirty.value).toBe(true);
    });

    it('should mark all items as pristine', () => {
      arrayNode.push({ title: 'Item 1', price: 100 });

      arrayNode.markAsDirty();
      expect(arrayNode.dirty.value).toBe(true);

      arrayNode.markAsPristine();

      expect(arrayNode.dirty.value).toBe(false);
      expect(arrayNode.at(0)?.dirty.value).toBe(false);
    });

    it('should clear errors from all items', async () => {
      const validationSchema: ValidationSchemaFn<ItemForm> = (path: FieldPath<ItemForm>) => {
        required(path.title, { message: 'Title is required' });
      };

      arrayNode.applyValidationSchema(validationSchema);

      arrayNode.push({ title: '', price: 100 });
      arrayNode.push({ title: '', price: 200 });

      await arrayNode.validate();

      expect(arrayNode.errors.value.length).toBeGreaterThan(0);

      arrayNode.clearErrors();

      expect(arrayNode.errors.value.length).toBe(0);
      expect(arrayNode.at(0)?.errors.value.length).toBe(0);
      expect(arrayNode.at(1)?.errors.value.length).toBe(0);
    });
  });

  describe('Initial items', () => {
    it('should create array with initial items', () => {
      const arrayWithInitial = new ArrayNode<ItemForm>(
        {
          title: { value: '', component: null as any },
          price: { value: 0, component: null as any },
        },
        [
          { title: 'Initial 1', price: 100 },
          { title: 'Initial 2', price: 200 },
        ]
      );

      expect(arrayWithInitial.length.value).toBe(2);
      expect(arrayWithInitial.at(0)?.title.value.value).toBe('Initial 1');
      expect(arrayWithInitial.at(1)?.price.value.value).toBe(200);
    });
  });

  describe('watchItems helper', () => {
    it('should watch specific field changes across all items', async () => {
      const callback = vi.fn();

      arrayNode.push({ title: 'Item 1', price: 100 });
      arrayNode.push({ title: 'Item 2', price: 200 });

      const dispose = arrayNode.watchItems('price', callback);

      // Wait for effect to run
      await new Promise((resolve) => setTimeout(resolve, 10));

      expect(callback).toHaveBeenCalled();

      // Change price in first item
      arrayNode.at(0)?.price.setValue(150);

      await new Promise((resolve) => setTimeout(resolve, 10));

      expect(callback).toHaveBeenCalledWith([150, 200]);

      dispose();
    });

    it('should cleanup watchItems on dispose', async () => {
      const callback = vi.fn();

      arrayNode.push({ title: 'Item 1', price: 100 });

      const dispose = arrayNode.watchItems('price', callback);

      await new Promise((resolve) => setTimeout(resolve, 10));
      const callCountBefore = callback.mock.calls.length;

      dispose();

      // Change after dispose - should not trigger callback
      arrayNode.at(0)?.price.setValue(200);

      await new Promise((resolve) => setTimeout(resolve, 10));

      expect(callback.mock.calls.length).toBe(callCountBefore);
    });
  });

  describe('watchLength helper', () => {
    it('should watch array length changes', async () => {
      const callback = vi.fn();

      const dispose = arrayNode.watchLength(callback);

      await new Promise((resolve) => setTimeout(resolve, 10));

      expect(callback).toHaveBeenCalledWith(0);

      arrayNode.push({ title: 'Item 1', price: 100 });

      await new Promise((resolve) => setTimeout(resolve, 10));

      expect(callback).toHaveBeenCalledWith(1);

      arrayNode.push({ title: 'Item 2', price: 200 });

      await new Promise((resolve) => setTimeout(resolve, 10));

      expect(callback).toHaveBeenCalledWith(2);

      arrayNode.removeAt(0);

      await new Promise((resolve) => setTimeout(resolve, 10));

      expect(callback).toHaveBeenCalledWith(1);

      dispose();
    });

    it('should cleanup watchLength on dispose', async () => {
      const callback = vi.fn();

      const dispose = arrayNode.watchLength(callback);

      await new Promise((resolve) => setTimeout(resolve, 10));
      const callCountBefore = callback.mock.calls.length;

      dispose();

      // Change after dispose - should not trigger callback
      arrayNode.push({ title: 'Item 1', price: 100 });

      await new Promise((resolve) => setTimeout(resolve, 10));

      expect(callback.mock.calls.length).toBe(callCountBefore);
    });
  });

  describe('Cleanup (dispose)', () => {
    describe('watchItems() cleanup', () => {
      it('should cleanup watchItems subscription when dispose() is called', () => {
        arrayNode.push({ title: 'Item 1', price: 100 });
        arrayNode.push({ title: 'Item 2', price: 200 });

        const callback = vi.fn();
        arrayNode.watchItems('price', callback);

        // Initial call
        expect(callback).toHaveBeenCalledTimes(1);
        expect(callback).toHaveBeenCalledWith([100, 200]);

        // Change item
        arrayNode.at(0)?.price.setValue(150);
        expect(callback).toHaveBeenCalledTimes(2);
        expect(callback).toHaveBeenCalledWith([150, 200]);

        // Dispose
        arrayNode.dispose();

        // Change after dispose - callback should NOT be called
        arrayNode.at(0)?.price.setValue(999);
        expect(callback).toHaveBeenCalledTimes(2); // Still 2
      });

      it('should cleanup multiple watchItems subscriptions', () => {
        arrayNode.push({ title: 'Item 1', price: 100 });

        const priceCallback = vi.fn();
        const titleCallback = vi.fn();

        arrayNode.watchItems('price', priceCallback);
        arrayNode.watchItems('title', titleCallback);

        expect(priceCallback).toHaveBeenCalledTimes(1);
        expect(titleCallback).toHaveBeenCalledTimes(1);

        // Change items
        arrayNode.at(0)?.price.setValue(200);
        arrayNode.at(0)?.title.setValue('Updated');

        expect(priceCallback).toHaveBeenCalledTimes(2);
        expect(titleCallback).toHaveBeenCalledTimes(2);

        // Dispose
        arrayNode.dispose();

        // Changes after dispose
        arrayNode.at(0)?.price.setValue(300);
        arrayNode.at(0)?.title.setValue('After Dispose');

        expect(priceCallback).toHaveBeenCalledTimes(2);
        expect(titleCallback).toHaveBeenCalledTimes(2);
      });
    });

    describe('watchLength() cleanup', () => {
      it('should cleanup watchLength subscription when dispose() is called', () => {
        const callback = vi.fn();
        arrayNode.watchLength(callback);

        // Initial call
        expect(callback).toHaveBeenCalledTimes(1);
        expect(callback).toHaveBeenCalledWith(0);

        // Add items
        arrayNode.push({ title: 'Item 1', price: 100 });
        expect(callback).toHaveBeenCalledTimes(2);
        expect(callback).toHaveBeenCalledWith(1);

        arrayNode.push({ title: 'Item 2', price: 200 });
        expect(callback).toHaveBeenCalledTimes(3);

        // Dispose
        arrayNode.dispose();

        // Add after dispose - callback should NOT be called
        arrayNode.push({ title: 'Item 3', price: 300 });
        expect(callback).toHaveBeenCalledTimes(3); // Still 3
      });

      it('should cleanup multiple watchLength subscriptions', () => {
        const callback1 = vi.fn();
        const callback2 = vi.fn();
        const callback3 = vi.fn();

        arrayNode.watchLength(callback1);
        arrayNode.watchLength(callback2);
        arrayNode.watchLength(callback3);

        expect(callback1).toHaveBeenCalledTimes(1);
        expect(callback2).toHaveBeenCalledTimes(1);
        expect(callback3).toHaveBeenCalledTimes(1);

        arrayNode.push({ title: 'Item 1', price: 100 });

        expect(callback1).toHaveBeenCalledTimes(2);
        expect(callback2).toHaveBeenCalledTimes(2);
        expect(callback3).toHaveBeenCalledTimes(2);

        // Dispose
        arrayNode.dispose();

        arrayNode.push({ title: 'Item 2', price: 200 });

        expect(callback1).toHaveBeenCalledTimes(2);
        expect(callback2).toHaveBeenCalledTimes(2);
        expect(callback3).toHaveBeenCalledTimes(2);
      });
    });

    describe('recursive cleanup of array items', () => {
      it('should recursively dispose all item GroupNode instances', () => {
        arrayNode.push({ title: 'Item 1', price: 100 });
        arrayNode.push({ title: 'Item 2', price: 200 });

        const callback1 = vi.fn();
        const callback2 = vi.fn();

        // Add watchers to items
        arrayNode.at(0)?.title.watch(callback1);
        arrayNode.at(1)?.price.watch(callback2);

        expect(callback1).toHaveBeenCalledTimes(1);
        expect(callback2).toHaveBeenCalledTimes(1);

        // Dispose parent array
        arrayNode.dispose();

        // Changes to items should NOT trigger watchers
        arrayNode.at(0)?.title.setValue('After Dispose');
        arrayNode.at(1)?.price.setValue(999);

        expect(callback1).toHaveBeenCalledTimes(1); // Still 1
        expect(callback2).toHaveBeenCalledTimes(1); // Still 1
      });

      it('should dispose items added after initial creation', () => {
        const callback = vi.fn();

        // Add item and subscribe
        arrayNode.push({ title: 'Item 1', price: 100 });
        arrayNode.at(0)?.title.watch(callback);

        expect(callback).toHaveBeenCalledTimes(1);

        // Add more items with subscriptions
        arrayNode.push({ title: 'Item 2', price: 200 });
        const callback2 = vi.fn();
        arrayNode.at(1)?.price.watch(callback2);

        // Dispose all
        arrayNode.dispose();

        arrayNode.at(0)?.title.setValue('After');
        arrayNode.at(1)?.price.setValue(999);

        expect(callback).toHaveBeenCalledTimes(1);
        expect(callback2).toHaveBeenCalledTimes(1);
      });
    });

    describe('mixed subscriptions cleanup', () => {
      it('should cleanup both watchItems and watchLength', () => {
        const itemsCallback = vi.fn();
        const lengthCallback = vi.fn();

        arrayNode.watchItems('price', itemsCallback);
        arrayNode.watchLength(lengthCallback);

        arrayNode.push({ title: 'Item 1', price: 100 });

        expect(itemsCallback).toHaveBeenCalledTimes(2); // Initial + push
        expect(lengthCallback).toHaveBeenCalledTimes(2); // Initial + push

        // Dispose
        arrayNode.dispose();

        arrayNode.push({ title: 'Item 2', price: 200 });

        expect(itemsCallback).toHaveBeenCalledTimes(2); // Not triggered
        expect(lengthCallback).toHaveBeenCalledTimes(2); // Not triggered
      });
    });

    describe('edge cases', () => {
      it('should handle dispose() called multiple times', () => {
        const callback = vi.fn();
        arrayNode.watchLength(callback);

        expect(() => {
          arrayNode.dispose();
          arrayNode.dispose();
          arrayNode.dispose();
        }).not.toThrow();

        arrayNode.push({ title: 'Item 1', price: 100 });
        expect(callback).toHaveBeenCalledTimes(1); // Only initial
      });

      it('should handle dispose() on empty array', () => {
        expect(() => arrayNode.dispose()).not.toThrow();
      });

      it('should allow new subscriptions after dispose', () => {
        const callback1 = vi.fn();
        const callback2 = vi.fn();

        arrayNode.watchLength(callback1);
        arrayNode.dispose();

        // Add new subscription after dispose
        arrayNode.watchLength(callback2);

        arrayNode.push({ title: 'Item 1', price: 100 });

        expect(callback1).toHaveBeenCalledTimes(1); // Only initial (before dispose)
        expect(callback2).toHaveBeenCalledTimes(2); // Initial + push

        // Cleanup
        arrayNode.dispose();
      });
    });

    describe('memory leak prevention', () => {
      it('should not accumulate disposers', () => {
        // Create many subscriptions
        for (let i = 0; i < 50; i++) {
          const callback = vi.fn();
          arrayNode.watchLength(callback);
        }

        // Dispose all
        arrayNode.dispose();

        // Verify cleanup by adding new subscription
        const callback = vi.fn();
        arrayNode.watchLength(callback);

        arrayNode.push({ title: 'Item 1', price: 100 });
        expect(callback).toHaveBeenCalledTimes(2); // Should work normally

        arrayNode.dispose();
      });

      it('should handle rapid item additions and disposals', () => {
        // Add many items
        for (let i = 0; i < 100; i++) {
          arrayNode.push({ title: `Item ${i}`, price: i * 100 });
        }

        // Add watchers to each item
        for (let i = 0; i < arrayNode.length.value; i++) {
          const callback = vi.fn();
          arrayNode.at(i)?.title.watch(callback);
        }

        // Dispose should cleanup all
        expect(() => arrayNode.dispose()).not.toThrow();
      });
    });
  });

  describe('disable/enable', () => {
    it('should disable all items in array', () => {
      const arrayNode = new ArrayNode<ItemForm>({
        title: { value: '', component: null as any },
        price: { value: 0, component: null as any },
      });

      arrayNode.push({ title: 'Item 1', price: 100 });
      arrayNode.push({ title: 'Item 2', price: 200 });
      arrayNode.push({ title: 'Item 3', price: 300 });

      // All items should be enabled initially
      arrayNode.forEach((item) => {
        expect(item.status.value).not.toBe('disabled');
      });

      // Disable all
      arrayNode.disable();

      // All items should be disabled
      arrayNode.forEach((item) => {
        expect(item.status.value).toBe('disabled');
      });
    });

    it('should enable all items in array', () => {
      const arrayNode = new ArrayNode<ItemForm>({
        title: { value: '', component: null as any },
        price: { value: 0, component: null as any },
      });

      arrayNode.push({ title: 'Item 1', price: 100 });
      arrayNode.push({ title: 'Item 2', price: 200 });

      // Disable all first
      arrayNode.disable();
      arrayNode.forEach((item) => {
        expect(item.status.value).toBe('disabled');
      });

      // Enable all
      arrayNode.enable();

      // All items should be enabled (valid or invalid, but not disabled)
      arrayNode.forEach((item) => {
        expect(item.status.value).not.toBe('disabled');
      });
    });

    it('should handle disable/enable on empty array', () => {
      const arrayNode = new ArrayNode<ItemForm>({
        title: { value: '', component: null as any },
        price: { value: 0, component: null as any },
      });

      // Should not throw on empty array
      expect(() => arrayNode.disable()).not.toThrow();
      expect(() => arrayNode.enable()).not.toThrow();
    });

    it('should recursively disable nested arrays', () => {
      interface NestedItem {
        title: string;
        subitems: Array<{
          name: string;
        }>;
      }

      const nestedArrayNode = new ArrayNode<NestedItem>({
        title: { value: '', component: null as any },
        subitems: [
          {
            name: { value: '', component: null as any },
          },
        ],
      });

      // Add item with nested array
      nestedArrayNode.push({
        title: 'Parent 1',
        subitems: [{ name: 'Child 1' }, { name: 'Child 2' }],
      });

      // Disable parent array
      nestedArrayNode.disable();

      // Check that nested items are also disabled
      const item = nestedArrayNode.at(0);
      expect(item?.status.value).toBe('disabled');

      // Nested subitems should also be affected
      item?.subitems.forEach((subitem: any) => {
        expect(subitem.status.value).toBe('disabled');
      });
    });

    it('should recursively enable nested arrays', () => {
      interface NestedItem {
        title: string;
        subitems: Array<{
          name: string;
        }>;
      }

      const nestedArrayNode = new ArrayNode<NestedItem>({
        title: { value: '', component: null as any },
        subitems: [
          {
            name: { value: '', component: null as any },
          },
        ],
      });

      // Add item with nested array
      nestedArrayNode.push({
        title: 'Parent 1',
        subitems: [{ name: 'Child 1' }],
      });

      // Disable then enable
      nestedArrayNode.disable();
      nestedArrayNode.enable();

      // Check that nested items are enabled
      const item = nestedArrayNode.at(0);
      expect(item?.status.value).not.toBe('disabled');

      // Nested subitems should also be enabled
      item?.subitems.forEach((subitem: any) => {
        expect(subitem.status.value).not.toBe('disabled');
      });
    });

    it('should work with items added after disable', () => {
      const arrayNode = new ArrayNode<ItemForm>({
        title: { value: '', component: null as any },
        price: { value: 0, component: null as any },
      });

      // Add and disable
      arrayNode.push({ title: 'Item 1', price: 100 });
      arrayNode.disable();

      expect(arrayNode.at(0)?.status.value).toBe('disabled');

      // Add new item after disable
      arrayNode.push({ title: 'Item 2', price: 200 });

      // New item should NOT be disabled (disable was called before it was added)
      expect(arrayNode.at(1)?.status.value).not.toBe('disabled');

      // First item should still be disabled
      expect(arrayNode.at(0)?.status.value).toBe('disabled');
    });

    it('should disable/enable affect validation', async () => {
      const arrayNode = new ArrayNode<ItemForm>({
        title: {
          value: '',
          component: null as any,
          validators: [
            (value: string) =>
              value.length === 0 ? { code: 'required', message: 'Required' } : null,
          ],
        },
        price: { value: 0, component: null as any },
      });

      // Add item with invalid title
      arrayNode.push({ title: '', price: 100 });

      // Validate the item
      await arrayNode.at(0)?.validate();

      // Should be invalid (empty title fails required validation)
      expect(arrayNode.at(0)?.valid.value).toBe(false);

      // Disable
      arrayNode.disable();

      // Should be disabled (not invalid)
      expect(arrayNode.at(0)?.status.value).toBe('disabled');

      // Enable
      arrayNode.enable();

      // Should be invalid again (validation runs on enable)
      // Note: enable() calls validate() in FieldNode
      await arrayNode.at(0)?.validate();
      expect(arrayNode.at(0)?.valid.value).toBe(false);
    });
  });
});
