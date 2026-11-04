/**
 * Каталог компонентов `@reformer/ui-kit` (`@reformer/ui-kit/catalog`) для генератора форм.
 *
 * Ищется там же, откуда форма будет импортировать кит: от `REFORMER_TYPECHECK_ROOT` (если стенд его
 * задал — от него же проверяются типы), затем от корня проекта, затем рядом с сервером. Так имена
 * и подпути компонентов совпадают с версией кита, которую соберёт компилятор потребителя. Кит —
 * опциональный peer: не нашёлся нигде — генератор работает без каталога.
 *
 * @module reformer-mcp/platform/cli/ui-kit-catalog
 */

import { createRequire } from 'module';
import { join } from 'path';
import { TYPECHECK_ROOT_ENV } from './form-workspace.js';
import { detectProjectStack } from './project-detector.js';

const CATALOG = '@reformer/ui-kit/catalog';

/** Откуда резолвить каталог, по порядку: `package.json` баз и модуль сервера. */
export function uiKitCatalogBases(start: string = process.cwd()): string[] {
  const bases: string[] = [];
  const override = process.env[TYPECHECK_ROOT_ENV]?.trim();
  if (override) bases.push(join(override, 'package.json'));
  const projectRoot = detectProjectStack(start).projectRoot;
  if (projectRoot) bases.push(join(projectRoot, 'package.json'));
  bases.push(import.meta.url);
  return bases;
}

/** Каталог кита от первой базы, где он резолвится; нигде нет — `undefined`. */
export function loadUiKitCatalog(bases: readonly string[]): unknown {
  for (const from of bases) {
    try {
      return createRequire(from)(CATALOG) as unknown;
    } catch {
      // следующая база
    }
  }
  return undefined;
}
