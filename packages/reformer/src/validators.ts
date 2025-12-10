/**
 * Re-export validators from the main index to ensure single module instance.
 * This prevents static registry isolation issues when consuming the library.
 */
export { validators as default } from './index';
export * from './core/validation';
