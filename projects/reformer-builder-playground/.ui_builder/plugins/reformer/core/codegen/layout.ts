/**
 * Раскладка модуля формы: как называются его файлы и где они лежат.
 *
 * Единственный источник имён. Имена файлов нужны целям генерации, шаблонам (импорты между
 * файлами модуля), команде контекстного меню, доставке, превью и README — литерал в любом из
 * этих мест означал бы модуль, который импортирует несуществующий файл.
 *
 * ## Папки по ролям
 *
 * Модуль формы — каталог с папками ролей (канон `@reformer/mcp`
 * docs/llms/06-form-directory-layout.md §3); корень модуля — РОДИТЕЛЬ папки `schema/`:
 *
 * ```text
 * <dir>/
 * ├── <Type>.tsx                 страница
 * ├── index.ts                   реэкспорты модуля
 * ├── README.md
 * ├── application/               create.ts (сборка), submit.ts (отправка), entry.ts (реестр форм)
 * ├── api/index.ts               запросы к серверу
 * ├── model/                     initial-value.ts, model.ts
 * ├── schema/                    form.schema.json (документ формы), registry.ts, steps/<шаг>/…
 * ├── validation/                form.ts, messages.ts, <шаг>.ts
 * ├── behavior/index.ts          единственное поведение формы
 * ├── flow/<dir>-flow.ts         поток шагов — только у визарда
 * ├── types/<dir>.ts             тип формы
 * └── constants/<dir>.ts         значения источников данных
 * ```
 *
 * Часть имён зависит от имени формы (`<Type>.tsx`, `types/<dir>.ts`), поэтому раскладка —
 * функция ({@link moduleFilesOf}), а не таблица констант.
 *
 * ## Документ не обязан лежать в `schema/`
 *
 * Форма, созданная до перехода на папки ролей, держит документ в корне модуля. Он остаётся на
 * месте: код печатается по папкам ролей, а путь документа внутри модуля (`schemaPath`) — параметр
 * раскладки, от которого считаются импорты ({@link importOf}) и место файлов шагов.
 *
 * @module plugins/reformer/core/codegen/layout
 */

import { makeNames } from './naming';

/** Папка документа формы и её реестра внутри модуля. */
export const SCHEMA_DIR = 'schema';

/** Каноническое имя документа формы. */
export const SCHEMA_FILE = 'form.schema.json';

/** Прежнее имя документа формы — до перехода на `form.*`. Нужно поиску схемы и доставке. */
export const LEGACY_SCHEMA_FILE = 'renderer.schema.json';

/** Путь документа внутри модуля по умолчанию: `schema/form.schema.json`. */
export const DEFAULT_SCHEMA_PATH = `${SCHEMA_DIR}/${SCHEMA_FILE}`;

/** Папка файлов шагов разбитого визарда — рядом с корневым документом. */
export const STEP_SCHEMAS_DIR = 'steps';

/** Папка правил валидации. */
export const VALIDATION_DIR = 'validation';

/** Имя файла правил формы в {@link VALIDATION_DIR} — без расширения. */
export const FORM_RULES_NAME = 'form';

/** Имя файла текстов замечаний в {@link VALIDATION_DIR} — без расширения. */
export const MESSAGES_NAME = 'messages';

/**
 * Имена, которые шаг визарда занять не может: под ними в `validation/` лежат файлы формы.
 *
 * Шаг с заголовком «Form» дал бы `validation/form.ts` — тот же путь, что у правил формы, шаг
 * «Messages» — путь словаря текстов замечаний (`validation/messages.ts`): один файл затёр бы
 * другой. Такое имя разводится суффиксом, как повтор заголовка (`form-2`, `messages-2`).
 */
export const RESERVED_STEP_NAMES: readonly string[] = Object.freeze([
  FORM_RULES_NAME,
  MESSAGES_NAME,
]);

/** Имена формы, от которых зависят пути файлов модуля. */
export interface ModuleNames {
  /** kebab-имя формы (`loan-application`). */
  readonly dir: string;
  /** PascalCase-тип формы (`LoanApplicationForm`). */
  readonly TypeName: string;
}

