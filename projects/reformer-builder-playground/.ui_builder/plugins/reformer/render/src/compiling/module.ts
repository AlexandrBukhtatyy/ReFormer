/**
 * Модуль формы глазами превью: где его корень, какой он раскладки и какие файлы исполнять.
 *
 * ## Корень модуля — не каталог документа
 *
 * Модуль формы лежит папками по ролям, а документ формы — в одной из них:
 *
 * ```text
 * <форма>/
 * ├── <Тип>.tsx, index.ts, README.md      страница, реэкспорты — превью их не исполняет
 * ├── application/   create.ts, entry.ts  сборка и запись реестра форм — не исполняются
 * │                  submit.ts            отправка             → wireSubmit
 * ├── api/index.ts                        запросы к серверу (импорт отправки)
 * ├── model/         initial-value.ts     начальные значения   → createInitialValues
 * ├── schema/        form.schema.json     документ формы (его открывает редактор)
 * │                  registry.ts          реестр компонентов   → createRegistry
 * │                  steps/<шаг>/…        файлы шагов разбитого визарда
 * ├── validation/    form.ts              валидация формы      → formValidation
 * │                  <шаг>.ts             правила шага (их импортирует поток)
 * ├── behavior/index.ts                   поведение            → behaviorRules, formBehavior
 * ├── flow/<форма>-flow.ts                поток шагов визарда  → formFlow
 * └── types/, constants/                  тип формы и значения источников данных
 * ```
 *
 * Поэтому файлы читаются от РОДИТЕЛЯ папки `schema/` ({@link locateModule}): от каталога
 * документа превью увидело бы только `schema/**`, а импорт `../types/…` из набора с таким корнем
 * линковщик отвергает — путь выходит за корень набора.
 *
 * ## Исполняются роли, а не «всё, что лежит в корне»
 *
 * Точка входа требует файлы ролей ({@link planModule}); остальное подтягивает линковщик по
 * импортам. Страница, реэкспорты и сборка приложения (`application/create.ts`,
 * `application/entry.ts`) ролью не являются: превью собирает форму само — из живой схемы
 * редактора, реестра кита, мока и фикстуры, — а исполнить страницу значило бы смонтировать
 * приложение внутрь приложения. Эти файлы до линковщика не доходят вовсе (`ModulePlan.skipped`):
 * «не затребован» держалось бы на том, что их никто не импортирует, а «нет в наборе» — правило.
 *
 * ## Имя формы в пути — подсказка, а не условие
 *
 * Файл потока зовётся по имени формы (`flow/<форма>-flow.ts`). Папку формы переименовывают, не
 * перегенерируя код, и точное имя тогда не совпадает — поэтому поток ищется по ПАПКЕ роли: файл
 * с ожидаемым именем идёт первым, остальные файлы `flow/` — за ним.
 *
 * ## Прежняя плоская раскладка — запасной путь
 *
 * Модуль прежнего контракта держит всё в корне (`registry.ts`, `model.ts`, `form.behavior.ts`,
 * `form.validation.ts`, `form.render.ts`, шаги — в `steps/<шаг>/`). Он открывается как раньше:
 * точка входа требует корневые файлы.
 *
 * Раскладку выдают два признака, и хватает любого. Документ лежит в `schema/` — модуль разложен
 * по ролям по определению: в его корне стоит страница, и исполнять корень нельзя, даже если
 * файлов ролей ещё нет. Документ в корне модуля — решают файлы ролей: есть хоть один — модуль
 * новый (его перегенерировали на месте), и оставшиеся в корне файлы прежнего контракта не
 * исполняются вовсе: они привязали бы отправку второй раз.
 *
 * @module plugins/reformer/render/compiling/module
 */

import type { ResourceId } from '@reformer/builder-plugin-api';
import {
  formNameOfSchemaPath,
  makeNames,
  moduleDirOfSchemaPath,
  moduleFilesOf,
  type ModuleFiles,
} from '../../../core/codegen';

/** Роль файла в сборке превью: какой артефакт формы из него берётся. */
export type ModuleRole =
  | 'initial'
  | 'validation'
  | 'flow'
  | 'behavior'
  | 'submit'
  | 'renderBehavior'
  | 'registry';

/** Раскладка модуля: папки по ролям либо прежняя плоская. */
export type ModuleLayout = 'roles' | 'flat';

