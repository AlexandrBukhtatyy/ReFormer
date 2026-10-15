/**
 * Компиляция модуля формы в браузере — тем же механизмом, что и в билдере.
 *
 * ## Что здесь СВОЁ, а что взято
 *
 * Взяты линковщик, реестр модулей и транспилятор (`@builder-src/shell/platform/modules/*`): копия
 * разошлась бы с оригиналом на первой правке, а весь смысл демо — показать НАСТОЯЩИЙ механизм.
 * Своё здесь — план модуля и разбор его экспортов: превью билдера выводит их из раскладки
 * открытого документа (`plugins/reformer/render/compiling/{module,exports}`), а странице хватает
 * четырёх файлов ролей с постоянными именами.
 *
 * ## Модуль формы — папки по ролям
 *
 * Исполняются файлы РОЛЕЙ, и у каждой роли свои экспорты ({@link ROLE_FILES},
 * {@link extractContract}):
 *
 * | файл                     | экспорт                         | что это                              |
 * | ------------------------ | ------------------------------- | ------------------------------------ |
 * | `model/initial-value.ts` | `createInitialValues`           | начальные значения — фабрикой        |
 * | `validation/form.ts`     | `formValidation`                | `FormValidation` сборки              |
 * | `behavior/index.ts`      | `behaviorRules`, `formBehavior` | правила функцией и готовое поведение |
 * | `application/submit.ts`  | `wireSubmit`                    | отправка над областью поведения      |
 *
 * Поведение у формы одно: правила узлов схемы (`hideWhen`, `onComponentEvent`) живут в том же
 * `defineFormBehavior`, что и связи над моделью. Отдельного файла слоя рендера нет.
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
 * Она подставляет модули, которые импортируют файлы ролей (`../api`). Окажись оба в одном графе,
 * подменяемый модуль исполнился бы дважды и дал два разных объекта — ровно та потеря идентичности,
 * ради защиты от которой линковщик и написан.
 *
 * @module pages/debug/ui_builder/compile
 */

import type { CreateFormConfig } from '@reformer/core';
import * as reformerCore from '@reformer/core';
import type { BehaviorScope } from '@reformer/core/behaviors';
import * as reformerBehaviors from '@reformer/core/behaviors';
import * as reformerReact from '@reformer/core/react';
import * as reformerValidation from '@reformer/core/validation';
import * as reformerValidators from '@reformer/core/validators';
import * as rendererJson from '@reformer/renderer-json';
import * as rendererReact from '@reformer/renderer-react';
import * as signalsCore from '@preact/signals-core';

import { createModuleLoader } from '@builder-src/shell/platform/modules/loader';
import { createModuleRegistry } from '@builder-src/shell/platform/modules/registry';
import { createTypeScriptSupport } from '@builder-src/shell/platform/plugin/typescript-transpiler';
import {
  createAmbient,
  FIXTURE_EXPORT,
  FIXTURE_FILE,
  type FormFixture,
} from '@reformer-domain/core/form-fixture';

/** Форма данных модели: она приходит из текстов, и сузить её нечем. */
export type Shape = Record<string, unknown>;

type FormConfig = CreateFormConfig<Shape>;

/** Сбой сборки — данные, а не исключение: битый исходник это обычное состояние редактора. */
export interface BuildProblem {
  readonly file: string;
  readonly phase: string;
  readonly message: string;
}

/** Роль файла в сборке формы: какой артефакт из него берётся. */
export type ModuleRole = 'initial' | 'validation' | 'behavior' | 'submit';

/**
 * Файлы ролей раскладки «папки по ролям» — пути от корня модуля.
 *
 * Имена постоянны: от имени формы зависят только тип (`types/<форма>.ts`) и поток шагов визарда,
 * а ролями они не являются — тип транспилятор стирает, потока у простой формы нет.
 */
export const ROLE_FILES: Readonly<Record<ModuleRole, string>> = Object.freeze({
  initial: 'model/initial-value.ts',
  validation: 'validation/form.ts',
  behavior: 'behavior/index.ts',
  submit: 'application/submit.ts',
});

