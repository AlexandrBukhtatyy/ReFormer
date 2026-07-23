// ============================================================================
// Validation API (M1)
// ============================================================================
//
// Здесь живут только чистые фабрики валидаторов (возвращают Rule: (value) => error | null).
// Раннер и операторы схемы (`validateModel`, `defineValidationSchema`, `validate`/`validateAsync`/
// `validateWhen`/`cross`/`each`/`apply`) — отдельный сабпат `@reformer/core/validation`.
// Старые движки (`validateFormModel`-дерево и path-операторы Ф7) удалены.

// Reusable validator factories (чистые: возвращают (value) => error)
export { required } from './validators/required';
export { min } from './validators/min';
export { max } from './validators/max';
export { minLength } from './validators/min-length';
export { maxLength } from './validators/max-length';
export { email } from './validators/email';
export { pattern } from './validators/pattern';
export { url } from './validators/url';
export { phone, type PhoneFormat } from './validators/phone';
// Number validator factories
export { isNumber } from './validators/is-number';
export { integer } from './validators/integer';
export { multipleOf } from './validators/multiple-of';
export { nonNegative } from './validators/non-negative';
export { nonZero } from './validators/non-zero';

// Date validator factories
export { isDate } from './validators/is-date';
export { minDate } from './validators/min-date';
export { maxDate } from './validators/max-date';
export { pastDate } from './validators/past-date';
export { futureDate } from './validators/future-date';
export { minAge } from './validators/min-age';
export { maxAge } from './validators/max-age';
