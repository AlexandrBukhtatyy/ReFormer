/**
 * Общие контракт-типы значения и валидации.
 *
 * Базовый словарь «ошибка + статус», на который опираются узлы формы
 * (`FormNode.getErrors`, `FieldNode`, `FormStatusMachine`, `aggregate-signals`), слой валидации
 * и платформенные биндинги. Файл не импортирует ничего — это лист графа зависимостей.
 *
 * Живёт в `form/types/`, а не в слое модели: `FieldStatus`/`ErrorFilterOptions` — понятия формы,
 * а модель этих типов не использует (и импортировать их оттуда запрещено границей model⇏form).
 * Наружу отдаётся через `form/types/index`.
 *
 * @group Types
 * @module form/types/contracts
 */

/**
 * Ошибка валидации
 * @group Types
 * @category Validation Types
 */
export interface ValidationError {
  code: string;
  /**
   * Готовый текст ошибки. Не задан — отображаемую строку даёт резолвер по `code` (словарь локали
   * `validation.<code>`); пустая строка значит то же самое.
   */
  message?: string;
  /** Ключ сообщения в словаре приложения; при наличии в активной локали важнее `message`. */
  messageKey?: string;
  params?: Record<string, unknown>;
  /** Severity level: 'error' (default) blocks submission, 'warning' shows message but allows submission */
  severity?: 'error' | 'warning';
}

/**
 * Опции для фильтрации ошибок в методе getErrors()
 * @group Types
 * @category Validation Types
 */
export interface ErrorFilterOptions {
  /** Фильтр по коду ошибки */
  code?: string | string[];

  /** Фильтр по сообщению (поддерживает частичное совпадение) */
  message?: string;

  /** Фильтр по параметрам ошибки */
  params?: Record<string, unknown>;

  /** Кастомный предикат для фильтрации */
  predicate?: (error: ValidationError) => boolean;
}

/**
 * Статус поля формы
 * @group Types
 * @category Core Types
 */
export type FieldStatus = 'valid' | 'invalid' | 'pending' | 'disabled';
