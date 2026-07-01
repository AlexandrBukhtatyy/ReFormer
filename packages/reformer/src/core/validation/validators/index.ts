/**
 * Reusable validator factories.
 *
 * Все примитивы — фабрики, возвращающие чистый Validator<TForm, TField>.
 * Импортируются из `@reformer/core/validators` и передаются в массив `validators`
 * поля схемы формы: `validators: [required(), min(18)]`.
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
// Number validator factories
export { isNumber } from './is-number';
export { integer } from './integer';
export { multipleOf } from './multiple-of';
export { nonNegative } from './non-negative';
export { nonZero } from './non-zero';
// Date validator factories
export { isDate } from './is-date';
export { minDate } from './min-date';
export { maxDate } from './max-date';
export { pastDate } from './past-date';
export { futureDate } from './future-date';
export { minAge } from './min-age';
export { maxAge } from './max-age';