/**
 * Порядок исполнения ролей. От него зависит только порядок НЕСВЯЗАННЫХ файлов — связанные
 * линковщик исполнит по импортам, — но порядок обязан быть одним и тем же между запусками.
 */
const ROLE_ORDER: readonly ModuleRole[] = ['initial', 'validation', 'behavior', 'submit'];

/** Что дала компиляция набора. */
export interface CompiledSources {
  /** Экспорты файлов ролей: путь файла от корня модуля → модуль. */
  readonly modules: ReadonlyMap<string, unknown>;
  readonly fixture: FormFixture | null;
  readonly problems: readonly BuildProblem[];
}

/**
 * Загрузчик модулей — один на страницу.
 *
 * Реестр заполняется теми же объектами, которые импортирует сама страница: это и есть
 * защита идентичности. Создаётся лениво, чтобы демо не платило за себя, пока его не открыли.
 */
let shared: ReturnType<typeof createLoader> | null = null;

function createLoader() {
  // Состав тот же, что билдер отдаёт коду формы (`application/runtime/forms`). Тексту демо
  // хватает первых шести имён: операторы узлов (`hideWhen`, `onComponentEvent`) — в
  // `@reformer/core/behaviors`. Рендереры оставлены, чтобы правка текста могла их импортировать.
  const registry = createModuleRegistry([
    ['@preact/signals-core', signalsCore],
    ['@reformer/core', reformerCore],
    ['@reformer/core/behaviors', reformerBehaviors],
    ['@reformer/core/react', reformerReact],
    ['@reformer/core/validation', reformerValidation],
    ['@reformer/core/validators', reformerValidators],
    ['@reformer/renderer-json', rendererJson],
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

const isFn = (value: unknown): value is (...args: never[]) => unknown =>
  typeof value === 'function';

const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

/**
 * Снимает имя файла с начала текста, если линковщик его туда приписал.
 *
 * `ModuleLinkError` печатает «файл: причина», а находка несёт файл отдельным полем — иначе
 * страница показала бы «validation/form.ts [transpile] validation/form.ts: …».
 */
function stripFilePrefix(file: string, message: string): string {
  const prefix = `${file}: `;
  return file !== '' && message.startsWith(prefix) ? message.slice(prefix.length) : message;
}

/** Имя синтетической точки входа. `.js` — транспилятор на файл, который мы сами напечатали, не нужен. */
const ENTRY_FILE = '__entry__.js';

/**
 * Синтетическая точка входа.
 *
 * Один граф на весь набор — иначе `validation/form.ts`, который импортирует ещё и
 * `application/submit.ts`, исполнился бы дважды и дал два РАЗНЫХ набора правил. `try` вокруг
 * каждого require сохраняет пофайловую изоляцию: битая валидация не лишает форму работающего
 * поведения. Файл, который импортирует упавший, падёт следом — и это правда, а не потеря
 * изоляции: без правил отправке проверять нечем.
 *
 * Сбой относится к файлу, который назвала ошибка линковщика: импортёр не виноват, что его
 * `../validation/form` не собрался. Точка входа исполняется как чужой код и импортировать класс
 * ошибки не может, поэтому читает её поля по форме.
 */
function entrySource(files: readonly string[]): string {
  const lines = files.map((file) => {
    const key = JSON.stringify(file);
    return (
      `try { modules[${key}] = require(${JSON.stringify(`./${file}`)}); } ` +
      `catch (error) { errors.push(failure(${key}, error)); }`
    );
  });
  return [
    'var modules = {};',
    'var errors = [];',
    'function failure(file, error) {',
    '  var out = { file: file, message: error && error.message ? String(error.message) : String(error) };',
    "  if (error && typeof error.file === 'string' && error.file !== '') out.file = error.file;",
    "  if (error && typeof error.phase === 'string') out.phase = error.phase;",
    '  return out;',
    '}',
    ...lines,
    'module.exports = { modules: modules, errors: errors };',
    '',
  ].join('\n');
}

interface EntryResult {
  readonly modules: Record<string, unknown>;
  readonly errors: readonly { file: string; message: string; phase?: string }[];
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
    message: stripFilePrefix(error.file, error.message),
  }));
  const exported = (graph.entry as Record<string, unknown> | undefined)?.[FIXTURE_EXPORT];
  if (exported === undefined) {
    if (problems.length === 0) {
      problems.push({
        file: FIXTURE_FILE,
        phase: 'evaluate',
        message: `фикстура не экспортирует «${FIXTURE_EXPORT}» — форма её не увидит`,
      });
    }
    return { fixture: null, problems };
  }
  return { fixture: isObject(exported) ? (exported as FormFixture) : null, problems };
}

