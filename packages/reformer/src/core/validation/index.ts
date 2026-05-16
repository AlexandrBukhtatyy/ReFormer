// ============================================================================
// Validation Schema API
// ============================================================================

// Core validation operators
export { validate } from './core/validate';
export { validateAsync } from './core/validate-async';
export { validateGroup } from './core/validate-group';
export { apply } from './core/apply';
export { applyWhen } from './core/apply-when';

// Reusable validator factories
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

// Array validators
export { notEmpty, validateItems } from './validators/array-validators';

// FieldPath utilities
export { createFieldPath, extractPath, extractKey, toFieldPath } from '../utils/field-path';

// Form validation utility
export { validateForm } from './validate-form';

// Validation registry (для внутреннего использования)
export { ValidationRegistry } from './validation-registry';
