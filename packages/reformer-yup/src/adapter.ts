import type { Schema } from 'yup';
import type { FieldPathNode } from '@reformer/core';
import { validate, validateAsync } from '@reformer/core/validators';
import { mapYupError, isYupValidationError } from './error-mapper';
import type { SchemaAdapterOptions, AsyncSchemaAdapterOptions } from './types';

/**
 * Apply a Yup schema to a ReFormer field (synchronous validation)
 *
 * @param fieldPath - The field path from ReFormer's FieldPath
 * @param schema - The Yup schema to validate against
 * @param options - Optional configuration for error mapping
 *
 * @example
 * ```typescript
 * import { yup } from '@reformer/yup';
 * import * as y from 'yup';
 *
 * const validation = (path: FieldPath<MyForm>) => {
 *   // Simple usage
 *   yup(path.email, y.string().email().required());
 *
 *   // With custom message
 *   yup(path.age, y.number().min(18), { message: 'Must be 18 or older' });
 *
 *   // Complex validation
 *   yup(path.password, y.string()
 *     .min(8, 'Password must be at least 8 characters')
 *     .matches(/[A-Z]/, 'Must contain uppercase letter')
 *   );
 * };
 * ```
 */
export function yup<TForm, TField>(
  fieldPath: FieldPathNode<TForm, TField> | undefined,
  schema: Schema<TField>,
  options?: SchemaAdapterOptions
): void {
  if (!fieldPath) return;

  validate(fieldPath, (value) => {
    try {
      schema.validateSync(value, { abortEarly: true });
      return null;
    } catch (error) {
      if (isYupValidationError(error)) {
        return mapYupError(error, options);
      }
      throw error;
    }
  });
}

/**
 * Apply a Yup schema to a ReFormer field (asynchronous validation)
 *
 * Use this for schemas with async tests or when you need debouncing.
 *
 * @param fieldPath - The field path from ReFormer's FieldPath
 * @param schema - The Yup schema to validate against
 * @param options - Optional configuration for error mapping and debouncing
 *
 * @example
 * ```typescript
 * import { yupAsync } from '@reformer/yup';
 * import * as y from 'yup';
 *
 * const validation = (path: FieldPath<MyForm>) => {
 *   // Schema with async test
 *   yupAsync(
 *     path.username,
 *     y.string().min(3).test(
 *       'unique',
 *       'Username already taken',
 *       async (val) => !(await checkUsernameExists(val))
 *     ),
 *     { debounce: 500 }
 *   );
 *
 *   // Simple async validation with debounce
 *   yupAsync(
 *     path.email,
 *     y.string().email().required(),
 *     { debounce: 300 }
 *   );
 * };
 * ```
 */
export function yupAsync<TForm, TField>(
  fieldPath: FieldPathNode<TForm, TField> | undefined,
  schema: Schema<TField>,
  options?: AsyncSchemaAdapterOptions
): void {
  if (!fieldPath) return;

  validateAsync(
    fieldPath,
    async (value) => {
      try {
        await schema.validate(value, { abortEarly: true });
        return null;
      } catch (error) {
        if (isYupValidationError(error)) {
          return mapYupError(error, options);
        }
        throw error;
      }
    },
    { debounce: options?.debounce }
  );
}
