/**
 * FormErrorHandler - централизованная обработка ошибок в формах
 *
 * Устраняет несогласованность обработки ошибок между:
 * - field-node.ts (логирует и конвертирует в ValidationError)
 * - behavior-applicator.ts (логирует и пробрасывает)
 * - validation-applicator.ts (логирует и проглатывает)
 *
 * @example
 * ```typescript
 * try {
 *   await validator(value);
 * } catch (error) {
 *   return FormErrorHandler.handle(error, 'AsyncValidator', ErrorStrategy.CONVERT);
 * }
 * ```
 */

import type { ValidationError } from '../types';

/**
 * Стратегия обработки ошибок
 *
 * Определяет, что делать с ошибкой после логирования
 */
export enum ErrorStrategy {
  /**
   * Пробросить ошибку дальше (throw)
   * Используется когда ошибка критична и должна остановить выполнение
   */
  THROW = 'throw',

  /**
   * Залогировать и проглотить ошибку (продолжить выполнение)
   * Используется когда ошибка не критична
   */
  LOG = 'log',

  /**
   * Конвертировать ошибку в ValidationError
   * Используется в async validators для отображения ошибки валидации пользователю
   */
  CONVERT = 'convert',
}

/**
 * Централизованный обработчик ошибок для форм
 *
 * Обеспечивает:
 * - Единообразное логирование ошибок в DEV режиме
 * - Гибкие стратегии обработки (throw/log/convert)
 * - Типобезопасное извлечение сообщений из Error/string/unknown
 *
 * @example
 * ```typescript
 * // В async validator (конвертировать в ValidationError)
 * try {
 *   await validateEmail(value);
 * } catch (error) {
 *   return FormErrorHandler.handle(error, 'EmailValidator', ErrorStrategy.CONVERT);
 * }
 *
 * // В behavior applicator (пробросить критичную ошибку)
 * try {
 *   applyBehavior(schema);
 * } catch (error) {
 *   FormErrorHandler.handle(error, 'BehaviorApplicator', ErrorStrategy.THROW);
 * }
 *
 * // В validator (залогировать и продолжить)
 * try {
 *   validator(value);
 * } catch (error) {
 *   FormErrorHandler.handle(error, 'Validator', ErrorStrategy.LOG);
 * }
 * ```
 */
export class FormErrorHandler {
  /**
   * Обработать ошибку согласно заданной стратегии
   *
   * @param error Ошибка для обработки (Error | string | unknown)
   * @param context Контекст ошибки для логирования (например, 'AsyncValidator', 'BehaviorRegistry')
   * @param strategy Стратегия обработки (THROW | LOG | CONVERT)
   * @returns ValidationError если strategy = CONVERT, undefined если strategy = LOG, никогда не возвращается если strategy = THROW
   *
   * @example
   * ```typescript
   * // THROW - пробросить ошибку
   * try {
   *   riskyOperation();
   * } catch (error) {
   *   FormErrorHandler.handle(error, 'RiskyOperation', ErrorStrategy.THROW);
   *   // Этот код никогда не выполнится
   * }
   *
   * // LOG - залогировать и продолжить
   * try {
   *   nonCriticalOperation();
   * } catch (error) {
   *   FormErrorHandler.handle(error, 'NonCritical', ErrorStrategy.LOG);
   *   // Продолжаем выполнение
   * }
   *
   * // CONVERT - конвертировать в ValidationError
   * try {
   *   await validator(value);
   * } catch (error) {
   *   const validationError = FormErrorHandler.handle(
   *     error,
   *     'AsyncValidator',
   *     ErrorStrategy.CONVERT
   *   );
   *   return validationError;
   * }
   * ```
   */
  static handle(
    error: unknown,
    context: string,
    strategy: ErrorStrategy = ErrorStrategy.THROW
  ): ValidationError | never | void {
    // Извлекаем сообщение из ошибки
    const message = this.extractMessage(error);

    // Логируем в DEV режиме
    if (import.meta.env.DEV) {
      console.error(`[${context}]`, error);
    }

    // Применяем стратегию
    switch (strategy) {
      case ErrorStrategy.THROW:
        throw error;

      case ErrorStrategy.LOG:
        // Просто логируем, не возвращаем ничего
        return;

      case ErrorStrategy.CONVERT:
        // Конвертируем в ValidationError
        return {
          code: 'validator_error',
          message,
          params: { field: context },
        };
    }
  }

  /**
   * Извлечь сообщение из ошибки
   *
   * Обрабатывает различные типы ошибок:
   * - Error объекты → error.message
   * - Строки → возвращает как есть
   * - Объекты с message → извлекает message
   * - Другое → String(error)
   *
   * @param error Ошибка для извлечения сообщения
   * @returns Сообщение ошибки
   * @private
   *
   * @example
   * ```typescript
   * FormErrorHandler.extractMessage(new Error('Test'));
   * // 'Test'
   *
   * FormErrorHandler.extractMessage('String error');
   * // 'String error'
   *
   * FormErrorHandler.extractMessage({ message: 'Object error' });
   * // 'Object error'
   *
   * FormErrorHandler.extractMessage(null);
   * // 'null'
   * ```
   */
  private static extractMessage(error: unknown): string {
    if (error instanceof Error) {
      return error.message;
    }

    if (typeof error === 'string') {
      return error;
    }

    if (typeof error === 'object' && error !== null && 'message' in error) {
      return String((error as any).message);
    }

    return String(error);
  }

  /**
   * Создать ValidationError с заданными параметрами
   *
   * Утилитная функция для создания ValidationError объектов
   *
   * @param code Код ошибки
   * @param message Сообщение ошибки
   * @param field Поле (опционально)
   * @returns ValidationError объект
   *
   * @example
   * ```typescript
   * const error = FormErrorHandler.createValidationError(
   *   'required',
   *   'This field is required',
   *   'email'
   * );
   * // { code: 'required', message: 'This field is required', field: 'email' }
   * ```
   */
  static createValidationError(code: string, message: string, field?: string): ValidationError {
    return {
      code,
      message,
      params: field ? { field } : undefined,
    };
  }

  /**
   * Проверить, является ли объект ValidationError
   *
   * Type guard для ValidationError
   *
   * @param value Значение для проверки
   * @returns true если value является ValidationError
   *
   * @example
   * ```typescript
   * if (FormErrorHandler.isValidationError(result)) {
   *   console.log(result.code); // OK, типобезопасно
   * }
   * ```
   */
  static isValidationError(value: unknown): value is ValidationError {
    return (
      typeof value === 'object' &&
      value !== null &&
      'code' in value &&
      'message' in value &&
      typeof (value as any).code === 'string' &&
      typeof (value as any).message === 'string'
    );
  }
}