/**
 * Компилирует набор: сначала фикстуру, потом файлы модуля с её подстановками.
 *
 * Точка входа требует файлы РОЛЕЙ; остальное (тип формы) в наборе есть, но исполняется, только
 * если его импортировали. Не бросает никогда: всё, что не собралось, приезжает списком, а форма
 * строится из того, что исполнилось.
 *
 * @param files - Путь файла от корня модуля → текст.
 */
export async function compileSources(files: ReadonlyMap<string, string>): Promise<CompiledSources> {
  const problems: BuildProblem[] = [];
  const report = (next: BuildProblem): void => {
    // Два файла, импортирующих один битый, приносят одну и ту же находку дважды: она названа
    // файлом-виновником, а не импортёром, — и второй раз ничего не добавляет.
    const seen = problems.some(
      (known) =>
        known.file === next.file && known.phase === next.phase && known.message === next.message
    );
    if (!seen) problems.push(next);
  };

  let fixture: FormFixture | null = null;
  try {
    const loaded = await runFixture(files.get(FIXTURE_FILE) ?? '');
    fixture = loaded.fixture;
    loaded.problems.forEach(report);
  } catch (error) {
    report({ file: FIXTURE_FILE, phase: 'evaluate', message: describe(error) });
  }

  // Фикстура в набор модуля не входит: разделение графов держится на имени файла.
  const module = new Map([...files].filter(([name]) => name !== FIXTURE_FILE));
  const required = ROLE_ORDER.map((role) => ROLE_FILES[role]).filter((file) => module.has(file));
  module.set(ENTRY_FILE, entrySource(required));

  try {
    const graph = await runGraph(module, ENTRY_FILE, {
      overrides:
        fixture?.modules === undefined ? undefined : new Map(Object.entries(fixture.modules)),
      ambient: createAmbient(fixture),
    });
    for (const error of graph.errors) {
      report({
        file: error.file,
        phase: error.phase,
        message: stripFilePrefix(error.file, error.message),
      });
    }
    const result = graph.entry as EntryResult | undefined;
    if (result === undefined) {
      return { modules: new Map(), fixture, problems };
    }
    for (const failure of result.errors) {
      report({
        file: failure.file,
        phase: failure.phase ?? 'evaluate',
        message: stripFilePrefix(failure.file, failure.message),
      });
    }
    return { modules: new Map(Object.entries(result.modules)), fixture, problems };
  } catch (error) {
    report({ file: '', phase: 'evaluate', message: describe(error) });
    return { modules: new Map(), fixture, problems };
  }
}

/** Правила поведения модуля функцией над областью — экспорт `behaviorRules`. */
export type BehaviorRules = (scope: BehaviorScope<Shape>) => void;

/** Куда отправка сообщает итог: текст для человека и признак успеха. */
export type SubmitResultHandler = (message: string, ok: boolean) => void;

/** Отправка модуля над областью поведения — экспорт `wireSubmit`. */
export type WireSubmit = (
  scope: BehaviorScope<Shape>,
  options: { readonly onResult?: SubmitResultHandler }
) => void;

/**
 * Что файлы ролей отдали форме. Имена экспортов — те же, что ищет превью билдера. Любое поле
 * может отсутствовать: форма деградирует частями.
 *
 * Типы `validation` и `behavior` взяты ИЗ конфигурации единой сборки (`CreateFormConfig`), а не
 * объявлены заново: собственное объявление разошлось бы с фабрикой на первом же изменении.
 */
