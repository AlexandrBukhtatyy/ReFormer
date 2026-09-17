/**
 * Программный вход CLI: те же команды, что у `reformer-plugin`, без процесса вокруг.
 *
 * @module @reformer/builder-plugin-cli
 */

export { createPlugin, type CreateOptions, type CreateResult } from './commands/create.js';
export {
  validatePlugin,
  type ValidationFinding,
  type ValidationResult,
} from './commands/validate.js';
