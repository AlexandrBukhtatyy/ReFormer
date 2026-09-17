/**
 * Программный вход CLI: те же команды, что у `reformer-plugin`, без процесса вокруг.
 *
 * @module @reformer/builder-plugin-cli
 */

export { buildPlugin, type BuildOptions, type BuildResult } from './commands/build.js';
export { createPlugin, type CreateOptions, type CreateResult } from './commands/create.js';
export { startDev, type DevOptions, type DevSession } from './commands/dev.js';
export { type CliFindingCode, type Finding } from './commands/findings.js';
export { packPlugin, type PackOptions, type PackResult } from './commands/pack.js';
export {
  validatePlugin,
  type ValidationFinding,
  type ValidationResult,
} from './commands/validate.js';