/** Что исполнять в модуле и где искать каждый артефакт. */
export interface ModulePlan {
  readonly layout: ModuleLayout;
  /** Файлы-кандидаты роли в порядке предпочтения. Пусто — у раскладки такой роли нет. */
  readonly roles: Readonly<Record<ModuleRole, readonly string[]>>;
  /** Файлы, которые требует точка входа, в порядке исполнения. */
  readonly entry: readonly string[];
  /**
   * Файлы, которые в набор линковщика не идут: страница модуля и сборка приложения. Импорт
   * такого файла из файла роли — отказ линковки с именем импортёра, а не исполнение страницы.
   */
  readonly skipped: readonly string[];
}

/** Где лежит модуль формы относительно её документа. */
export interface ModuleLocation {
  /** Каталог модуля — от него читаются файлы. */
  readonly root: ResourceId;
  /** Путь документа от корня модуля: `schema/form.schema.json` либо `form.schema.json`. */
  readonly document: string;
}

/** Расширения исполняемых файлов. */
const SCRIPT = /\.tsx?$/;

/**
 * Файлы ролей прежней плоской раскладки — корень модуля.
 *
 * Первым идёт имя, которое печатал кодоген (`form.*`), дальше — имена до него: прежнее
 * `renderer.behavior.ts` и `validation.ts`, дефисные имена ранних шаблонов билдера и совсем
 * ранние `behavior.ts` / `ui.ts`. Форма, сгенерированная давно, обязана оживать тоже — иначе
 * «превью не работает» означало бы «превью не работает на моём проекте».
 *
 * Потока шагов и отдельной отправки у прежнего контракта нет: шаг проверял `makeStepCheck`
 * визарда, а отправку привязывал `form.render.ts`.
 */
const FLAT_ROLES: Readonly<Record<ModuleRole, readonly string[]>> = Object.freeze({
  initial: ['model.ts', 'model.tsx'],
  validation: ['form.validation.ts', 'validation.ts'],
  flow: [],
  behavior: ['form.behavior.ts', 'form-behavior.ts', 'behavior.ts'],
  submit: [],
  renderBehavior: ['form.render.ts', 'renderer.behavior.ts', 'render-behavior.ts', 'ui.ts'],
  registry: ['registry.ts', 'registry.tsx'],
});

/**
 * Порядок исполнения ролей. От него зависит только порядок НЕСВЯЗАННЫХ файлов — связанные
 * линковщик исполнит по импортам, — но порядок обязан быть одним и тем же между запусками.
 */
const ROLE_ORDER: readonly ModuleRole[] = [
  'initial',
  'validation',
  'flow',
  'behavior',
  'submit',
  'renderBehavior',
  'registry',
];

/** Роли, по файлам которых узнаётся раскладка «папки по ролям». */
const MARKER_ROLES: readonly ModuleRole[] = [
  'initial',
  'validation',
  'behavior',
  'submit',
  'registry',
];

/** Имя документа в корне модуля, когда о документе ничего не известно. */
const UNKNOWN_DOCUMENT = 'form.schema.json';

/**
 * Раскладка формы без имени и с документом в корне: пути, не зависящие от имени формы, у неё те
 * же, а о месте документа она ничего не утверждает — раскладку тогда выдают только файлы ролей.
 */
const UNNAMED: ModuleFiles = moduleFilesOf({ dir: 'form', TypeName: 'Form' }, UNKNOWN_DOCUMENT);

/** Каталог пути; у файла без каталога — пустая строка. */
function dirOf(path: string): string {
  const at = path.lastIndexOf('/');
  return at < 0 ? '' : path.slice(0, at);
}

/** Путь и его `.tsx`-двойник: реестр и поведение вправе нести JSX. */
function withTsx(path: string): readonly string[] {
  return [path, path.replace(/\.ts$/, '.tsx')];
}

/**
 * Путь документа от корня его модуля: `schema/form.schema.json` либо `form.schema.json`.
 *
 * Документ глубже корня модуля ровно в одном случае — он лежит в `schema/`.
 */
function documentInModule(schemaPath: string): string {
  const path = schemaPath.replace(/\\/g, '/');
  const moduleDir = moduleDirOfSchemaPath(path);
  return moduleDir === '' ? path : path.slice(moduleDir.length + 1);
}

