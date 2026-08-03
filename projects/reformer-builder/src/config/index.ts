/**
 * Слой `config/` — runtime-конфигурация UI-Builder от клиента (спека: проброс `--catalog`/`--config`
 * при локальном старте). Границы: {@link './state'} держит активный конфиг/каталог, {@link './load'}
 * грузит+валидирует bundle launcher'а, {@link './boot'} — оркестратор бутстрапа. Точки внедрения
 * (catalog/palette/ui/discovery/branding) читают {@link getRuntimeConfig}/{@link getClientCatalog}.
 *
 * @module reformer-builder/config
 */

export * from './types';
export {
  getRuntimeConfig,
  setRuntimeConfig,
  getClientCatalog,
  setClientCatalog,
  resetRuntimeState,
} from './state';
export {
  loadRuntimeBundle,
  validateRuntimeConfig,
  RuntimeBundleError,
  RUNTIME_BUNDLE_PATH,
} from './load';
export { bootRuntime } from './boot';
