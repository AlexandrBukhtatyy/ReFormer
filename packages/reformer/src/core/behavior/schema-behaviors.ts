/**
 * Behavior schema functions
 *
 * This file re-exports all behavior functions from their respective modules.
 * The actual implementations have been split into separate files for better maintainability:
 * - rules/ - Behavior rules (copyFrom, enableWhen, showWhen, computeFrom, watchField, revalidateWhen, syncFields)
 */

// Behavior rules
export { copyFrom } from './rules/copy-from';
export { enableWhen, disableWhen } from './rules/enable-when';
export { showWhen, hideWhen } from './rules/show-when';
export { computeFrom } from './rules/compute-from';
export { watchField } from './rules/watch-field';
export { revalidateWhen } from './rules/revalidate-when';
export { syncFields } from './rules/sync-fields';
