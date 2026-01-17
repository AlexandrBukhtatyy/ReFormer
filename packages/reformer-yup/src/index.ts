/**
 * @reformer/yup - Yup schema adapter for ReFormer forms
 *
 * This package provides seamless integration between ReFormer's validation system
 * and Yup schemas, allowing you to use Yup's powerful schema validation within
 * ReFormer forms.
 *
 * @example
 * ```typescript
 * import { createForm, type FieldPath } from '@reformer/core';
 * import { yup, yupAsync } from '@reformer/yup';
 * import * as y from 'yup';
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
 *     yup(path.email, y.string().email().required());
 *     yup(path.age, y.number().min(18).max(120));
 *
 *     // Async validation with debounce
 *     yupAsync(
 *       path.username,
 *       y.string().min(3).test(
 *         'unique',
 *         'Username taken',
 *         async (val) => !(await checkUsername(val))
 *       ),
 *       { debounce: 500 }
 *     );
 *   },
 * });
 * ```
 *
 * @packageDocumentation
 */

export { yup, yupAsync } from './adapter';
export type { SchemaAdapterOptions, AsyncSchemaAdapterOptions } from './types';
export { mapYupError, isYupValidationError } from './error-mapper';
