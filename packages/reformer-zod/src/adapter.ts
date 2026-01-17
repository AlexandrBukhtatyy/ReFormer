import type { ZodType } from 'zod';
import type { FieldPathNode } from '@reformer/core';
import { validate, validateAsync } from '@reformer/core/validators';
import { mapZodError } from './error-mapper';
import type { SchemaAdapterOptions, AsyncSchemaAdapterOptions } from './types';

/**
 * Apply a Zod schema to a ReFormer field (synchronous validation)
 *
 * @param fieldPath - The field path from ReFormer's FieldPath
 * @param schema - The Zod schema to validate against
 * @param options - Optional configuration for error mapping
 *
 * @example
 * ```typescript
 * import { zod } from '@reformer/zod';
 * import { z } from 'zod';
 *
 * const validation = (path: FieldPath<MyForm>) => {
 *   // Simple usage
 *   zod(path.email, z.string().email());
 *
 *   // With custom message
 *   zod(path.age, z.number().min(18), { message: 'Must be 18 or older' });
 *
 *   // With refinement
 *   zod(path.password, z.string().min(8).refine(
 *     (val) => /[A-Z]/.test(val),
 *     { message: 'Must contain uppercase letter' }
 *   ));
 * };
 * ```
 */
export function zod<TForm, TField>(
  fieldPath: FieldPathNode<TForm, TField> | undefined,
  schema: ZodType<TField>,
  options?: SchemaAdapterOptions
): void {
  if (!fieldPath) return;

  validate(fieldPath, (value) => {
    const result = schema.safeParse(value);

    if (result.success) {
      return null;
    }

    return mapZodError(result.error, options);
  });
}

/**
 * Apply a Zod schema to a ReFormer field (asynchronous validation)
 *
 * Use this for schemas with async refinements or when you need debouncing.
 *
 * @param fieldPath - The field path from ReFormer's FieldPath
 * @param schema - The Zod schema to validate against
 * @param options - Optional configuration for error mapping and debouncing
 *
 * @example
 * ```typescript
 * import { zodAsync } from '@reformer/zod';
 * import { z } from 'zod';
 *
 * const validation = (path: FieldPath<MyForm>) => {
 *   // Schema with async refinement
 *   zodAsync(
 *     path.username,
 *     z.string().min(3).refine(
 *       async (val) => !(await checkUsernameExists(val)),
 *       { message: 'Username already taken' }
 *     ),
 *     { debounce: 500 }
 *   );
 *
 *   // Simple async validation with debounce
 *   zodAsync(
 *     path.email,
 *     z.string().email(),
 *     { debounce: 300 }
 *   );
 * };
 * ```
 */
export function zodAsync<TForm, TField>(
  fieldPath: FieldPathNode<TForm, TField> | undefined,
  schema: ZodType<TField>,
  options?: AsyncSchemaAdapterOptions
): void {
  if (!fieldPath) return;

  validateAsync(
    fieldPath,
    async (value) => {
      const result = await schema.safeParseAsync(value);

      if (result.success) {
        return null;
      }

      return mapZodError(result.error, options);
    },
    { debounce: options?.debounce }
  );
}