/** Пути файлов модуля от его корня. */
export interface ModuleFiles {
  /** Страница: `<Type>.tsx`. */
  readonly page: string;
  /** Реэкспорты модуля: `index.ts`. */
  readonly barrel: string;
  readonly readme: string;
  /** Единственная сборка формы: `application/create.ts`. */
  readonly create: string;
  /** Отправка: `application/submit.ts`. */
  readonly submit: string;
  /** Запись реестра форм: `application/entry.ts`. */
  readonly entry: string;
  /** Запросы к серверу: `api/index.ts`. */
  readonly api: string;
  /** Начальные значения: `model/initial-value.ts`. */
  readonly initial: string;
  /** Фабрика модели: `model/model.ts`. */
  readonly model: string;
  /** Документ формы — `schemaPath`, по умолчанию `schema/form.schema.json`. */
  readonly schema: string;
  /** Реестр компонентов и источников: `schema/registry.ts`. */
  readonly registry: string;
  /** Валидация формы: `validation/form.ts`. */
  readonly validation: string;
  /** Тексты замечаний формы: `validation/messages.ts`. */
  readonly messages: string;
  /** Единственное поведение: `behavior/index.ts`. */
  readonly behavior: string;
  /** Поток шагов визарда: `flow/<dir>-flow.ts`. */
  readonly flow: string;
  /** Тип формы: `types/<dir>.ts`. */
  readonly types: string;
  /** Значения источников данных: `constants/<dir>.ts`. */
  readonly constants: string;
}

/**
 * Пути файлов модуля для формы с такими именами.
 *
 * @param names - Имена формы (`makeNames`).
 * @param schemaPath - Путь документа внутри модуля; по умолчанию {@link DEFAULT_SCHEMA_PATH}.
 */
export function moduleFilesOf(
  names: ModuleNames,
  schemaPath: string = DEFAULT_SCHEMA_PATH
): ModuleFiles {
  return Object.freeze({
    page: `${names.TypeName}.tsx`,
    barrel: 'index.ts',
    readme: 'README.md',
    create: 'application/create.ts',
    submit: 'application/submit.ts',
    entry: 'application/entry.ts',
    api: 'api/index.ts',
    initial: 'model/initial-value.ts',
    model: 'model/model.ts',
    schema: schemaPath,
    registry: `${SCHEMA_DIR}/registry.ts`,
    validation: `${VALIDATION_DIR}/${FORM_RULES_NAME}.ts`,
    messages: `${VALIDATION_DIR}/${MESSAGES_NAME}.ts`,
    behavior: 'behavior/index.ts',
    flow: `flow/${names.dir}-flow.ts`,
    types: `types/${names.dir}.ts`,
    constants: `constants/${names.dir}.ts`,
  });
}

/** Файл правил шага: `validation/<имя шага>.ts`. */
export function stepValidationPath(name: string): string {
  return `${VALIDATION_DIR}/${name}.ts`;
}

/** Путь к нормальному виду: разделители — `/`, без хвостового слэша. */
function normalize(path: string): string {
  return path.replace(/\\/g, '/').replace(/\/+$/, '');
}

/** Последний сегмент пути. */
function baseName(path: string): string {
  const parts = path.split('/');
  return parts[parts.length - 1] ?? '';
}

/** Каталог пути; у файла без каталога — пустая строка. */
function dirName(path: string): string {
  const at = path.lastIndexOf('/');
  return at < 0 ? '' : path.slice(0, at);
}

/**
 * Каталог корневого документа внутри модуля — с завершающим `/` либо пусто (документ в корне).
 *
 * С завершающим слэшем, чтобы путь рядом с документом собирался склейкой без ветвления:
 * `${schemaDirOf(schemaPath)}steps/…`.
 */
export function schemaDirOf(schemaPath: string): string {
  const dir = dirName(normalize(schemaPath));
  return dir === '' ? '' : `${dir}/`;
}

/**
 * Файл схемы шага разбитого визарда: `<каталог корневого документа>/steps/<dir>/form.schema.json`.
 *
 * Ссылка `$ref` корня (`./steps/<dir>/form.schema.json`) относительна корневого документа,
 * поэтому файл шага лежит рядом с ним, а не в корне модуля.
 */
export function stepSchemaPath(schemaPath: string, dir: string): string {
  return `${schemaDirOf(schemaPath)}${STEP_SCHEMAS_DIR}/${dir}/${SCHEMA_FILE}`;
}

