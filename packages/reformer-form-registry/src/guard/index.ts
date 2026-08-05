/**
 * Guard от двойного рантайма — отдельный subpath с нулевыми зависимостями.
 *
 * @module reformer/form-registry/guard
 */

export {
  stampRuntime,
  checkRuntime,
  reportRuntime,
  setRuntimeStrict,
  resetRuntimeGuard,
} from './realm';
export type { RuntimeCheck, RuntimeDiagnostic } from './realm';
