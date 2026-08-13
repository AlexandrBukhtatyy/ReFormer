/**
 * Гейт валидации выходной схемы (спека §6/§14): обёртка над `validateFormSchema`
 * (`@reformer/renderer-json/validate`, синхронно). Даёт структурную проверку (ajv) + валидацию
 * `componentProps` против `defaultPropSchemas` ui-kit.
 *
 * Имена компонентов/источников передаём как ВСЕ, встреченные в схеме (плюс известные ui-kit), —
 * в standalone-режиме имена project-specific источников/компонентов знать неоткуда, поэтому
 * name-check не должен давать ложные срабатывания; ценность гейта — структура + типы пропсов.
 *
 * СТРОГИЙ РЕЖИМ ({@link ValidateOptions.strict}) — для МАШИННОГО входа (агент). Там мягкость выше
 * оборачивается дырой: `ops.components` собираются из САМОЙ проверяемой схемы, поэтому выдуманное
 * имя компонента проверяет само себя и проходит молча.
 *
 * Но целиком отбросить имена из схемы нельзя: project-specific компоненты (например
 * `RendererFormWizard` из реестра конкретного проекта) законны, а каталогу билдера в standalone
 * неизвестны — строгая проверка «только каталог» отвергала бы валидные пользовательские формы.
 * Поэтому источником имён-исключений становится не проверяемая схема, а {@link ValidateOptions.baseline}:
 * то, что у пользователя УЖЕ было. Агент не может протащить новое выдуманное имя, а существующие
 * компоненты формы продолжают работать. Без `baseline` строгий режим требует только известных имён —
 * это случай генерации с нуля.
 *
 * Строгим режимом НЕ покрываются `$dataSource`/`$fn`/`$locale`: их имена в standalone знать
 * неоткуда ни в каком режиме, поэтому там мягкость — не дыра, а единственно возможное поведение.
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

/** Опции гейта. */
export interface ValidateOptions {
  /**
   * Строгая проверка имён компонентов: имена НЕ берутся из самой проверяемой схемы. Включать для
   * машинного входа (выход агента), где самоисполняющаяся проверка бесполезна. По умолчанию
   * `false` — поведение ручного сохранения не меняется.
   */
  strict?: boolean;
  /**
   * Схема, которая была у пользователя ДО правки. В строгом режиме её имена компонентов считаются
   * законными наравне с {@link knownComponentNames} — так project-specific компоненты формы не
   * дают ложных срабатываний, а новое выдуманное имя всё равно не проходит. Вне строгого режима
   * игнорируется.
   */
  baseline?: JsonFormSchema;
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

/**
 * Провалидировать схему перед экспортом/сохранением (мягкий режим) либо перед применением
 * машинной правки (`{ strict: true }` — см. заметку о режимах в шапке модуля).
 */
export function validateSchema(schema: JsonFormSchema, opts?: ValidateOptions): ValidationResult {
  const ops = collectOperatorNames(schema);
  // Мягкий режим доверяет именам самой схемы; строгий — только известным плюс уже бывшим у
  // пользователя (см. заметку о режимах в шапке модуля).
  const allowedFromSchema = opts?.strict
    ? opts.baseline
      ? collectOperatorNames(opts.baseline).components
      : []
    : ops.components;
  const result = validateFormSchema(schema, {
    componentNames: [...new Set([...allowedFromSchema, ...knownComponentNames()])],
    dataSourceNames: ops.dataSources,
    fnNames: ops.fns,
    localeKeys: ops.locales,
    propSchemas: catalogPropSchemas(),
  });
  return { valid: result.valid, errors: result.errors };
}
