/**
 * Reusable validator factories.
 *
 * Все примитивы — фабрики, возвращающие чистый Validator<TForm, TField>.
 * Использование: `validate(path.x, required())`, `validate(path.y, min(18))`.
 */

export { required } from './required';
export { min } from './min';
export { max } from './max';
export { minLength } from './min-length';
export { maxLength } from './max-length';
export { email } from './email';
export { pattern } from './pattern';
export { url, type UrlValidatorOptions } from './url';
export { phone, type PhoneFormat, type PhoneValidatorOptions } from './phone';
export { number, type NumberValidatorOptions } from './number';
export { notEmpty } from './array-validators';