/** Канонические имена документа формы: новое первым, затем прежнее. */
const CANONICAL_SCHEMA_NAMES: readonly string[] = Object.freeze([SCHEMA_FILE, LEGACY_SCHEMA_FILE]);

/** Каноническое ли это имя документа формы (`form.schema.json` либо прежнее `renderer.schema.json`). */
export function isCanonicalSchemaName(name: string): boolean {
  return CANONICAL_SCHEMA_NAMES.includes(name);
}

/**
 * Каталог модуля формы по пути её документа: каталог документа, а если он называется `schema` —
 * его родитель.
 *
 * `forms/loan/schema/form.schema.json` → `forms/loan`; `forms/loan/form.schema.json` → `forms/loan`
 * (форма прежней плоской раскладки). Для документа в корне проекта — пустая строка.
 */
export function moduleDirOfSchemaPath(path: string): string {
  const dir = dirName(normalize(path));
  return baseName(dir) === SCHEMA_DIR ? dirName(dir) : dir;
}

/**
 * Путь документа внутри его модуля: `schema/<имя файла>` либо просто имя файла.
 *
 * Прежнее имя документа (`renderer.schema.json`) заменяется каноническим: документ под прежним
 * именем доставка переносит на новое.
 */
export function schemaPathInModule(path: string): string {
  const normalized = normalize(path);
  const name = baseName(normalized);
  const file = name === LEGACY_SCHEMA_FILE ? SCHEMA_FILE : name;
  return baseName(dirName(normalized)) === SCHEMA_DIR ? `${SCHEMA_DIR}/${file}` : file;
}

/** Где модуль формы лежит относительно её документа. */
export interface ModulePlacement {
  /**
   * `nested` — документ в `<модуль>/schema/`: модуль печатается на месте, в родителе папки;
   * `flat` — документ с каноническим именем в корне модуля (форма прежней плоской раскладки):
   * модуль печатается в его каталог, документ остаётся на месте;
   * `detached` — документ со свободным именем (`forms/credit.schema.json`): своего модуля у него
   * нет, он заводится подкаталогом по имени формы, документ кладётся в `schema/form.schema.json`.
   */
  readonly kind: 'nested' | 'flat' | 'detached';
  /** Путь документа внутри модуля. */
  readonly schemaPath: string;
}

/**
 * Куда печатать модуль формы, открытой как документ.
 *
 * Решает имя документа, а не только его место: каталог со свободно названными схемами
 * (`forms/credit.schema.json`, `forms/loan.schema.json`) — не модуль одной формы, и печать в него
 * перемешала бы файлы разных форм.
 */
export function modulePlacementOf(path: string): ModulePlacement {
  const normalized = normalize(path);
  if (!isCanonicalSchemaName(baseName(normalized))) {
    return { kind: 'detached', schemaPath: DEFAULT_SCHEMA_PATH };
  }
  const schemaPath = schemaPathInModule(normalized);
  return { kind: schemaPath.includes('/') ? 'nested' : 'flat', schemaPath };
}

/**
 * Имя формы по пути её документа.
 *
 * Для канонических имён (`form.schema.json`, прежнее `renderer.schema.json`) имя формы — имя
 * каталога МОДУЛЯ: срез по первой точке дал бы `form` (или `renderer`) для любой формы, а имя
 * каталога документа — `schema`. Для прочих (`loan.schema.json`, `loan.form.json`) — имя файла до
 * первой точки.
 */
export function formNameOfSchemaPath(path: string): string {
  const normalized = normalize(path);
  const name = baseName(normalized);
  if (isCanonicalSchemaName(name)) {
    const dir = baseName(moduleDirOfSchemaPath(normalized));
    return dir !== '' ? dir : 'form';
  }
  const dot = name.indexOf('.');
  const stem = dot === -1 ? name : name.slice(0, dot);
  return stem !== '' ? stem : 'form';
}

/**
 * Имя каталога модуля документа со свободным именем — kebab-имя формы из имени ДОКУМЕНТА:
 * `forms/credit.schema.json` → `credit`.
 *
 * Только из адреса. Имя формы, введённое в панели генерации вместо предложенного, меняет имена в
 * коде, но не место модуля: иначе модуль лёг бы туда, где его не найдёт никто, кроме прогона,
 * который его напечатал, — у превью, превью приложением и фикстуры есть только адрес документа.
 * Так же устроены канонические раскладки: каталог модуля задаёт место документа, а не имя формы.
 */
