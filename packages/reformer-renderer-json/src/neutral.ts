/**
 * @reformer/renderer-json/neutral
 *
 * Вход без привязки к слою представления: документ формы, реестр, операторы, локализация — всё,
 * что нужно, чтобы собрать форму из JSON и нарисовать её любым рендерером (React, Vue, Angular).
 * React этот вход не импортирует.
 *
 * Форму из документа собирает `createForm({ model, schema: document, registry })` из
 * `@reformer/core`; рисует её рендерер стека.
 *
 * Чего здесь нет — оно привязано к React и живёт в основном входе пакета: панель и граница ошибок
 * схемы, `LocaleProvider`, `useLocale`, `I18n`, `useSignalValues`. Реестр отсюда границу ошибок не
 * подставляет — её передают параметром `defineRegistry`.
 *
 * @packageDocumentation
 */

// ============================================================================
// JSON Schema Types
// ============================================================================

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

export { migrateJsonSchema, DEFAULT_STEP_HOSTS } from './migrate';
export type { MigrateJsonSchemaOptions } from './migrate';

export { composeJsonFormSchema, isJsonStepRef, normalizeStepRef } from './compose';

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
// Component Registry — без границы ошибок по умолчанию и без типа компонента React
// ============================================================================

export { defineRegistry, composeRegistries } from './registry/registry-core';
export type { RegistryOptions } from './registry/registry-core';
export { FIELD_WRAPPER, LOCALE_SERVICE } from './registry/constants';
export type { ComponentRegistry, ComponentMetadata, RegistryBuilder } from './registry/types';

// ============================================================================
// Анализ схемы (preflight: что схема требует от реестра и какие селекторы в ней объявлены)
// ============================================================================

export { collectOperatorNames } from './collect-operator-names';
export type { OperatorNames } from './collect-operator-names';
export { collectSchemaSelectors } from './collect-schema-selectors';

// ============================================================================
// Локализация (оператор "$locale(key)" + структурная форма)
// ============================================================================

export {
  createLocaleResolver,
  createLocaleService,
  defaultLocaleResolver,
} from './locale/locale-service';
export type { LocaleResolver, LocaleService, LocaleParams } from './locale/locale-service';
export { unwrapSignalValues } from './locale/unwrap-signal-values';

// ============================================================================
// Converter (for advanced use cases)
// ============================================================================

export { convertJsonSchema } from './converter/json-to-render-schema';

// ============================================================================
// JSON Schema (мета-схема form-DSL) — ajv-free утилиты
// ============================================================================

export {
  formSchemaMetaSchema,
  buildFormSchemaMetaSchema,
  buildFormStepMetaSchema,
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
