/**
 * Validation schema functions
 *
 * This file re-exports all validation functions from their respective modules.
 * The actual implementations have been split into separate files for better maintainability:
 * - core/ - Core validation functions (validate, validateAsync, validateTree, applyWhen, apply)
 * - validators/ - Reusable validator rules (required, min, max, minLength, maxLength, email, pattern)
 */

// Core validation functions
export { validate } from './core/validate';
export { validateAsync } from './core/validate-async';
export { validateTree } from './core/validate-tree';
export { applyWhen } from './core/apply-when';
export { apply } from './core/apply';

// Reusable validators
export { required } from './validators/required';
export { min } from './validators/min';
export { max } from './validators/max';
export { minLength } from './validators/min-length';
export { maxLength } from './validators/max-length';
export { email } from './validators/email';
export { pattern } from './validators/pattern';