export function detachedModuleDirOf(path: string): string {
  return makeNames(formNameOfSchemaPath(path)).dir;
}

/**
 * Каталог модуля формы по пути её документа — от корня проекта, для всех трёх раскладок
 * ({@link modulePlacementOf}): у `nested` и `flat` это {@link moduleDirOfSchemaPath}, у `detached` —
 * подкаталог {@link detachedModuleDirOf} рядом с документом. Каталога может ещё не быть: код по
 * документу не генерировали.
 */
export function moduleRootPathOf(path: string): string {
  const normalized = normalize(path);
  if (modulePlacementOf(normalized).kind !== 'detached') return moduleDirOfSchemaPath(normalized);
  const dir = dirName(normalized);
  const own = detachedModuleDirOf(normalized);
  return dir === '' ? own : `${dir}/${own}`;
}

/** Арифметика адресов, которой хватает, чтобы найти каталог модуля. */
export interface ModuleRootPort<Id> {
  /** Каталог ресурса. */
  parentOf(id: Id): Id;
  /** Адрес внутри каталога. */
  resolve(dir: Id, ...segments: readonly string[]): Id;
}

/**
 * Каталог модуля формы по АДРЕСУ её документа — то же правило, что {@link moduleRootPathOf}, но
 * адресами платформы. Разбирать адрес ресурса плагину нельзя, поэтому путь документа только
 * решает, сколько раз подняться и в какой подкаталог зайти, а шаги делает порт.
 *
 * Правило одно на кодоген (куда печатать), превью (откуда читать) и вклад домена в точку модулей
 * форм (`FormModulePoint`), по которому модуль ищут общие плагины.
 */
export function moduleRootOfDocument<Id>(port: ModuleRootPort<Id>, id: Id, path: string): Id {
  const parent = port.parentOf(id);
  switch (modulePlacementOf(path).kind) {
    case 'nested':
      return port.parentOf(parent);
    case 'flat':
      return parent;
    case 'detached':
      return port.resolve(parent, detachedModuleDirOf(path));
  }
}

/**
 * Роль файла модуля формы — то, что правка этого файла значит для кодогена.
 *
 * - `form` — документ формы; `step` — файл шага разбитого визарда;
 * - `derived` — производный: генерация кода перепечатывает его ВСЕГДА, ручная правка не доживёт
 *   до следующего прогона;
 * - `regenerable` — авторский, но печатается из правил формы, пока несёт маркер кодогена: правка
 *   без маркера останавливает перепечатку;
 * - `user` — авторский, кодоген его не трогает;
 * - `legacy` — файл прежней плоской раскладки ({@link FLAT_LAYOUT_FILES});
 * - `other` — всё прочее.
 */
export type ModuleFileRole =
  | 'form'
  | 'step'
  | 'derived'
  | 'regenerable'
  | 'user'
  | 'legacy'
  | 'other';

/** Производные файлы с постоянным путём. Пути с именем формы разбираются отдельно. */
const DERIVED_FILES: readonly string[] = Object.freeze([
  'index.ts',
  'README.md',
  'application/create.ts',
  'application/entry.ts',
  'model/initial-value.ts',
  'model/model.ts',
  `${SCHEMA_DIR}/registry.ts`,
]);

/** Авторские файлы с постоянным путём, которые кодоген не перепечатывает. */
const USER_FILES: readonly string[] = Object.freeze([
  `${VALIDATION_DIR}/${MESSAGES_NAME}.ts`,
  'application/submit.ts',
  'api/index.ts',
  'fixture.ts',
]);

/**
 * Роль файла по его пути внутри модуля.
 *
 * Раскладка — та же, по которой печатает кодоген (цели `codegen/src/pipeline/targets.ts`; паритет
 * держит тест рядом с ними). Нужна тем, кто правит файлы модуля МИМО кодогена — ассистенту в
 * режиме файлов: правка производного файла выглядит успешной и молча исчезает при следующей
 * генерации, и сказать об этом в момент правки дешевле, чем объяснять пропажу потом.
 *
 * @param path - Путь от корня модуля.
 * @param schemaPath - Путь документа формы от корня модуля.
 */
