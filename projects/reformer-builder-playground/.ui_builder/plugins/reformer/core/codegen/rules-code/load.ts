/**
 * Прочитать файлы правил модуля — через порт того, кто читает (генерация, ассистент, валидатор).
 *
 * Состав — по каталогам, а не по ожидаемым именам: файл шага называется заголовком шага, и после
 * переименования шага прежний файл остаётся лежать. Пропусти его чтение — правила из него
 * пропали бы при следующей генерации. Порт без листинга получает ожидаемые пути от вызывающего.
 *
 * @module plugins/reformer/core/codegen/rules-code/load
 */

import { MESSAGES_NAME, VALIDATION_DIR } from '../layout';
import { readRulesFromCode, type ModuleFileText, type RulesFromCode } from './read';

/** Словарь текстов, поведение и каталог констант — пути от корня модуля (`../layout`). */
const MESSAGES_FILE = `${VALIDATION_DIR}/${MESSAGES_NAME}.ts`;
const BEHAVIOR_FILE = 'behavior/index.ts';
const CONSTANTS_DIR = 'constants';

/** Чтение модуля: пути — от корня модуля. */
export interface ModuleRuleSource {
  /** Текст файла; `null` — файла нет. */
  read(path: string): Promise<string | null>;
  /** Имена файлов каталога (без пути); `null` — каталога нет или листинг не поддержан. */
  list?(dir: string): Promise<readonly string[] | null>;
}

/** Пути на случай порта без листинга. */
export interface ExpectedRuleFiles {
  readonly validation?: readonly string[];
  readonly constants?: readonly string[];
}

/** Файл ли это правил модуля — по пути от корня модуля. Им кэш решает, перечитать ли правила. */
export function isRuleCodePath(path: string): boolean {
  const file = path.replace(/\\/g, '/').replace(/^\.\//, '');
  if (file === BEHAVIOR_FILE) return true;
  const [dir, name, ...rest] = file.split('/');
  return (
    rest.length === 0 &&
    name !== undefined &&
    name.endsWith('.ts') &&
    (dir === VALIDATION_DIR || dir === CONSTANTS_DIR)
  );
}

async function filesOf(
  source: ModuleRuleSource,
  dir: string,
  expected: readonly string[] | undefined
): Promise<string[]> {
  const listed = (await source.list?.(dir)) ?? null;
  if (listed === null) return [...(expected ?? [])];
  return listed
    .filter((name) => name.endsWith('.ts') && !name.endsWith('.d.ts'))
    .map((name) => `${dir}/${name}`)
    .sort();
}

async function textOf(source: ModuleRuleSource, path: string): Promise<ModuleFileText | null> {
  const text = await source.read(path);
  return text === null ? null : { path, text };
}

const present = (file: ModuleFileText | null): file is ModuleFileText => file !== null;

/**
 * Значения источников данных модуля — из его констант, без остальных файлов правил: ими превью
 * заменяет выдуманные варианты.
 */
export async function loadDataSourcesFromModule(
  source: ModuleRuleSource
): Promise<Readonly<Record<string, unknown>>> {
  const paths = await filesOf(source, CONSTANTS_DIR, undefined);
  const constants = await Promise.all(paths.map((path) => textOf(source, path)));
  return (
    readRulesFromCode({ validation: [], constants: constants.filter(present) }).rules.dataSources ??
    {}
  );
}

/** Прочитать правила модуля из его файлов. */
export async function loadRulesFromModule(
  source: ModuleRuleSource,
  expected: ExpectedRuleFiles = {}
): Promise<RulesFromCode> {
  const validationPaths = (await filesOf(source, VALIDATION_DIR, expected.validation)).filter(
    (path) => path !== MESSAGES_FILE
  );
  const constantsPaths = await filesOf(source, CONSTANTS_DIR, expected.constants);
  const [validation, behavior, messages, constants] = await Promise.all([
    Promise.all(validationPaths.map((path) => textOf(source, path))),
    textOf(source, BEHAVIOR_FILE),
    textOf(source, MESSAGES_FILE),
    Promise.all(constantsPaths.map((path) => textOf(source, path))),
  ]);
  return readRulesFromCode({
    validation: validation.filter(present),
    ...(behavior === null ? {} : { behavior }),
    ...(messages === null ? {} : { messages }),
    constants: constants.filter(present),
  });
}
