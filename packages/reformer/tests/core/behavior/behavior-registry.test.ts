/**
 * Unit tests for BehaviorRegistry
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { copyFrom, watchField } from '../../../src/core/behavior/behaviors';
import type { BehaviorSchemaFn } from '../../../src/core/behavior/types';
import type { GroupNodeWithControls } from '../../src';
import { makeForm } from '../../../src/core/utils/make-form';
import type { FieldPath } from '../../../src/core/types';
import { ComponentInstance } from '../../test-utils/types';

describe('BehaviorRegistry', () => {
  interface TestForm {
    email: string;
    copyEmail: string;
    country: string;
    region: string;
  }

  let form: GroupNodeWithControls<TestForm>;

  beforeEach(() => {
    form = makeForm({
      email: { value: '', component: null as ComponentInstance },
      copyEmail: { value: '', component: null as ComponentInstance },
      country: { value: '', component: null as ComponentInstance },
      region: { value: '', component: null as ComponentInstance },
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Registration lifecycle', () => {
    it('should register and apply behaviors', () => {
      const behaviorSchema: BehaviorSchemaFn<TestForm> = (path: FieldPath<TestForm>) => {
        copyFrom(path.copyEmail, path.email);
      };

      const cleanup = form.applyBehaviorSchema(behaviorSchema);

      expect(cleanup).toBeInstanceOf(Function);
    });

    it('should cleanup behaviors when dispose is called', () => {
      const behaviorSchema: BehaviorSchemaFn<TestForm> = (path: FieldPath<TestForm>) => {
        copyFrom(path.copyEmail, path.email);
      };

      const cleanup = form.applyBehaviorSchema(behaviorSchema);

      // Cleanup должен быть вызван без ошибок
      expect(() => cleanup()).not.toThrow();
    });
  });

  describe('copyFrom behavior', () => {
    it('should copy value from source to target', async () => {
      const behaviorSchema: BehaviorSchemaFn<TestForm> = (path: FieldPath<TestForm>) => {
        copyFrom(path.copyEmail, path.email);
      };

      form.applyBehaviorSchema(behaviorSchema);

      // Изменяем source field
      form.email.setValue('test@mail.com');

      // Даем время на выполнение effect
      await new Promise((resolve) => setTimeout(resolve, 10));

      expect(form.copyEmail.value.value).toBe('test@mail.com');
    });

    it('should copy value only when condition is met', async () => {
      let shouldCopy = false;

      const behaviorSchema: BehaviorSchemaFn<TestForm> = (path: FieldPath<TestForm>) => {
        copyFrom(path.copyEmail, path.email, {
          when: () => shouldCopy,
        });
      };

      form.applyBehaviorSchema(behaviorSchema);

      // Условие не выполнено - не должно копировать
      form.email.setValue('test@mail.com');
      await new Promise((resolve) => setTimeout(resolve, 10));
      expect(form.copyEmail.value.value).toBe('');

      // Условие выполнено - должно скопировать
      shouldCopy = true;
      form.email.setValue('test2@mail.com');
      await new Promise((resolve) => setTimeout(resolve, 10));
      expect(form.copyEmail.value.value).toBe('test2@mail.com');
    });
  });

  describe('watchField behavior', () => {
    it('should trigger callback on field change', async () => {
      const callback = vi.fn();

      const behaviorSchema: BehaviorSchemaFn<TestForm> = (path: FieldPath<TestForm>) => {
        watchField(path.country, callback);
      };

      form.applyBehaviorSchema(behaviorSchema);

      form.country.setValue('RU');
      await new Promise((resolve) => setTimeout(resolve, 10));

      expect(callback).toHaveBeenCalledWith('RU', expect.any(Object));
    });

    it('should trigger callback immediately if immediate: true', async () => {
      const callback = vi.fn();

      const behaviorSchema: BehaviorSchemaFn<TestForm> = (path: FieldPath<TestForm>) => {
        watchField(path.country, callback, { immediate: true });
      };

      form.country.setValue('initial');
      form.applyBehaviorSchema(behaviorSchema);

      await new Promise((resolve) => setTimeout(resolve, 10));

      // Должен вызваться сразу с текущим значением
      expect(callback).toHaveBeenCalledWith('initial', expect.any(Object));
    });

    it('should debounce callback if debounce option is set', async () => {
      const callback = vi.fn();

      const behaviorSchema: BehaviorSchemaFn<TestForm> = (path: FieldPath<TestForm>) => {
        watchField(path.country, callback, { debounce: 100 });
      };

      form.applyBehaviorSchema(behaviorSchema);

      // Быстрые изменения
      form.country.setValue('RU');
      form.country.setValue('US');
      form.country.setValue('UK');

      // Callback не должен вызваться сразу
      await new Promise((resolve) => setTimeout(resolve, 50));
      expect(callback).not.toHaveBeenCalled();

      // После debounce должен вызваться один раз с последним значением
      await new Promise((resolve) => setTimeout(resolve, 100));
      expect(callback).toHaveBeenCalledTimes(1);
      expect(callback).toHaveBeenCalledWith('UK', expect.any(Object));
    });
  });

  describe('Cleanup and memory management', () => {
    it('should cleanup debounce timers on dispose', async () => {
      const callback = vi.fn();

      const behaviorSchema: BehaviorSchemaFn<TestForm> = (path: FieldPath<TestForm>) => {
        watchField(path.country, callback, { debounce: 100 });
      };

      const cleanup = form.applyBehaviorSchema(behaviorSchema);

      form.country.setValue('RU');

      // Cleanup до истечения debounce
      cleanup();

      // Callback не должен вызваться
      await new Promise((resolve) => setTimeout(resolve, 150));
      expect(callback).not.toHaveBeenCalled();
    });

    it('should stop effects after cleanup', async () => {
      const callback = vi.fn();

      const behaviorSchema: BehaviorSchemaFn<TestForm> = (path: FieldPath<TestForm>) => {
        watchField(path.country, callback);
      };

      const cleanup = form.applyBehaviorSchema(behaviorSchema);

      form.country.setValue('RU');
      await new Promise((resolve) => setTimeout(resolve, 10));

      const callCountBefore = callback.mock.calls.length;
      expect(callCountBefore).toBeGreaterThan(0); // Был вызван хотя бы раз

      // После cleanup эффекты не должны срабатывать
      cleanup();
      callback.mockClear();

      form.country.setValue('US');
      await new Promise((resolve) => setTimeout(resolve, 10));
      expect(callback).not.toHaveBeenCalled();
    });
  });

  describe('Multiple behaviors', () => {
    it('should handle multiple behaviors on the same form', async () => {
      const callback1 = vi.fn();
      const callback2 = vi.fn();

      const behaviorSchema: BehaviorSchemaFn<TestForm> = (path: FieldPath<TestForm>) => {
        watchField(path.country, callback1);
        watchField(path.region, callback2);
      };

      form.applyBehaviorSchema(behaviorSchema);

      form.country.setValue('RU');
      await new Promise((resolve) => setTimeout(resolve, 10));
      expect(callback1).toHaveBeenCalledWith('RU', expect.any(Object));

      form.region.setValue('Moscow');
      await new Promise((resolve) => setTimeout(resolve, 10));
      expect(callback2).toHaveBeenCalledWith('Moscow', expect.any(Object));
    });

    it('should cleanup all behaviors together', async () => {
      const callback1 = vi.fn();
      const callback2 = vi.fn();

      const behaviorSchema: BehaviorSchemaFn<TestForm> = (path: FieldPath<TestForm>) => {
        watchField(path.country, callback1);
        watchField(path.region, callback2);
      };

      const cleanup = form.applyBehaviorSchema(behaviorSchema);

      form.country.setValue('RU');
      form.region.setValue('Moscow');
      await new Promise((resolve) => setTimeout(resolve, 10));

      expect(callback1).toHaveBeenCalled();
      expect(callback2).toHaveBeenCalled();

      cleanup();
      callback1.mockClear();
      callback2.mockClear();

      form.country.setValue('US');
      form.region.setValue('SPB');
      await new Promise((resolve) => setTimeout(resolve, 10));

      expect(callback1).not.toHaveBeenCalled();
      expect(callback2).not.toHaveBeenCalled();
    });
  });
});