export function fileRoleOf(path: string, schemaPath: string): ModuleFileRole {
  const file = normalize(path);
  if (file === normalize(schemaPath)) return 'form';

  const stepsDir = `${schemaDirOf(schemaPath)}${STEP_SCHEMAS_DIR}/`;
  if (file.startsWith(stepsDir)) {
    const rest = file.slice(stepsDir.length).split('/');
    if (rest.length === 2 && rest[1] === SCHEMA_FILE) return 'step';
  }

  if (isFlatLayoutPath(file)) return 'legacy';
  if (DERIVED_FILES.includes(file)) return 'derived';
  if (USER_FILES.includes(file)) return 'user';

  const segments = file.split('/');
  if (file === 'behavior/index.ts') return 'regenerable';
  if (segments.length === 2 && segments[0] === VALIDATION_DIR && file.endsWith('.ts')) {
    return 'regenerable';
  }
  if (segments.length === 2 && (segments[0] === 'types' || segments[0] === 'flow')) {
    return file.endsWith('.ts') ? 'derived' : 'other';
  }
  if (segments.length === 2 && segments[0] === 'constants' && file.endsWith('.ts')) return 'user';
  // Страница называется типом формы (`<Type>.tsx`) — единственный `.tsx` в корне новой раскладки.
  if (segments.length === 1 && file.endsWith('.tsx')) return 'derived';
  return 'other';
}

/** Расширения, которые спецификатор импорта опускает. */
const SCRIPT_EXTENSION = /\.(tsx?|jsx?)$/;

/**
 * Спецификатор импорта `to` из файла `from` (оба — пути внутри модуля).
 *
 * `importOf('validation/kontakty.ts', 'types/loan.ts')` → `'../types/loan'`,
 * `importOf('application/create.ts', 'schema/form.schema.json')` → `'../schema/form.schema.json'`.
 * Скрипты — без расширения, данные — с ним: так их импортирует и Vite, и tsc.
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
  // Импорт папки через её index: `behavior/index.ts` → `../behavior`.
  const spec = rest.endsWith('/index') ? rest.slice(0, -'/index'.length) : rest;
  return up === 0 ? `./${spec}` : `${'../'.repeat(up)}${spec}`;
}

// ── Прежняя плоская раскладка ───────────────────────────────────────────────

/**
 * Файлы корня модуля прежней плоской раскладки — код ПРЕЖНЕГО контракта сборки.
 *
 * Новый модуль их не импортирует, а перенести их под новые имена нельзя: контракт кода другой
 * (`createJsonForm` / `form.render.ts` / шим визарда против `createForm` / единого поведения /
 * библиотечного визарда). Доставка их не трогает — только называет, чтобы человек перенёс свои
 * правки и удалил их.
 *
 * `README.md` и документ формы в список не входят: под теми же именами они живут и в новой
 * раскладке.
 */
export const FLAT_LAYOUT_FILES: readonly string[] = Object.freeze([
  'index.tsx',
  'types.ts',
  'model.ts',
  'registry.ts',
  'wizard.tsx',
  'data-sources.ts',
  'form.render.ts',
  'form.behavior.ts',
  'form.validation.ts',
  'api.ts',
  // Имена до перехода на `form.*`.
  'renderer.behavior.ts',
  'renderer.wizard.tsx',
  'validation.ts',
]);

/** Папка шагов прежней раскладки — прямо под корнем модуля. */
export const FLAT_STEPS_DIR = 'steps';

/** Агрегатор шагов прежней раскладки. */
export const FLAT_STEPS_INDEX = `${FLAT_STEPS_DIR}/index.ts`;

/** Файлы кода в папке шага прежней раскладки (`steps/<шаг>/…`). Схема шага к ним не относится. */
export const FLAT_STEP_FILES: readonly string[] = Object.freeze([
  'form.validation.ts',
  'form.render.ts',
  'validation.ts',
]);

/**
 * Путь файла прежней плоской раскладки?
 *
 * Нужен там, где прежний путь приходит СНАРУЖИ — в заголовке пользовательского шаблона,
 * выгруженного до перехода на папки ролей.
 */
export function isFlatLayoutPath(path: string): boolean {
  if (FLAT_LAYOUT_FILES.includes(path) || path === FLAT_STEPS_INDEX) return true;
  const segments = path.split('/');
  return (
    segments.length === 3 &&
    segments[0] === FLAT_STEPS_DIR &&
    FLAT_STEP_FILES.includes(segments[2] ?? '')
  );
}
