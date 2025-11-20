// ============================================================================
// FieldPath - proxy для доступа к путям полей
// ============================================================================

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
export type FieldPath<T> = {
  [K in keyof T]: NonNullable<T[K]> extends Array<unknown>
    ? FieldPathNode<T, T[K], K> // Массивы - не рекурсим (обрабатываются отдельно)
    : NonNullable<T[K]> extends Date | File | Blob | Function
      ? FieldPathNode<T, T[K], K> // Специальные объекты - не рекурсим
      : NonNullable<T[K]> extends object
        ? FieldPathNode<T, T[K], K> & FieldPath<NonNullable<T[K]>> // Обычные объекты - рекурсия!
        : FieldPathNode<T, T[K], K>; // Примитивы
};

/**
 * Узел в пути поля
 * Содержит метаинформацию о поле для валидации
 */
export interface FieldPathNode<TForm, TField, TKey extends keyof TForm = keyof TForm> {
  /** Ключ поля */
  readonly __key: TKey;
  /** Путь к полю (для вложенных объектов) */
  readonly __path: string;
  /** Тип формы */
  readonly __formType?: TForm;
  /** Тип поля */
  readonly __fieldType?: TField;
}
