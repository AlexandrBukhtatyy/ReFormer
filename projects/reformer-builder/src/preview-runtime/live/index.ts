/**
 * Слой `preview-runtime/live/` — исполнение схем формы (`model` / `validation` / `form-behavior` /
 * `render-behavior` / `registry`) рядом с `form.json`, чтобы во вкладке Renderer форма работала так
 * же, как запустится в приложении.
 *
 * Конвейер: {@link readFormSources} (вкладки Monaco ⊕ диск) → {@link compileForm} (TS → CJS → eval
 * на инстансах билдера) → {@link buildLivePreview} (модель + реестр + форма + валидация).
 *
 * Слой грузится динамическим `import()` из хука превью: он тянет ленивый `typescript`, и платить за
 * него должны только те, кто включил исполнение схем.
 *
 * @module reformer-builder/preview-runtime/live
 */

export { buildLivePreview, type BuildLiveInput, type LiveBundle } from './build-live-preview';
export { compileForm, type CompiledForm, type LiveError } from './compile-form';
export {
  appliedArtifacts,
  extractContract,
  type AppliedArtifact,
  type FormContract,
} from './extract-exports';
export { evalCjsModule, type RequireFn } from './link';
export {
  canResolveModule,
  knownModuleSpecifiers,
  resolveModule,
  type ModuleExports,
} from './module-registry';
export { readFormSources, type FormSources } from './sibling-sources';
export { resetTranspileCache, transpileTs } from './transpile';
