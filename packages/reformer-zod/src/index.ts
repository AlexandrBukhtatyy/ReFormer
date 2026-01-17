/**
 * @reformer/zod - Zod schema adapter for ReFormer forms
 *
 * This package provides seamless integration between ReFormer's validation system
 * and Zod schemas, allowing you to use Zod's powerful schema validation within
 * ReFormer forms.
 *
 * @example
 * ```typescript
 * import { createForm, type FieldPath } from '@reformer/core';
 * import { zod, zodAsync } from '@reformer/zod';
 * import { z } from 'zod';
 *
 * interface MyForm {
 *   email: string;
 *   age: number;
 *   username: string;
 * }
 *
 * const form = createForm<MyForm>({
 *   form: {
 *     email: { value: '' },
 *     age: { value: 0 },
 *     username: { value: '' },
 *   },
 *   validation: (path) => {
 *     // Sync validation
 *     zod(path.email, z.string().email());
 *     zod(path.age, z.number().min(18).max(120));
 *
 *     // Async validation with debounce
 *     zodAsync(
 *       path.username,
 *       z.string().min(3).refine(
 *         async (val) => !(await checkUsername(val)),
 *         'Username taken'
 *       ),
 *       { debounce: 500 }
 *     );
 *   },
 * });
 * ```
 *
 * @packageDocumentation
 */

export { zod, zodAsync } from './adapter';
export type { SchemaAdapterOptions, AsyncSchemaAdapterOptions } from './types';
export { mapZodError } from './error-mapper';