/**
 * Раскладка модуля для документа по такому пути.
 *
 * Имена, зависящие от имени формы (`flow/<форма>-flow.ts`), выводятся из каталога модуля — тем
 * же правилом, которым кодоген называет форму, открытую как документ. Поле `schema` — путь
 * документа от корня модуля: по нему план узнаёт, что документ лежит в `schema/`.
 */
export function moduleFilesFor(schemaPath: string): ModuleFiles {
  return moduleFilesOf(
    makeNames(formNameOfSchemaPath(schemaPath)),
    documentInModule(schemaPath) || UNKNOWN_DOCUMENT
  );
}

/**
 * Где лежит модуль формы.
 *
 * Документ в папке `schema/` — модуль в её родителе; иначе модуль там же, где документ (форма
 * прежней плоской раскладки). Правило одно на кодоген, фикстуры и превью —
 * `moduleDirOfSchemaPath`; арифметику адресов делает платформа (`parentOf`), превью лишь решает,
 * сколько раз подняться.
 *
 * @param parentOf - Каталог ресурса (порт превью).
 * @param id - Адрес документа формы.
 * @param schemaPath - Путь документа от корня проекта.
 */
export function locateModule(
  parentOf: (id: ResourceId) => ResourceId,
  id: ResourceId,
  schemaPath: string
): ModuleLocation {
  const document = documentInModule(schemaPath);
  const directory = parentOf(id);
  return { root: document.includes('/') ? parentOf(directory) : directory, document };
}

/**
 * Что исполнять в модуле с такими файлами.
 *
 * @param paths - Пути файлов модуля от его корня.
 * @param files - Раскладка модуля ({@link moduleFilesFor}): имена, зависящие от имени формы, и
 *   место документа. По умолчанию — раскладка без имени и с документом в корне: поток тогда
 *   ищется только по папке роли, а раскладку выдают только файлы ролей.
 */
export function planModule(paths: Iterable<string>, files: ModuleFiles = UNNAMED): ModulePlan {
  const present = [...paths];
  const has = new Set(present);

  const flowDir = dirOf(files.flow);
  const candidates: Record<ModuleRole, readonly string[]> = {
    initial: [files.initial],
    validation: [files.validation],
    // Файл с ожидаемым именем — первым; за ним остальные файлы папки потока: имя формы в пути —
    // подсказка, а не условие (см. модуль).
    flow: [
      files.flow,
      ...present
        .filter((path) => path !== files.flow && dirOf(path) === flowDir && SCRIPT.test(path))
        .sort((a, b) => a.localeCompare(b)),
    ],
    behavior: withTsx(files.behavior),
    submit: [files.submit],
    renderBehavior: [],
    registry: withTsx(files.registry),
  };

  // Документ в `schema/` — модуль разложен по ролям, что бы в нём ни лежало; документ в корне
  // — решают файлы ролей (см. модуль).
  const isRoles =
    dirOf(files.schema) !== '' ||
    MARKER_ROLES.some((role) => candidates[role].some((file) => has.has(file)));
  if (!isRoles) {
    return {
      layout: 'flat',
      roles: FLAT_ROLES,
      // Прежняя раскладка исполняется как раньше: все файлы корня, каждый — в своём `try`.
      // Файлы папок шагов (`steps/index.ts`, `steps/<шаг>/…`) подтягивает линковщик по импортам.
      entry: present.filter((path) => !path.includes('/')),
      // Страницу прежней раскладки (корневой `index.tsx`) отсекает сам отбор набора.
      skipped: [],
    };
  }

  // В плане — только то, что в модуле есть: кандидат без файла точке входа не нужен.
  const kept = (role: ModuleRole): readonly string[] =>
    candidates[role].filter((file) => has.has(file));
  const roles: Record<ModuleRole, readonly string[]> = {
    initial: kept('initial'),
    validation: kept('validation'),
    flow: kept('flow'),
    behavior: kept('behavior'),
    submit: kept('submit'),
    renderBehavior: kept('renderBehavior'),
    registry: kept('registry'),
  };
  return {
    layout: 'roles',
    roles,
    entry: ROLE_ORDER.flatMap((role) => roles[role]),
    // Имя страницы зависит от имени формы: после переименования папки оно не совпадёт, и
    // страница останется в наборе — незатребованной, то есть всё равно не исполненной.
    skipped: [files.page, files.barrel, files.create, files.entry].filter((file) => has.has(file)),
  };
}
