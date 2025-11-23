// ============================================================================
// Validation Schema API
// ============================================================================

// Core validation functions
export { validate } from './core/validate';
export { validateAsync } from './core/validate-async';
export { validateTree } from './core/validate-tree';
export { apply } from './core/apply';
export { applyWhen } from './core/apply-when';

// Reusable validators
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
export { custom, createCustomValidator, type CustomValidatorFn } from './validators/custom';

// Валидаторы для массивов
export { notEmpty, validateItems } from './validators/array-validators';

// Утилиты для FieldPath
export { createFieldPath, extractPath, extractKey, toFieldPath } from './field-path';

// Утилита для валидации формы по схеме
export { validateForm } from './validate-form';

// ValidationRegistry (для внутреннего использования)
// Примечание: ValidationRegistry (глобальный singleton) был удален в пользу
// локальных экземпляров ValidationRegistry в каждом GroupNode
export { ValidationRegistry } from './validation-registry';

// Контексты валидации
export { ValidationContextImpl, TreeValidationContextImpl } from './validation-context';
