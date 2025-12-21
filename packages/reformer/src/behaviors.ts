/**
 * Re-export behaviors from the main index to ensure single module instance.
 * This prevents static registry isolation issues when consuming the library.
 */
export { behaviors as default } from './index';
export * from './core/behavior';
