/**
 * @reformer/valibot - Valibot schema adapter for ReFormer forms
 *
 * This package provides seamless integration between ReFormer's validation system
 * and Valibot schemas, allowing you to use Valibot's lightweight schema validation
 * within ReFormer forms.
 *
 * @example
 * ```typescript
 * import { createForm, type FieldPath } from '@reformer/core';
 * import { valibot, valibotAsync } from '@reformer/valibot';
 * import * as v from 'valibot';
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
 *     valibot(path.email, v.pipe(v.string(), v.email()));
 *     valibot(path.age, v.pipe(v.number(), v.minValue(18), v.maxValue(120)));
 *
 *     // Async validation with debounce
 *     valibotAsync(
 *       path.username,
 *       v.pipeAsync(
 *         v.string(),
 *         v.minLength(3),
 *         v.checkAsync(
 *           async (val) => !(await checkUsername(val)),
 *           'Username taken'
 *         )
 *       ),
 *       { debounce: 500 }
 *     );
 *   },
 * });
 * ```
 *
 * @packageDocumentation
 */

export { valibot, valibotAsync } from './adapter';
export type { SchemaAdapterOptions, AsyncSchemaAdapterOptions } from './types';
export { mapValibotError } from './error-mapper';
