/**
 * Unit tests for FieldNode race condition protection
 *
 * Tests async validation race conditions and validationId protection
 */

import { describe, it, expect, vi } from 'vitest';
import { FieldNode } from '../../../src/core/nodes/field-node';
import type { AsyncValidatorFn } from '../../../src/core/types';

describe('FieldNode - Race Condition Protection', () => {
  describe('Async validation race conditions', () => {
    it('should only apply the latest validation when rapidly changing values', async () => {
      const slowValidator: AsyncValidatorFn<string> = async (value) => {
        await new Promise((resolve) => setTimeout(resolve, 100));
        return value.length < 3 ? { code: 'minLength', message: 'Too short' } : null;
      };

      const field = new FieldNode({
        value: '',
        component: null as any,
        asyncValidators: [slowValidator],
      });

      // Быстро меняем значение 5 раз
      field.setValue('a'); // invalid
      const promise1 = field.validate();

      field.setValue('ab'); // invalid
      const promise2 = field.validate();

      field.setValue('abc'); // valid
      const promise3 = field.validate();

      field.setValue('abcd'); // valid
      const promise4 = field.validate();

      field.setValue('abcde'); // valid - последнее значение
      const promise5 = field.validate();

      // Ждем все валидации
      await Promise.all([promise1, promise2, promise3, promise4, promise5]);

      // Только последняя валидация должна применить результат
      expect(field.value.value).toBe('abcde');
      expect(field.valid.value).toBe(true);
      expect(field.errors.value).toHaveLength(0);
    });

    it('should ignore results from slow validators if value changed', async () => {
      const slowValidator: AsyncValidatorFn<string> = async (value) => {
        return new Promise((resolve) => {
          // Намеренно медленная валидация (500ms)
          setTimeout(() => {
            resolve(value === 'invalid' ? { code: 'custom', message: 'Invalid value' } : null);
          }, 500);
        });
      };

      const field = new FieldNode({
        value: '',
        component: null as any,
        asyncValidators: [slowValidator],
      });

      // Запускаем валидацию с 'invalid'
      field.setValue('invalid');
      const slowPromise = field.validate();

      // Сразу меняем на 'valid' и запускаем новую валидацию
      await new Promise((resolve) => setTimeout(resolve, 50));
      field.setValue('valid');
      const fastPromise = field.validate();

      // Ждем обе валидации
      await Promise.all([slowPromise, fastPromise]);

      // Результат должен быть от последней валидации (valid)
      expect(field.value.value).toBe('valid');
      expect(field.valid.value).toBe(true);
      expect(field.errors.value).toHaveLength(0);
    });

    it('should handle concurrent validations correctly', async () => {
      const validator1: AsyncValidatorFn<string> = async (value) => {
        await new Promise((resolve) => setTimeout(resolve, 50));
        return value === 'error1' ? { code: 'error1', message: 'Error 1' } : null;
      };

      const validator2: AsyncValidatorFn<string> = async (value) => {
        await new Promise((resolve) => setTimeout(resolve, 100));
        return value === 'error2' ? { code: 'error2', message: 'Error 2' } : null;
      };

      const field = new FieldNode({
        value: '',
        component: null as any,
        asyncValidators: [validator1, validator2],
      });

      // Запускаем валидацию с 'error1'
      field.setValue('error1');
      const promise1 = field.validate();

      // Через 60ms меняем на 'error2'
      await new Promise((resolve) => setTimeout(resolve, 60));
      field.setValue('error2');
      const promise2 = field.validate();

      // Ждем обе валидации
      await Promise.all([promise1, promise2]);

      // Должна примениться последняя валидация
      expect(field.value.value).toBe('error2');
      expect(field.errors.value.length).toBeGreaterThan(0);
      expect(field.errors.value[0].code).toBe('error2');
    });

    it('should correctly increment validationId', async () => {
      const field = new FieldNode({
        value: '',
        component: null as any,
        asyncValidators: [
          //@ts-ignore
          async (value) => {
            await new Promise((resolve) => setTimeout(resolve, 10));
            return null;
          },
        ],
      });

      // Запускаем несколько валидаций подряд
      const promises = [];
      for (let i = 0; i < 10; i++) {
        field.setValue(`value-${i}`);
        promises.push(field.validate());
      }

      await Promise.all(promises);

      // Проверяем, что финальное значение корректно
      expect(field.value.value).toBe('value-9');
      expect(field.valid.value).toBe(true);
    });
  });

  describe('Debounced validation race conditions', () => {
    it('should cancel old debounced validations', async () => {
      const validatorCallCount = vi.fn();

      const field = new FieldNode({
        value: '',
        component: null as any,
        asyncValidators: [
          async (value) => {
            validatorCallCount();
            await new Promise((resolve) => setTimeout(resolve, 10));
            return value.length < 3 ? { code: 'minLength', message: 'Too short' } : null;
          },
        ],
        debounce: 100,
      });

      // Быстро меняем значение (внутри debounce периода)
      field.setValue('a');
      const promise1 = field.validate();

      await new Promise((resolve) => setTimeout(resolve, 30));
      field.setValue('ab');
      const promise2 = field.validate();

      await new Promise((resolve) => setTimeout(resolve, 30));
      field.setValue('abc');
      const promise3 = field.validate();

      // Ждем все promises
      await Promise.all([promise1, promise2, promise3]);

      // Валидатор должен вызваться только 1 раз (для последнего значения)
      expect(validatorCallCount).toHaveBeenCalledTimes(1);
      expect(field.value.value).toBe('abc');
      expect(field.valid.value).toBe(true);
    });

    it('should handle validation started during debounce period', async () => {
      const field = new FieldNode({
        value: '',
        component: null as any,
        asyncValidators: [
          async (value) => {
            await new Promise((resolve) => setTimeout(resolve, 10));
            return value === 'error' ? { code: 'error', message: 'Error' } : null;
          },
        ],
        debounce: 100,
      });

      // Запускаем debounced валидацию
      field.setValue('test');
      const promise1 = field.validate();

      // Через 50ms (внутри debounce) запускаем новую валидацию
      await new Promise((resolve) => setTimeout(resolve, 50));
      field.setValue('error');
      const promise2 = field.validate();

      await Promise.all([promise1, promise2]);

      // Должна примениться вторая валидация
      expect(field.value.value).toBe('error');
      expect(field.errors.value.length).toBeGreaterThan(0);
    });

    it('should not apply outdated debounced validation', async () => {
      const field = new FieldNode({
        value: '',
        component: null as any,
        asyncValidators: [
          async (value) => {
            await new Promise((resolve) => setTimeout(resolve, 50));
            return value === 'old' ? { code: 'error', message: 'Error' } : null;
          },
        ],
        debounce: 100,
      });

      // Запускаем debounced валидацию со значением 'old'
      field.setValue('old');
      const oldPromise = field.validate();

      // Через 50ms запускаем новую валидацию со значением 'new'
      await new Promise((resolve) => setTimeout(resolve, 50));
      field.setValue('new');
      const newPromise = field.validate();

      await Promise.all([oldPromise, newPromise]);

      // Старая валидация не должна применить ошибки
      expect(field.value.value).toBe('new');
      expect(field.valid.value).toBe(true);
      expect(field.errors.value).toHaveLength(0);
    });
  });

  describe('Multiple async validators', () => {
    it('should handle race condition with multiple validators', async () => {
      const validator1: AsyncValidatorFn<string> = async (value) => {
        await new Promise((resolve) => setTimeout(resolve, 100));
        return value.length < 3 ? { code: 'minLength', message: 'Too short' } : null;
      };

      const validator2: AsyncValidatorFn<string> = async (value) => {
        await new Promise((resolve) => setTimeout(resolve, 50));
        return value.includes('@') ? null : { code: 'email', message: 'Invalid email' };
      };

      const field = new FieldNode({
        value: '',
        component: null as any,
        asyncValidators: [validator1, validator2],
      });

      // Запускаем валидацию
      field.setValue('ab');
      const promise1 = field.validate();

      // Быстро меняем значение
      await new Promise((resolve) => setTimeout(resolve, 30));
      field.setValue('test@example.com');
      const promise2 = field.validate();

      await Promise.all([promise1, promise2]);

      // Должна примениться последняя валидация (valid)
      expect(field.value.value).toBe('test@example.com');
      expect(field.valid.value).toBe(true);
      expect(field.errors.value).toHaveLength(0);
    });

    it('should run validators in parallel but respect validationId', async () => {
      const callOrder: string[] = [];

      const slowValidator: AsyncValidatorFn<string> = async (value) => {
        callOrder.push(`slow-start-${value}`);
        await new Promise((resolve) => setTimeout(resolve, 100));
        callOrder.push(`slow-end-${value}`);
        return null;
      };

      const fastValidator: AsyncValidatorFn<string> = async (value) => {
        callOrder.push(`fast-start-${value}`);
        await new Promise((resolve) => setTimeout(resolve, 20));
        callOrder.push(`fast-end-${value}`);
        return null;
      };

      const field = new FieldNode({
        value: '',
        component: null as any,
        asyncValidators: [slowValidator, fastValidator],
      });

      // Первая валидация
      field.setValue('first');
      const promise1 = field.validate();

      // Вторая валидация (запускается до завершения первой)
      await new Promise((resolve) => setTimeout(resolve, 50));
      field.setValue('second');
      const promise2 = field.validate();

      await Promise.all([promise1, promise2]);

      // Проверяем порядок вызовов
      expect(callOrder).toContain('slow-start-first');
      expect(callOrder).toContain('fast-start-first');
      expect(callOrder).toContain('slow-start-second');
      expect(callOrder).toContain('fast-start-second');

      // Финальное значение должно быть от последней валидации
      expect(field.value.value).toBe('second');
      expect(field.valid.value).toBe(true);
    });
  });

  describe('Real-world scenarios', () => {
    it('should handle typing simulation (rapid input)', async () => {
      const emailValidator: AsyncValidatorFn<string> = async (value) => {
        // Симуляция проверки email на сервере (200ms)
        await new Promise((resolve) => setTimeout(resolve, 200));
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return emailRegex.test(value) ? null : { code: 'email', message: 'Invalid email' };
      };

      const field = new FieldNode({
        value: '',
        component: null as any,
        asyncValidators: [emailValidator],
        debounce: 300,
      });

      // Симуляция быстрого ввода: t -> te -> tes -> test -> test@
      const typingSequence = ['t', 'te', 'tes', 'test', 'test@', 'test@example.com'];
      const promises = [];

      for (let i = 0; i < typingSequence.length; i++) {
        field.setValue(typingSequence[i]);
        promises.push(field.validate());
        await new Promise((resolve) => setTimeout(resolve, 50)); // Быстрый ввод
      }

      await Promise.all(promises);

      // Должна примениться только последняя валидация
      expect(field.value.value).toBe('test@example.com');
      expect(field.valid.value).toBe(true);
      expect(field.errors.value).toHaveLength(0);
    });

    it('should handle network delay variation', async () => {
      // Симуляция нестабильной сети (разные задержки)
      const createNetworkValidator = (delay: number): AsyncValidatorFn<string> => {
        return async (value) => {
          await new Promise((resolve) => setTimeout(resolve, delay));
          return value === 'error' ? { code: 'network', message: 'Network error' } : null;
        };
      };

      const field = new FieldNode({
        value: '',
        component: null as any,
        asyncValidators: [
          createNetworkValidator(100), // Быстрая сеть
          createNetworkValidator(200), // Медленная сеть
        ],
      });

      // Первая валидация (медленная)
      field.setValue('error');
      const promise1 = field.validate();

      // Через 50ms - вторая валидация (будет быстрее первой)
      await new Promise((resolve) => setTimeout(resolve, 50));
      field.setValue('valid');
      const promise2 = field.validate();

      await Promise.all([promise1, promise2]);

      // Должна примениться вторая валидация, даже если она завершилась раньше
      expect(field.value.value).toBe('valid');
      expect(field.valid.value).toBe(true);
      expect(field.errors.value).toHaveLength(0);
    });

    it('should handle async validation with sync errors', async () => {
      const field = new FieldNode({
        value: '',
        component: null as any,
        validators: [
          (value: string) =>
            value.length < 3 ? { code: 'minLength', message: 'Too short' } : null,
        ],
        asyncValidators: [
          async (value: string) => {
            await new Promise((resolve) => setTimeout(resolve, 100));
            return value.includes('@') ? null : { code: 'email', message: 'No @ symbol' };
          },
        ],
      });

      // Первая валидация (sync error)
      field.setValue('ab');
      const promise1 = field.validate();

      // Быстро меняем на valid значение
      await new Promise((resolve) => setTimeout(resolve, 20));
      field.setValue('test@example.com');
      const promise2 = field.validate();

      await Promise.all([promise1, promise2]);

      // Должна примениться последняя валидация (valid)
      expect(field.value.value).toBe('test@example.com');
      expect(field.valid.value).toBe(true);
      expect(field.errors.value).toHaveLength(0);
    });
  });

  describe('Edge cases', () => {
    it('should handle validation ID overflow correctly', async () => {
      const field = new FieldNode({
        value: '',
        component: null as any,
        asyncValidators: [
          async () => {
            await new Promise((resolve) => setTimeout(resolve, 10));
            return null;
          },
        ],
      });

      // Симулируем большое количество валидаций
      const promises = [];
      for (let i = 0; i < 1000; i++) {
        field.setValue(`value-${i}`);
        promises.push(field.validate());
      }

      await Promise.all(promises);

      expect(field.value.value).toBe('value-999');
      expect(field.valid.value).toBe(true);
    });

    it('should handle validation with no async validators', async () => {
      const field = new FieldNode({
        value: '',
        component: null as any,
        validators: [
          (value: string) =>
            value.length < 3 ? { code: 'minLength', message: 'Too short' } : null,
        ],
      });

      // Быстрое изменение значений
      field.setValue('ab');
      await field.validate();

      field.setValue('abc');
      await field.validate();

      expect(field.value.value).toBe('abc');
      expect(field.valid.value).toBe(true);
    });

    it('should handle dispose during pending validation', async () => {
      const field = new FieldNode({
        value: '',
        component: null as any,
        asyncValidators: [
          async () => {
            await new Promise((resolve) => setTimeout(resolve, 200));
            return null;
          },
        ],
      });

      field.setValue('test');
      const validationPromise = field.validate();

      // Dispose во время валидации
      await new Promise((resolve) => setTimeout(resolve, 50));
      field.dispose();

      // Ждем завершения валидации
      await validationPromise;

      // Поле должно быть disposed, но не должно упасть
      expect(() => field.dispose()).not.toThrow();
    });
  });
});
