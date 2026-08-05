/**
 * `@reformer/form-registry` — React-free ядро реестра форм.
 *
 * Микрофронт регистрирует свои формы, хост разрешает, какую показать в слоте, на маршруте
 * или по идентификатору — с учётом прав и фиче-флагов. React-слой живёт в subpath `./react`
 * и не нужен ни vanilla-хосту, ни тестам разрешения.
 *
 * @module reformer/form-registry
 */

export type {
  DataSource,
  CodeSource,
  FormValidation,
  FormKey,
  FormPlacement,
  FormAccess,
  DegradePolicy,
  FormEntry,
  ResolveContext,
  FormQuery,
  Diagnostic,
} from './types';

export {
  resolveForms,
  passesGate,
  compileRoute,
  matchRouteParams,
  byPriorityThenVersionDesc,
} from './resolve';

export { createFormRegistry, getFormRegistry, resetFormRegistry } from './registry';
export type { FormRegistry, ConflictPolicy } from './registry';

export { loadForm, entryKeyOf, FormLoadError, FormPreflightError } from './loader';
export type { LoadedForm, LoadFormOptions } from './loader';

export { fetchJson, assertFormSchemaShape, retryDelay, FormFetchError } from './net';
export type { FetchJsonOptions, FetchJsonResult, FetchFailureKind } from './net';

export { createSchemaCache } from './cache';
export type { SchemaCache, SchemaCacheOptions, Fetcher, CacheEntry } from './cache';

export {
  preflight,
  formatPreflight,
  satisfiesRange,
  collectModelPaths,
  hasPath,
} from './preflight';
export type { PreflightResult, PreflightProblem, PreflightInput } from './preflight';
