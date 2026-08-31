/**
 * Компиляция формы в браузере — тем же механизмом, что и в билдере v2.
 *
 * ## Что здесь СВОЁ, а что взято
 *
 * Взяты линковщик, реестр модулей и транспилятор (`@builder-src/host/modules/*`): копия
 * разошлась бы с оригиналом на первой правке, а весь смысл демо — показать НАСТОЯЩИЙ механизм.
 * Своя здесь только сборка формы: билдер собирает её из каталога кита и аннотированной схемы,
 * а странице хватает реестра из пяти компонентов.
 *
 * ## Почему нельзя просто `import()`
 *
 * Внутри blob-модуля bare-спецификаторы резолвит браузер, то есть `@reformer/core` приехал бы
 * ВТОРЫМ экземпляром — и форма потеряла бы связь сигналов с узлами (`instanceof Signal`,
 * `getNodeForSignal`). Поэтому CommonJS-конверт с подставленным `require`, который отдаёт коду
 * ровно те объекты модулей, которыми пользуется страница.
 *
 * ## Фикстура исполняется ОТДЕЛЬНЫМ графом
 *
 * Она подставляет модули, которые импортируют сайдкары. Окажись оба в одном графе, подменяемый
 * модуль исполнился бы дважды и дал два разных объекта — ровно та потеря идентичности, ради
 * защиты от которой линковщик и написан.
 *
 * @module pages/debug/ui_builder/compile
 */

import * as reformerCore from '@reformer/core';
import * as reformerBehaviors from '@reformer/core/behaviors';
import * as reformerValidation from '@reformer/core/validation';
import * as reformerValidators from '@reformer/core/validators';
import * as rendererJson from '@reformer/renderer-json';
import * as rendererReact from '@reformer/renderer-react';
import * as signalsCore from '@preact/signals-core';

import { createModuleLoader } from '@builder-src/host/modules/loader';
import { createModuleRegistry } from '@builder-src/host/modules/registry';
import { createTypeScriptSupport } from '@builder-src/host/plugin/typescript-transpiler';
import { createAmbient, type FormFixture } from '@builder-src/lib/form-fixture';

/** Сбой сборки — данные, а не исключение: битый исходник это обычное состояние редактора. */
export interface BuildProblem {
  readonly file: string;
  readonly phase: string;
  readonly message: string;
}

/** Что дала компиляция набора. */
export interface CompiledSources {
  /** Экспорты сайдкаров: имя файла → модуль. */
  readonly modules: ReadonlyMap<string, unknown>;
  readonly fixture: FormFixture | null;
  readonly problems: readonly BuildProblem[];
}

/** Имя файла фикстуры внутри демо-набора. */
export const FIXTURE_FILE = 'fixture.ts';

/**
 * Загрузчик модулей — один на страницу.
 *
 * Реестр заполняется теми же объектами, которые импортирует сама страница: это и есть
 * защита идентичности. Создаётся лениво, чтобы демо не платило за себя, пока его не открыли.
 */
let shared: ReturnType<typeof createLoader> | null = null;

function createLoader() {
  const registry = createModuleRegistry([
    ['@preact/signals-core', signalsCore],
    ['@reformer/core', reformerCore],
    ['@reformer/core/behaviors', reformerBehaviors],
    ['@reformer/core/validation', reformerValidation],
    ['@reformer/core/validators', reformerValidators],
    ['@reformer/renderer-json', rendererJson],
    // Нужен поведению РЕНДЕРА: `hideWhen`, `onComponentEvent`, `patchProps` живут здесь.
    ['@reformer/renderer-react', rendererReact],
  ]);
  const modules = createModuleLoader({ registry });
  const typescript = createTypeScriptSupport(modules.transpilers);
  // Реестр держим отдельно: `ModuleLoader.registry` сужен до контракта и диагностику не отдаёт.
  return { modules, registry, typescript };
}

function loader() {
  shared ??= createLoader();
  return shared;
}

/** Доступные коду формы имена — их показывает страница, чтобы отказ не выглядел загадкой. */
export function knownSpecifiers(): readonly string[] {
  return loader().registry.specifiers();
}

const describe = (error: unknown): string =>
  error instanceof Error ? error.message : String(error);

/**
 * Синтетическая точка входа.
 *
 * Один граф на весь набор — иначе `model.ts`, импортированный двумя сайдкарами, исполнился бы
 * дважды и дал два РАЗНЫХ объекта. `try` вокруг каждого require сохраняет пофайловую изоляцию:
 * битая валидация не лишает форму работающего поведения.
 */
function entrySource(names: readonly string[]): string {
  const lines = names.map(
    (name) =>
      `try { modules[${JSON.stringify(name)}] = require(${JSON.stringify(`./${name}`)}); }\n` +
      `catch (error) { errors.push({ file: ${JSON.stringify(name)}, message: String(error && error.message || error) }); }`
  );
  return `const modules = {};\nconst errors = [];\n${lines.join('\n')}\nmodule.exports = { modules, errors };`;
}

interface EntryResult {
  readonly modules: Record<string, unknown>;
  readonly errors: readonly { file: string; message: string }[];
}

