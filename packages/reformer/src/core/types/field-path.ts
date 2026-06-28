// ============================================================================
// FieldPath - proxy для доступа к путям полей
// ============================================================================

import type { AnyFunction } from './index';

/**
 * FieldPath предоставляет типобезопасный доступ к путям полей формы
 *
 * Рекурсивно обрабатывает вложенные объекты для поддержки вложенных форм.
 *
 * Использование:
 * ```typescript
 * const validation = (path: FieldPath<MyForm>) => {
 *   required(path.email, { message: 'Email обязателен' });
 *
 *   // Вложенные объекты
 *   required(path.registrationAddress.city);
 *   minLength(path.registrationAddress.street, 3);
 *
 *   applyWhen(
 *     path.loanType,
 *     (type) => type === 'mortgage',
 *     (path) => {
 *       required(path.propertyValue, { message: 'Укажите стоимость' });
 *     }
 *   );
 * };
 * ```
 */
export type FieldPath<T> = FieldPathImpl<T, T>;

/**
 * Внутренняя реализация {@link FieldPath}, прокидывающая тип КОРНЯ схемы (`TRoot`)
 * в каждый узел. `TRoot` остаётся неизменным на всех уровнях вложенности — это тип
 * формы, к которой применяется схема (`ValidationSchemaFn<T>` / `createFieldPath<T>`),
 * и именно он соответствует рантайм-аргументу `root` валидатора.
 *
 * @internal
 */
type FieldPathImpl<T, TRoot> =
  NonNullable<T> extends object
    ? NonNullable<T> extends Array<unknown> | Date | File | Blob | AnyFunction
      ? FieldPathNode<unknown, T, unknown, TRoot> // Опаковые объекты — не разворачиваем в mapped type
      : {
          [K in keyof T]: NonNullable<T[K]> extends Array<unknown>
            ? FieldPathNode<T, T[K], K, TRoot> // Массивы - не рекурсим (обрабатываются отдельно)
            : NonNullable<T[K]> extends Date | File | Blob | AnyFunction
              ? FieldPathNode<T, T[K], K, TRoot> // Специальные объекты - не рекурсим
              : NonNullable<T[K]> extends object
                ? FieldPathNode<T, T[K], K, TRoot> & FieldPathImpl<NonNullable<T[K]>, TRoot> // Обычные объекты - рекурсия (корень неизменен)!
                : FieldPathNode<T, T[K], K, TRoot>; // Примитивы
        }
    : FieldPathNode<unknown, T, unknown, TRoot>; // Примитивы как корневой T — единый узел

/**
 * Узел в пути поля
 * Содержит метаинформацию о поле для валидации
 *
 * @template TForm - Тип непосредственного родителя поля
 * @template TField - Тип значения поля
 * @template TKey - Ключ поля
 * @template TRoot - Тип КОРНЯ схемы (для типизации `root` в валидаторах)
 */
export interface FieldPathNode<TForm, TField, TKey = unknown, TRoot = unknown> {
  /** Ключ поля */
  readonly __key: TKey;
  /** Путь к полю (для вложенных объектов) */
  readonly __path: string;
  /** Тип формы */
  readonly __formType?: TForm;
  /** Тип поля */
  readonly __fieldType?: TField;
  /** Тип корня схемы */
  readonly __rootType?: TRoot;
}
