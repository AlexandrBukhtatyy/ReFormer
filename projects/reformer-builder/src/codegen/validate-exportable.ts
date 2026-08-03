/**
 * Pre-export проверка: покрыты ли все `$model`-пути мок-моделью и известны ли все `$component`.
 * Не блокирует — возвращает предупреждения для диалога.
 *
 * @module reformer-builder/codegen/validate-exportable
 */

import type { JsonFormSchema } from '@reformer/renderer-json';
import { collectModelPaths, collectOperatorNames } from '../model';
import { getCatalogEntry } from '../catalog';
import type { MockData } from '../preview-runtime/mock-synth';
import { resolveComponent } from './ui-kit-imports';

export interface ExportReport {
  warnings: string[];
}

function hasPath(obj: Record<string, unknown>, path: string): boolean {
  let cur: unknown = obj;
  for (const seg of path.split('.')) {
    if (typeof cur !== 'object' || cur === null || Array.isArray(cur) || !(seg in cur))
      return false;
    cur = (cur as Record<string, unknown>)[seg];
  }
  return true;
}

export function validateExportable(schema: JsonFormSchema, mock: MockData): ExportReport {
  const warnings: string[] = [];

  for (const p of collectModelPaths(schema)) {
    if (!hasPath(mock.model, p))
      warnings.push(
        `Нет значения в моке для $model(${p}) — начальное значение будет отсутствовать.`
      );
  }

  for (const name of collectOperatorNames(schema).components) {
    if (getCatalogEntry(name)) continue;
    const r = resolveComponent(name);
    if (r.placeholder) warnings.push(`Компонент ${name}: ${r.reason} — будет placeholder.`);
  }

  return { warnings };
}
