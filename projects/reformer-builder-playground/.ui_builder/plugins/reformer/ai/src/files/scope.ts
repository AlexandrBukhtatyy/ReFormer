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

import type { FormModuleScope, FormStackFiles, ResourceId } from '@reformer/builder-plugin-api';
import { fileRoleOf, isCanonicalSchemaName, schemaDirOf } from '../../../core/codegen/layout';
import { fail, type ToolOutcome } from '../model/types';
import { pathWithin } from '@reformer/builder-toolkit';

/**
 * Где лежит модуль формы, которую правит ход режима файлов, — контракт SDK (`FormModuleScope`).
 *
 * Все пути инструментов отсчитываются от его корня: модель видит модуль, а не проект, и выйти за
 * его пределы не может по построению.
 */
export type FileScope = FormModuleScope;

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
  files: Pick<FormStackFiles, 'resolve'>,
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

/**
 * Путь ресурса от корня модуля — или `null`, если ресурс вне модуля. Нужен тому, кто получил
 * АДРЕС, а не путь модели: записи инструмента плагина, которая может попасть и в модуль.
 */
export function relInScope(
  files: Pick<FormStackFiles, 'pathOf'>,
  scope: FileScope,
  id: ResourceId
): string | null {
  return pathWithin(files.pathOf(id), scope.rootPath);
}

/** Отказ ли это, а не файл. */
export function isRefusal(value: ModuleFile | ToolOutcome): value is ToolOutcome {
  return 'ok' in value;
}

/** Путь документа активной формы от корня проекта — им отказы называют, какая форма открыта. */
function activeFormPath(scope: FileScope): string {
  return scope.rootPath === '' ? scope.schemaPath : `${scope.rootPath}/${scope.schemaPath}`;
}

/**
 * Похож ли путь на путь ДРУГОЙ формы: документ формы не на своём месте или путь от корня проекта,
 * ведущий мимо этого модуля.
 *
 * Так выглядит путь из прошлого хода, если пользователь между ходами открыл другую форму: модель
 * помнит `form.schema.json` плоской формы и пишет его во вложенный модуль, где документ лежит в
 * `schema/`, — или называет путь проекта той формы целиком. Внутри модуля такой путь законен по
 * форме и вёл бы к созданию лишнего файла рядом с настоящим документом.
 *
 * @param rel - Путь от корня модуля, уже нормализованный.
 * @returns Причина по-английски (для модели) или `null`, если путь похож на путь этого модуля.
 */
export function foreignFormPathReason(scope: FileScope, rel: string): string | null {
  const name = rel.slice(rel.lastIndexOf('/') + 1);
  if (isCanonicalSchemaName(name)) {
    const role = fileRoleOf(rel, scope.schemaPath);
    if (role !== 'form' && role !== 'step') {
      return (
        `${rel} is not this form's document: it is ${scope.schemaPath}, and wizard step files go ` +
        `to ${schemaDirOf(scope.schemaPath)}steps/<step>/${name}.`
      );
    }
  }
  const top = scope.rootPath.split('/')[0];
  if (top !== '' && rel.startsWith(`${top}/`)) {
    return `${rel} looks like a project path outside this form's module (${scope.rootPath}).`;
  }
  return null;
}

/**
 * Отказ в СОЗДАНИИ файла по пути другой формы — см. {@link foreignFormPathReason}. Существующие
 * файлы так не проверяются: путь, который уже есть в модуле, — путь этого модуля.
 */
export function creationRefusal(scope: FileScope, rel: string): ToolOutcome | null {
  const reason = foreignFormPathReason(scope, rel);
  if (reason === null) return null;
  return fail(
    'PATH_REFUSED',
    `${reason} The active form is ${activeFormPath(scope)}; earlier messages may be about ` +
      'another form. Use paths from this module root.'
  );
}

/** Подсказка к «файла нет», если путь похож на путь другой формы; иначе пусто. */
export function foreignPathHint(scope: FileScope, rel: string): string {
  return foreignFormPathReason(scope, rel) === null
    ? ''
    : ` The active form is ${activeFormPath(scope)}; earlier messages may be about another form.`;
}
