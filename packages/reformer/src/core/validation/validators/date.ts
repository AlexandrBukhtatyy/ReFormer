/**
 * Валидатор даты (фабрика).
 *
 * @group Validation
 * @category Validators
 * @module validators/date
 */

import type { Validator, ValidateOptions } from '../../types/validation-schema';

export interface DateValidatorOptions extends ValidateOptions {
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

type DateInput = string | Date | undefined;

/**
 * Фабрика валидатора даты.
 *
 * Принимает Date или строку, конвертирует в Date, проверяет валидность и ограничения.
 *
 * @example
 * ```typescript
 * validate(path.birthDate, date({ noFuture: true, minAge: 18 }));
 * validate(path.eventDate, date({ minDate: new Date() }));
 * ```
 */
export function date<TForm = unknown, TField extends DateInput = DateInput>(
  options?: DateValidatorOptions
): Validator<TForm, TField> {
  return (value) => {
    if (!value) {
      return null;
    }

    let dateValue: Date;
    if (value instanceof Date) {
      dateValue = value;
    } else if (typeof value === 'string') {
      dateValue = new Date(value);
    } else {
      return {
        code: 'date_invalid',
        message: options?.message ?? 'Неверный формат даты',
        params: options?.params,
      };
    }

    if (isNaN(dateValue.getTime())) {
      return {
        code: 'date_invalid',
        message: options?.message ?? 'Неверный формат даты',
        params: options?.params,
      };
    }

    const now = new Date();
    now.setHours(0, 0, 0, 0);

    if (options?.minDate) {
      const minDate = new Date(options.minDate);
      minDate.setHours(0, 0, 0, 0);
      if (dateValue < minDate) {
        return {
          code: 'date_min',
          message: options?.message ?? `Дата должна быть не ранее ${minDate.toLocaleDateString()}`,
          params: { minDate: options.minDate, ...options?.params },
        };
      }
    }

    if (options?.maxDate) {
      const maxDate = new Date(options.maxDate);
      maxDate.setHours(0, 0, 0, 0);
      if (dateValue > maxDate) {
        return {
          code: 'date_max',
          message:
            options?.message ?? `Дата должна быть не позднее ${maxDate.toLocaleDateString()}`,
          params: { maxDate: options.maxDate, ...options?.params },
        };
      }
    }

    if (options?.noFuture && dateValue > now) {
      return {
        code: 'date_future',
        message: options?.message ?? 'Дата не может быть в будущем',
        params: options?.params,
      };
    }

    if (options?.noPast && dateValue < now) {
      return {
        code: 'date_past',
        message: options?.message ?? 'Дата не может быть в прошлом',
        params: options?.params,
      };
    }

    if (options?.minAge !== undefined || options?.maxAge !== undefined) {
      const age = Math.floor(
        (now.getTime() - dateValue.getTime()) / (365.25 * 24 * 60 * 60 * 1000)
      );

      if (options?.minAge !== undefined && age < options.minAge) {
        return {
          code: 'date_min_age',
          message: options?.message ?? `Минимальный возраст: ${options.minAge} лет`,
          params: { minAge: options.minAge, currentAge: age, ...options?.params },
        };
      }

      if (options?.maxAge !== undefined && age > options.maxAge) {
        return {
          code: 'date_max_age',
          message: options?.message ?? `Максимальный возраст: ${options.maxAge} лет`,
          params: { maxAge: options.maxAge, currentAge: age, ...options?.params },
        };
      }
    }

    return null;
  };
}
