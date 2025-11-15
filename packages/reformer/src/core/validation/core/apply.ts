/**
 * Композиция validation схем
 */

import type { FieldPath } from '../../types/field-path';

/**
 * Применить другую validation schema внутри текущей
 *
 * Позволяет композировать validation схемы, используя их повторно.
 * Контракты схожи с applyWhen, но без условия.
 *
 * @example
 * ```typescript
 * // Базовые схемы валидации
 * const emailValidation = (path: FieldPath<MyForm>) => {
 *   required(path.email, { message: 'Email обязателен' });
 *   email(path.email);
 * };
 *
 * const passwordValidation = (path: FieldPath<MyForm>) => {
 *   required(path.password);
 *   minLength(path.password, 8);
 * };
 *
 * // Композиция схем через apply
 * const authValidation = (path: FieldPath<MyForm>) => {
 *   apply(path, emailValidation);
 *   apply(path, passwordValidation);
 * };
 *
 * // Применение к форме
 * form.applyValidationSchema(authValidation);
 * ```
 */
export function apply<TForm = any>(
  path: FieldPath<TForm>,
  validationFn: (path: FieldPath<TForm>) => void
): void {
  validationFn(path);
}