export interface FormContract {
  /** Начальные значения — фабрикой (`createInitialValues`). */
  readonly createInitialValues?: () => unknown;
  /** Валидация сборки (`formValidation`): `{ rules }` со стратегией либо голый набор правил. */
  readonly validation?: FormConfig['validation'];
  /** Готовое поведение формы (`formBehavior`). */
  readonly behavior?: FormConfig['behavior'];
  /**
   * Те же правила ФУНКЦИЕЙ над областью (`behaviorRules`).
   *
   * Двумя экспортами — не дублирование: сборка дописывает к правилам отправку (`wireSubmit`) и
   * только потом заворачивает их в поведение. Так делает `application/create.ts` модуля, и так же
   * делает страница, потому что итог отправки ей нужен свой.
   */
  readonly behaviorRules?: BehaviorRules;
  /** Отправка над областью поведения (`wireSubmit`). */
  readonly wireSubmit?: WireSubmit;
}

/** Разбирает исполненные модули в контракт формы. */
export function extractContract(modules: ReadonlyMap<string, unknown>): FormContract {
  const pick = (role: ModuleRole, name: string): unknown => {
    const exports = modules.get(ROLE_FILES[role]);
    return isObject(exports) ? exports[name] : undefined;
  };
  const contract: { -readonly [Key in keyof FormContract]: FormContract[Key] } = {};

  const createInitialValues = pick('initial', 'createInitialValues');
  if (isFn(createInitialValues)) {
    contract.createInitialValues = createInitialValues as () => unknown;
  }

  // Проверка формы, а не вера в имя экспорта: значение другого вида уронило бы сборку целиком,
  // и вместо формы без проверки человек увидел бы «форма не собралась».
  const validation = pick('validation', 'formValidation');
  if (isObject(validation) || isFn(validation)) {
    contract.validation = validation as FormConfig['validation'];
  }

  const behavior = pick('behavior', 'formBehavior');
  if (isObject(behavior)) contract.behavior = behavior as unknown as FormConfig['behavior'];

  const behaviorRules = pick('behavior', 'behaviorRules');
  if (isFn(behaviorRules)) contract.behaviorRules = behaviorRules as BehaviorRules;

  const wireSubmit = pick('submit', 'wireSubmit');
  if (isFn(wireSubmit)) contract.wireSubmit = wireSubmit as WireSubmit;

  return contract;
}

/**
 * Подключается ли отправка модуля: для этого нужны обе половины — правила функцией и
 * `wireSubmit`. Иначе берётся готовое `formBehavior`, а отправка остаётся неподключённой.
 */
function wiresSubmit(contract: FormContract): boolean {
  return contract.behaviorRules !== undefined && contract.wireSubmit !== undefined;
}

/** Что реально подключилось — для сводки над формой. */
export type AppliedArtifact = 'model' | 'validation' | 'behavior' | 'submit';

/** Список подключённых артефактов в порядке показа. */
export function appliedArtifacts(contract: FormContract): readonly AppliedArtifact[] {
  const out: AppliedArtifact[] = [];
  if (contract.createInitialValues !== undefined) out.push('model');
  if (contract.validation !== undefined) out.push('validation');
  if (contract.behavior !== undefined || contract.behaviorRules !== undefined) out.push('behavior');
  if (wiresSubmit(contract)) out.push('submit');
  return out;
}

/**
 * Исполняет фабрику начальных значений — раз на компиляцию.
 *
 * Отдельным шагом, а не при разборе: фабрика — код автора, и она вправе бросить. Её отказ форму
 * не роняет — он становится находкой с именем файла, а значения берутся из синтеза по схеме.
 */
export function runInitialValues(contract: FormContract): {
  readonly initial?: Shape;
  readonly problems: readonly BuildProblem[];
} {
  const factory = contract.createInitialValues;
  if (factory === undefined) return { problems: [] };
  try {
    const values = factory();
    // Не объект — значит фабрика вернула не значения формы: поверх синтеза такое не кладётся.
    return isObject(values) ? { initial: values, problems: [] } : { problems: [] };
  } catch (error) {
    return {
      problems: [{ file: ROLE_FILES.initial, phase: 'evaluate', message: describe(error) }],
    };
  }
}
