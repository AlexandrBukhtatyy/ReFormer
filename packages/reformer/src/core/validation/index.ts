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
export { number } from './validators/number';
export { date } from './validators/date';

// Array validators
export { notEmpty, validateItems } from './validators/array-validators';

// FieldPath utilities
export { createFieldPath, extractPath, extractKey, toFieldPath } from './field-path';

// Form validation utility
export { validateForm } from './validate-form';

// Validation registry (для внутреннего использования)
export { ValidationRegistry } from './validation-registry';