/** Исполняет один набор файлов и отдаёт экспорты. */
async function runGraph(
  files: ReadonlyMap<string, string>,
  entry: string,
  options: { overrides?: ReadonlyMap<string, unknown>; ambient?: Readonly<Record<string, unknown>> }
) {
  const { modules, typescript } = loader();
  // Прогрев ДО линковки: `require` внутри модуля синхронен, а движок приезжает лениво.
  await typescript.ensure([...files.keys()]);
  return modules.load(files, entry, options);
}

/** Компилирует фикстуру. Её отсутствие законно; сбой — нет и показывается. */
async function runFixture(source: string): Promise<{
  fixture: FormFixture | null;
  problems: BuildProblem[];
}> {
  if (source.trim() === '') return { fixture: null, problems: [] };
  const graph = await runGraph(new Map([[FIXTURE_FILE, source]]), FIXTURE_FILE, {});
  const problems = graph.errors.map((error) => ({
    file: error.file,
    phase: error.phase,
    message: error.message,
  }));
  const exported = (graph.entry as Record<string, unknown> | undefined)?.fixture;
  if (exported === undefined) {
    if (problems.length === 0) {
      problems.push({
        file: FIXTURE_FILE,
        phase: 'evaluate',
        message: 'фикстура не экспортирует «fixture» — форма её не увидит',
      });
    }
    return { fixture: null, problems };
  }
  return { fixture: exported as FormFixture, problems };
}

/**
 * Компилирует набор: сначала фикстуру, потом сайдкары с её подстановками.
 *
 * Не бросает никогда: всё, что не собралось, приезжает списком, а форма строится из того,
 * что исполнилось.
 */
export async function compileSources(files: ReadonlyMap<string, string>): Promise<CompiledSources> {
  const problems: BuildProblem[] = [];

  let fixture: FormFixture | null = null;
  try {
    const loaded = await runFixture(files.get(FIXTURE_FILE) ?? '');
    fixture = loaded.fixture;
    problems.push(...loaded.problems);
  } catch (error) {
    problems.push({ file: FIXTURE_FILE, phase: 'evaluate', message: describe(error) });
  }

  const sidecars = new Map([...files].filter(([name]) => name !== FIXTURE_FILE));
  const names = [...sidecars.keys()];
  const entry = '__entry__.js';
  sidecars.set(entry, entrySource(names));

  try {
    const graph = await runGraph(sidecars, entry, {
      overrides:
        fixture?.modules === undefined ? undefined : new Map(Object.entries(fixture.modules)),
      ambient: createAmbient(fixture),
    });
    for (const error of graph.errors) {
      problems.push({ file: error.file, phase: error.phase, message: error.message });
    }
    const result = graph.entry as EntryResult | undefined;
    if (result === undefined) {
      return { modules: new Map(), fixture, problems };
    }
    for (const failure of result.errors) {
      problems.push({ file: failure.file, phase: 'evaluate', message: failure.message });
    }
    return { modules: new Map(Object.entries(result.modules)), fixture, problems };
  } catch (error) {
    problems.push({ file: '', phase: 'evaluate', message: describe(error) });
    return { modules: new Map(), fixture, problems };
  }
}

/** Что сайдкары отдали форме. Имена экспортов — те же, что ищет билдер. */
export interface FormContract {
  readonly initial?: Record<string, unknown>;
  readonly behavior?: unknown;
  readonly validation?: unknown;
  /**
   * Фабрика поведения РЕНДЕРА: submit, видимость узлов, события компонентов.
   *
   * Отдельно от `behavior` не по прихоти раскладки: то поведение работает со ЗНАЧЕНИЯМИ
   * модели, а это — с УЗЛАМИ схемы (`schema.node(selector)`). Одно нельзя выразить другим,
   * поэтому и файлов два.
   */
  readonly renderBehavior?: unknown;
}

/** Разбирает исполненные модули в контракт формы. */
export function extractContract(modules: ReadonlyMap<string, unknown>): FormContract {
  const pick = (file: string, name: string): unknown => {
    const exports = modules.get(file);
    return typeof exports === 'object' && exports !== null
      ? (exports as Record<string, unknown>)[name]
      : undefined;
  };
  const initial = pick('model.ts', 'initialFormModel');
  // Имена фабрики исторически три: кодоген билдера печатает `createJsonRenderBehavior`,
  // шаблон визарда — `createRenderBehavior`, ранние формы — готовую `formRenderBehavior`.
  // Разбор тот же, что в билдере (`plugins/preview/compiling/exports`), и по той же причине:
  // различаем по ИМЕНИ экспорта, а не по арности — обе функции одного аргумента.
  const renderBehavior =
    pick('renderer.behavior.ts', 'createJsonRenderBehavior') ??
    pick('renderer.behavior.ts', 'createRenderBehavior') ??
    wrapReady(pick('renderer.behavior.ts', 'formRenderBehavior'));

  return {
    initial:
      typeof initial === 'object' && initial !== null
        ? (initial as Record<string, unknown>)
        : undefined,
    behavior: pick('form.behavior.ts', 'formBehavior'),
    validation: pick('validation.ts', 'formValidation'),
    renderBehavior,
  };
}

/** Готовая функция — это фабрика, которой нечего спрашивать. Заворачиваем, чтобы вход был один. */
function wrapReady(value: unknown): unknown {
  return typeof value === 'function' ? () => value : undefined;
}
