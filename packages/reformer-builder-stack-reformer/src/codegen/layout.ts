/**
 * Раскладка модуля формы: как называются его файлы и где они лежат.
 *
 * Единственный источник имён. Раньше `renderer.schema.json`, `renderer.behavior.ts` и
 * `renderer.wizard.tsx` были литералами в целях генерации, в шаблонах (импорты `index.tsx`,
 * `registry.ts`), в команде контекстного меню, в превью и в README — переименование файла
 * означало правку семи мест, и пропуск любого давал модуль, который импортирует несуществующий
 * файл.
 *
 * ## Правило имён
 *
 * `form.<роль>` — артефакт формы, суффикс называет роль: `form.schema.json` (разметка),
 * `form.behavior.ts` (поведение модели), `form.render.ts` (поведение разметки),
 * `form.validation.ts` (правила валидации). Остальные файлы — без префикса (`model.ts`,
 * `types.ts`, …). Внутри папки шага визарда имена ТЕ ЖЕ: папка
 * меняет место файла, а не его имя.
 *
 * @module @reformer/builder-stack-reformer/codegen/layout
 */

/** Файлы корня модуля. */
export const MODULE_FILES = Object.freeze({
  schema: 'form.schema.json',
  types: 'types.ts',
  model: 'model.ts',
  registry: 'registry.ts',
  index: 'index.tsx',
  wizard: 'wizard.tsx',
  dataSources: 'data-sources.ts',
  render: 'form.render.ts',
  behavior: 'form.behavior.ts',
  validation: 'form.validation.ts',
  api: 'api.ts',
  readme: 'README.md',
} as const);

/** Каталог шагов визарда. */
export const STEPS_DIR = 'steps';

/** Агрегатор шагов: собирает под-схемы и render-правила шагов по порядку. Производный. */
export const STEPS_INDEX = `${STEPS_DIR}/index.ts`;

/** Файлы внутри папки шага. */
export const STEP_FILES = Object.freeze({
  /** Схема шага — только у визарда, разбитого по шагам (`{ "$schema", "node" }`). */
  schema: 'form.schema.json',
  validation: 'form.validation.ts',
  render: 'form.render.ts',
} as const);

/**
 * Прежние имена файлов корня — до перехода на `form.*`.
 *
 * Нужны доставке (перенос правленного руками файла под новое имя), поиску схемы в каталоге
 * (форма, сгенерированная раньше, должна открываться) и превью.
 */
export const LEGACY_FILES = Object.freeze({
  schema: Object.freeze(['renderer.schema.json']),
  render: Object.freeze(['renderer.behavior.ts']),
  wizard: Object.freeze(['renderer.wizard.tsx']),
  validation: Object.freeze(['validation.ts']),
} as const);

/** Имена файла схемы в каталоге формы — канон первым, затем прежнее имя. */
export const SCHEMA_FILE_NAMES: readonly string[] = Object.freeze([
  MODULE_FILES.schema,
  ...LEGACY_FILES.schema,
]);

/** Путь файла шага: `steps/<dir>/<file>`. */
export function stepFilePath(dir: string, file: string): string {
  return `${STEPS_DIR}/${dir}/${file}`;
}

/** Последний сегмент пути. */
function baseName(path: string): string {
  const parts = path.split('/');
  return parts[parts.length - 1] ?? '';
}

/**
 * Имя формы по пути её файла схемы.
 *
 * Для канонических имён (`form.schema.json`, прежнее `renderer.schema.json`) имя формы — имя
 * ПАПКИ: срез по первой точке дал бы `form` (или `renderer`) для любой формы. Для прочих
 * (`loan.schema.json`, `loan.form.json`) — имя файла до первой точки.
 */
export function formNameOfSchemaPath(path: string): string {
  const normalized = path.replace(/\\/g, '/').replace(/\/+$/, '');
  const name = baseName(normalized);
  if (SCHEMA_FILE_NAMES.includes(name)) {
    const segments = normalized.split('/');
    const dir = segments.length > 1 ? segments[segments.length - 2] : '';
    return dir !== undefined && dir !== '' ? dir : 'form';
  }
  const dot = name.indexOf('.');
  const stem = dot === -1 ? name : name.slice(0, dot);
  return stem !== '' ? stem : 'form';
}

/** Расширения, которые спецификатор импорта опускает. */
const SCRIPT_EXTENSION = /\.(tsx?|jsx?)$/;

/**
 * Спецификатор импорта `to` из файла `from` (оба — пути внутри модуля).
 *
 * `importOf('steps/a/validation.ts', 'types.ts')` → `'../../types'`,
 * `importOf('index.tsx', 'form.schema.json')` → `'./form.schema.json'`. Скрипты — без
 * расширения, данные — с ним: так их импортирует и Vite, и tsc.
 */
export function importOf(from: string, to: string): string {
  const fromDir = from.split('/').slice(0, -1);
  const target = to.split('/');
  let common = 0;
  while (
    common < fromDir.length &&
    common < target.length - 1 &&
    fromDir[common] === target[common]
  ) {
    common += 1;
  }
  const up = fromDir.length - common;
  const rest = target.slice(common).join('/').replace(SCRIPT_EXTENSION, '');
  // Импорт папки через её index: `steps/index.ts` → `./steps`.
  const spec = rest.endsWith('/index') ? rest.slice(0, -'/index'.length) : rest;
  return up === 0 ? `./${spec}` : `${'../'.repeat(up)}${spec}`;
}
