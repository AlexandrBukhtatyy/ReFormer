/**
 * Гейт валидации выходной схемы (спека §6/§14): обёртка над `validateFormSchema`
 * (`@reformer/renderer-json/validate`, синхронно). Даёт структурную проверку (ajv) + валидацию
 * `componentProps` против `defaultPropSchemas` ui-kit.
 *
 * Имена компонентов/источников передаём как ВСЕ, встреченные в схеме (плюс известные ui-kit), —
 * в standalone-режиме имена project-specific источников/компонентов знать неоткуда, поэтому
 * name-check не должен давать ложные срабатывания; ценность гейта — структура + типы пропсов.
 *
 * @module reformer-builder/io/validate
 */

import { validateFormSchema } from '@reformer/renderer-json/validate';
import type { JsonFormSchema } from '@reformer/renderer-json';
import type { PropsSchema } from '@reformer/ui-kit/meta';
import { collectOperatorNames } from '../model';
import { getCatalog } from '../catalog';
import { knownComponentNames } from '../preview-runtime/known-names';

/** Результат валидации. */
export interface ValidationResult {
  valid: boolean;
  errors: string[];
}

let propSchemasCache: Record<string, PropsSchema> | null = null;

/**
 * Карта имя → props-схема для componentProps-валидации. Берём из КАТАЛОГА (у field-записей
 * `propsSchema` = `mergeFieldPropsSchema`, т.е. враппер+вариант) — иначе сырой вариант не знает
 * про `label`/`required` и валидатор ложно ругается «unknown property label».
 */
function catalogPropSchemas(): Record<string, PropsSchema> {
  return (propSchemasCache ??= Object.fromEntries(
    getCatalog().map((e) => [e.name, e.propsSchema])
  ));
}

/** Провалидировать схему перед экспортом/сохранением. */
export function validateSchema(schema: JsonFormSchema): ValidationResult {
  const ops = collectOperatorNames(schema);
  const result = validateFormSchema(schema, {
    componentNames: [...new Set([...ops.components, ...knownComponentNames()])],
    dataSourceNames: ops.dataSources,
    fnNames: ops.fns,
    localeKeys: ops.locales,
    propSchemas: catalogPropSchemas(),
  });
  return { valid: result.valid, errors: result.errors };
}
