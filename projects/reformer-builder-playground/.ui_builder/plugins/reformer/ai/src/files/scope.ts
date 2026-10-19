/**
 * Пути файлового режима: что модель имеет в виду, называя файл, и вправе ли она его трогать.
 *
 * Модель видит МОДУЛЬ формы, а не проект: все пути — от корня модуля (`schema/form.schema.json`,
 * `validation/form.ts`). Это и дешевле в токенах, и задаёт границу записи: путь, который выводит
 * за корень модуля, отвергается здесь, до того как дойдёт до рабочей области. Граница держится
 * разбором сегментов, а не сравнением строк: `..` в любом месте пути, абсолютный путь и буква
 * диска отвергаются сами по себе, поэтому никакая их комбинация из корня не выведет.
 *
 * Путь от корня ПРОЕКТА модель тоже может прислать — его видно в затравке как место модуля. Такой
 * путь принимается: его префикс снимается. Отказывать в нём значило бы потратить шаг на то, что
 * однозначно понятно.
 *
 * @module plugins/reformer/ai/files/scope
 */

import type { ResourceId } from '@reformer/builder-plugin-api';
import type { AiFiles, FileScope } from '../host';
import { fail, type ToolOutcome } from '../model/types';

/** Сегменты, в которые модели заходить нечего: чужой код и служебные данные билдера. */
const FORBIDDEN_SEGMENTS: readonly string[] = Object.freeze(['node_modules', '.ui_builder']);

/** Файл модуля, на который указала модель. */
export interface ModuleFile {
  /** Путь от корня модуля в нормальном виде: `/`, без `./`. */
  readonly rel: string;
  readonly id: ResourceId;
}

/**
 * Привести путь к виду «от корня модуля» или отказать.
 *
 * @param input - Путь, как его прислала модель.
 * @param rootPath - Путь корня модуля от корня проекта (`FileScope.rootPath`).
 * @returns Нормальный путь либо `null`, если путь выводит за модуль или пуст.
 */
export function normalizeModulePath(input: string, rootPath: string): string | null {
  let path = input.trim().replace(/\\/g, '/');
  if (path.startsWith('/') || /^[A-Za-z]:/.test(path)) return null;
  while (path.startsWith('./')) path = path.slice(2);
  const root = rootPath.replace(/\\/g, '/').replace(/\/+$/, '');
  if (root !== '' && path.startsWith(`${root}/`)) path = path.slice(root.length + 1);

  const segments = path.split('/');
  for (const segment of segments) {
    if (segment === '' || segment === '.' || segment === '..') return null;
    if (FORBIDDEN_SEGMENTS.includes(segment)) return null;
  }
  return segments.join('/');
}

/**
 * Файл модуля по пути модели — или готовый отказ инструмента.
 *
 * Отказ — {@link ToolOutcome}, а не исключение: модель чинится по коду ответа, а исключение
 * реестр превратил бы в безликое `TOOL_FAILED`.
 */
export function moduleFileOf(
  files: Pick<AiFiles, 'resolve'>,
  scope: FileScope,
  input: string
): ModuleFile | ToolOutcome {
  const rel = normalizeModulePath(input, scope.rootPath);
  if (rel === null) {
    return fail(
      'PATH_REFUSED',
      `Path "${input}" is outside the form module. Use a path from the module root, ` +
        `e.g. "${scope.schemaPath}".`
    );
  }
  return { rel, id: files.resolve(scope.root, ...rel.split('/')) };
}

/** Отказ ли это, а не файл. */
export function isRefusal(value: ModuleFile | ToolOutcome): value is ToolOutcome {
  return 'ok' in value;
}
