/**
 * Date validator
 */

import { validate } from '../core/validate';
import type { ValidateOptions } from '../../types/validation-schema';
import type { FieldPathNode } from '../../types';

/**
 * Адаптер для date валидатора
 * Проверяет, что значение является валидной датой и соответствует ограничениям
 *
 * @example
 * ```typescript
 * date(path.birthDate);
 * date(path.birthDate, { maxDate: new Date() }); // Не позже сегодня
 * date(path.eventDate, { minDate: new Date(), message: 'Дата не может быть в прошлом' });
 * date(path.age, { minAge: 18, maxAge: 100 });
 * ```
 */
export function date<TForm, TField extends string | Date | undefined = string | Date>(
  fieldPath: FieldPathNode<TForm, TField> | undefined,
  options?: ValidateOptions & {
    /** Минимальная дата (включительно) */
    minDate?: Date;
    /** Максимальная дата (включительно) */
    maxDate?: Date;
    /** Минимальный возраст (для дат рождения) */
    minAge?: number;
    /** Максимальный возраст (для дат рождения) */
    maxAge?: number;
    /** Не разрешать будущие даты */
    noFuture?: boolean;
    /** Не разрешать прошлые даты */
    noPast?: boolean;
  }
): void {
  if (!fieldPath) return; // Защита от undefined fieldPath

  validate(fieldPath as any, (ctx) => {
    const value = ctx.value();

    // Пропускаем null/undefined
    if (!value) {
      return null;
    }

    // Конвертируем в Date
    let dateValue: Date;
    if (value instanceof Date) {
      dateValue = value;
    } else if (typeof value === 'string') {
      dateValue = new Date(value);
    } else {
      return {
        code: 'date_invalid',
        message: options?.message || 'Неверный формат даты',
        params: options?.params,
      };
    }

    // Проверка на валидность даты
    if (isNaN(dateValue.getTime())) {
      return {
        code: 'date_invalid',
        message: options?.message || 'Неверный формат даты',
        params: options?.params,
      };
    }

    const now = new Date();
    now.setHours(0, 0, 0, 0);

    // Проверка минимальной даты
    if (options?.minDate) {
      const minDate = new Date(options.minDate);
      minDate.setHours(0, 0, 0, 0);
      if (dateValue < minDate) {
        return {
          code: 'date_min',
          message: options?.message || `Дата должна быть не ранее ${minDate.toLocaleDateString()}`,
          params: { minDate: options.minDate, ...options?.params },
        };
      }
    }

    // Проверка максимальной даты
    if (options?.maxDate) {
      const maxDate = new Date(options.maxDate);
      maxDate.setHours(0, 0, 0, 0);
      if (dateValue > maxDate) {
        return {
          code: 'date_max',
          message:
            options?.message || `Дата должна быть не позднее ${maxDate.toLocaleDateString()}`,
          params: { maxDate: options.maxDate, ...options?.params },
        };
      }
    }

    // Проверка на будущую дату
    if (options?.noFuture && dateValue > now) {
      return {
        code: 'date_future',
        message: options?.message || 'Дата не может быть в будущем',
        params: options?.params,
      };
    }

    // Проверка на прошлую дату
    if (options?.noPast && dateValue < now) {
      return {
        code: 'date_past',
        message: options?.message || 'Дата не может быть в прошлом',
        params: options?.params,
      };
    }

    // Проверка возраста
    if (options?.minAge !== undefined || options?.maxAge !== undefined) {
      const age = Math.floor(
        (now.getTime() - dateValue.getTime()) / (365.25 * 24 * 60 * 60 * 1000)
      );

      if (options?.minAge !== undefined && age < options.minAge) {
        return {
          code: 'date_min_age',
          message: options?.message || `Минимальный возраст: ${options.minAge} лет`,
          params: { minAge: options.minAge, currentAge: age, ...options?.params },
        };
      }

      if (options?.maxAge !== undefined && age > options.maxAge) {
        return {
          code: 'date_max_age',
          message: options?.message || `Максимальный возраст: ${options.maxAge} лет`,
          params: { maxAge: options.maxAge, currentAge: age, ...options?.params },
        };
      }
    }

    return null;
  });
}
