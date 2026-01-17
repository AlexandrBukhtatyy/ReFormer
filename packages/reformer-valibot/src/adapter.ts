import * as v from 'valibot';
import type { FieldPathNode } from '@reformer/core';
import { validate, validateAsync } from '@reformer/core/validators';
import { mapValibotError } from './error-mapper';
import type { SchemaAdapterOptions, AsyncSchemaAdapterOptions } from './types';

/**
 * Apply a Valibot schema to a ReFormer field (synchronous validation)
 *
 * @param fieldPath - The field path from ReFormer's FieldPath
 * @param schema - The Valibot schema to validate against
 * @param options - Optional configuration for error mapping
 *
 * @example
 * ```typescript
 * import { valibot } from '@reformer/valibot';
 * import * as v from 'valibot';
 *
 * const validation = (path: FieldPath<MyForm>) => {
 *   // Simple usage
 *   valibot(path.email, v.pipe(v.string(), v.email()));
 *
 *   // With custom message
 *   valibot(path.age, v.pipe(v.number(), v.minValue(18)), {
 *     message: 'Must be 18 or older'
 *   });
 *
 *   // Complex validation
 *   valibot(path.password, v.pipe(
 *     v.string(),
 *     v.minLength(8),
 *     v.regex(/[A-Z]/, 'Must contain uppercase letter')
 *   ));
 * };
 * ```
 */
export function valibot<TForm, TField>(
  fieldPath: FieldPathNode<TForm, TField> | undefined,
  schema: v.BaseSchema<unknown, TField, v.BaseIssue<unknown>>,
  options?: SchemaAdapterOptions
): void {
  if (!fieldPath) return;

  validate(fieldPath, (value) => {
    const result = v.safeParse(schema, value);

    if (result.success) {
      return null;
    }

    return mapValibotError(result.issues, options);
  });
}

/**
 * Apply a Valibot schema to a ReFormer field (asynchronous validation)
 *
 * Use this for schemas with async actions or when you need debouncing.
 *
 * @param fieldPath - The field path from ReFormer's FieldPath
 * @param schema - The Valibot schema to validate against
 * @param options - Optional configuration for error mapping and debouncing
 *
 * @example
 * ```typescript
 * import { valibotAsync } from '@reformer/valibot';
 * import * as v from 'valibot';
 *
 * const validation = (path: FieldPath<MyForm>) => {
 *   // Schema with async check
 *   valibotAsync(
 *     path.username,
 *     v.pipeAsync(
 *       v.string(),
 *       v.minLength(3),
 *       v.checkAsync(
 *         async (val) => !(await checkUsernameExists(val)),
 *         'Username already taken'
 *       )
 *     ),
 *     { debounce: 500 }
 *   );
 *
 *   // Simple async validation with debounce
 *   valibotAsync(
 *     path.email,
 *     v.pipe(v.string(), v.email()),
 *     { debounce: 300 }
 *   );
 * };
 * ```
 */
export function valibotAsync<TForm, TField>(
  fieldPath: FieldPathNode<TForm, TField> | undefined,
  schema:
    | v.BaseSchema<unknown, TField, v.BaseIssue<unknown>>
    | v.BaseSchemaAsync<unknown, TField, v.BaseIssue<unknown>>,
  options?: AsyncSchemaAdapterOptions
): void {
  if (!fieldPath) return;

  validateAsync(
    fieldPath,
    async (value) => {
      const result = await v.safeParseAsync(schema, value);

      if (result.success) {
        return null;
      }

      return mapValibotError(result.issues, options);
    },
    { debounce: options?.debounce }
  );
}
