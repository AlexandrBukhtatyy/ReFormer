/**
 * @reformer/renderer-json
 *
 * JSON-based form renderer for @reformer ecosystem
 *
 * @packageDocumentation
 */

// ============================================================================
// Main Component
// ============================================================================

export { JsonFormRenderer } from './components/json-form-renderer';
export type { JsonFormRendererProps } from './components/json-form-renderer';
export { SchemaErrorPanel } from './components/schema-error-panel';
export { SchemaErrorBoundary } from './components/schema-error-boundary';
export type { SchemaErrorBoundaryProps } from './components/schema-error-boundary';
export type { SchemaErrorPanelProps } from './components/schema-error-panel';

// ============================================================================
// JSON Schema Types
// ============================================================================

// Формат 2 — основные имена: привязка ключом `model`, подформы, именованные части документа.
export type {
  JsonFormSchema,
  JsonNode,
  JsonFieldNode,
  JsonArrayNode,
  JsonPartNode,
  JsonContainerNode,
  JsonChild,
  JsonTextChild,
  JsonFormStep,
  JsonStepRef,
} from './types/json-schema';
export {
  isFieldNode,
  isArrayNode,
  isPartNode,
  isContainerNode,
  defineJsonSchema,
  schemaFormatOf,
} from './types/json-schema';

// Прежний формат документа (ключи `value` / `array`, шаги в `componentProps.steps`) — суффикс V1.
export type {
  JsonFormSchemaV1,
  JsonNodeV1,
  JsonFieldNodeV1,
  JsonArrayNodeV1,
  JsonContainerNodeV1,
  JsonChildV1,
  JsonFormStepV1,
} from './types/json-schema-v1';
export {
  isFieldNodeV1,
  isArrayNodeV1,
  isContainerNodeV1,
  defineJsonSchemaV1,
} from './types/json-schema-v1';

// Перевод документа прежнего формата в формат 2.
export { migrateJsonSchema, DEFAULT_STEP_HOSTS } from './migrate';
export type { MigrateJsonSchemaOptions } from './migrate';

// Схема визарда, разбитая по шагам: сборка перед сборкой формы.
export { composeJsonFormSchema, isJsonStepRef, normalizeStepRef } from './compose';

// Сборка формы из JSON-схемы одним проходом (§7): createJsonForm + стабильный хук useJsonForm.
export { createJsonForm, useJsonForm } from './create-json-form';
export type { JsonForm, CreateJsonFormConfig } from './create-json-form';

// Операторы JSON-схемы (M1): СТРОКОВЫЕ ссылки на модель/реестр ("$model(path)" и т.д.)
export {
  parseOperator,
  isModelOp,
  isComponentOp,
  isHtmlOp,
  isDataSourceOp,
  isFnOp,
  isLocaleOp,
  isPartOp,
} from './operators';
export type {
  Path,
  ModelOp,
  ComponentOp,
  HtmlOp,
  DataSourceOp,
  FnOp,
  LocaleOp,
  PartOp,
  JsonOperator,
  ParsedOperator,
} from './operators';

// ============================================================================
// HTML-узлы (оператор "$html(tag)"): whitelist тегов и чистка DOM-атрибутов
// ============================================================================

export { ALLOWED_HTML_TAGS, isAllowedHtmlTag, sanitizeHtmlProps } from './html/html-tags';

// ============================================================================
// Component Registry
// ============================================================================

export { defineRegistry, composeRegistries } from './registry/component-registry';
export { FIELD_WRAPPER, LOCALE_SERVICE } from './registry/constants';
export type { ComponentRegistry, ComponentMetadata, RegistryBuilder } from './registry/types';

// ============================================================================
// Анализ схемы (preflight: что схема требует от реестра и от render-behavior)
// ============================================================================

export { collectOperatorNames } from './collect-operator-names';
export type { OperatorNames } from './collect-operator-names';
export { collectSchemaSelectors } from './collect-schema-selectors';

// ============================================================================
// Локализация (оператор "$locale(key)" + структурная форма + реактивный <I18n>)
// ============================================================================

export {
  createLocaleResolver,
  createLocaleService,
  defaultLocaleResolver,
} from './locale/locale-service';
export type { LocaleResolver, LocaleService, LocaleParams } from './locale/locale-service';
export { LocaleProvider, useLocale } from './locale/locale-context';
export type { LocaleProviderProps } from './locale/locale-context';
export { I18n } from './locale/i18n';
export type { I18nProps } from './locale/i18n';
export { useSignalValues, unwrapSignalValues } from './locale/use-signal-value';

// ============================================================================
// Context Provider & Settings
// ============================================================================

export {
  JsonRendererProvider,
  useJsonRendererSettings,
  useJsonRendererSettingsUnchecked,
} from './context/json-renderer-context';
export type {
  JsonRendererSettings,
  JsonRendererProviderProps,
} from './context/json-renderer-context';

// ============================================================================
// Converter (for advanced use cases)
// ============================================================================

export {
  convertJsonSchema,
  createRenderSchemaFromJsonM1,
  convertJsonToM1Tree,
} from './converter/json-to-render-schema';

// ============================================================================
// JSON Schema (мета-схема form-DSL) — ajv-free утилиты
// ============================================================================
//
// Сам валидатор `validateFormSchema` (тянет ajv) живёт в subpath-экспорте
// `@reformer/renderer-json/validate`, чтобы ajv не попадал в основной render-бандл.

export {
  formSchemaMetaSchema,
  buildFormSchemaMetaSchema,
  buildFormStepMetaSchema,
  // Мета-схема прежнего формата документа (v1).
  formSchemaMetaSchemaV1,
  buildFormSchemaMetaSchemaV1,
  buildFormStepMetaSchemaV1,
  toFormStepMetaSchema,
  FORM_STEP_SCHEMA_ID,
  getComponentNames,
  getDataSourceNames,
  getFnNames,
  getLocaleKeys,
  stripDocExtensions,
  allowOperatorStrings,
  toComponentPropsValidatorSchema,
} from './schema';
export type { ComponentPropsSchema, BuildFormSchemaMetaSchemaOptions } from './schema';
