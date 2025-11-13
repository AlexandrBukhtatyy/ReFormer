/**
 * Композиция validation схем
 *
 * Предоставляет функции для переиспользования validation схем:
 * - apply: применение схемы к полям (новый API)
 *
 * Дополняет существующий toFieldPath и applyWhen.
 */

import type { FieldPathNode, FieldPath } from '../types';
import type { ValidationSchemaFn } from '../types/validation-schema';
import { toFieldPath } from './field-path';

// ============================================================================
// apply - Применение validation схемы к полям
// ============================================================================

/**
 * Применить validation схему к корневому path формы
 *
 * Используется для композиции схем на уровне всей формы.
 *
 * @param path - Корневой FieldPath формы (весь объект путей)
 * @param validationSchema - Схема валидации
 *
 * @example
 * ```typescript
 * const creditApplicationValidation: ValidationSchemaFn<CreditApplicationForm> = (path) => {
 *   apply(path, basicInfoValidation);
 *   apply(path, contactInfoValidation);
 * };
 * ```
 */
export function apply<TForm>(
  path: FieldPath<TForm>,
  validationSchema: ValidationSchemaFn<TForm>
): void;

/**
 * Применить validation схему к вложенному полю или полям
 *
 * Поддерживает:
 * - Одно поле или массив полей
 * - Одну схему или массив схем
 * - Все комбинации (поле + схема, поле + схемы, поля + схема, поля + схемы)
 *
 * @param fields - Одно поле или массив полей
 * @param validationSchemas - Одна схема или массив схем
 *
 * @example
 * ```typescript
 * // Одна схема к одному полю
 * apply(path.registrationAddress, addressValidation);
 *
 * // Одна схема к нескольким полям
 * apply([path.homeAddress, path.workAddress], addressValidation);
 *
 * // Несколько схем к одному полю
 * apply(path.email, [emailValidation, uniqueEmailValidation]);
 *
 * // Несколько схем к нескольким полям
 * apply(
 *   [path.email, path.confirmEmail],
 *   [emailValidation, matchValidation]
 * );
 * ```
 */
export function apply<TForm, TField>(
  fields:
    | FieldPathNode<TForm, TField>
    | Array<FieldPathNode<TForm, TField> | undefined>
    | undefined,
  validationSchemas: ValidationSchemaFn<TField> | Array<ValidationSchemaFn<TField>>
): void;

// Реализация
export function apply<TForm, TField>(
  pathOrFields:
    | FieldPath<TForm>
    | FieldPathNode<TForm, TField>
    | Array<FieldPathNode<TForm, TField> | undefined>
    | undefined,
  validationSchemas:
    | ValidationSchemaFn<TForm>
    | ValidationSchemaFn<TField>
    | Array<ValidationSchemaFn<TField>>
): void {
  // Случай 1: FieldPath<TForm> + одна схема (композиция на уровне формы)
  // Проверяем, является ли это FieldPath (не имеет __key и __path)
  if (
    !Array.isArray(pathOrFields) &&
    !Array.isArray(validationSchemas) &&
    pathOrFields &&
    !('__key' in pathOrFields) &&
    !('__path' in pathOrFields)
  ) {
    const path = pathOrFields as FieldPath<TForm>;
    const schema = validationSchemas as ValidationSchemaFn<TForm>;
    schema(path);
    return;
  }

  // Случай 2: FieldPathNode или массив полей
  const fieldArray = (Array.isArray(pathOrFields) ? pathOrFields : [pathOrFields]).filter(
    Boolean
  ) as Array<FieldPathNode<TForm, TField>>;
  const schemaArray = Array.isArray(validationSchemas) ? validationSchemas : [validationSchemas];

  // Применяем все схемы ко всем полям
  for (const field of fieldArray) {
    const nestedPath = toFieldPath(field);

    for (const schema of schemaArray) {
      // Type assertion: в случае 2 мы работаем только с ValidationSchemaFn<TField>
      (schema as ValidationSchemaFn<TField>)(nestedPath);
    }
  }
}
