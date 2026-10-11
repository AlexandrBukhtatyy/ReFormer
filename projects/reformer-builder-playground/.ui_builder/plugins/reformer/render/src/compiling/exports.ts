/**
 * Контракт модуля формы: какие экспорты превью ищет в исполненных файлах ролей.
 *
 * ## Раскладка «папки по ролям» — имена общие
 *
 * | файл                     | экспорт                        | что это                              |
 * | ------------------------ | ------------------------------ | ------------------------------------ |
 * | `model/initial-value.ts` | `createInitialValues`          | начальные значения — фабрикой        |
 * | `validation/form.ts`     | `formValidation`               | `FormValidation` сборки              |
 * | `flow/<форма>-flow.ts`   | `formFlow`                     | поток шагов визарда                  |
 * | `behavior/index.ts`      | `behaviorRules`, `formBehavior`| правила функцией и готовое поведение |
 * | `application/submit.ts`  | `wireSubmit`                   | отправка над областью поведения      |
 * | `schema/registry.ts`     | `createRegistry`               | реестр компонентов и источников      |
 *
 * Где искать каждый файл, решает план модуля (`./module`): здесь только имена экспортов и их
 * проверка по форме.
 *
 * ## Поведение — двумя экспортами, и это не дублирование
 *
 * `formBehavior` — готовое поведение формы. `behaviorRules` — те же правила ФУНКЦИЕЙ над
 * областью: сборка приложения дописывает к ним отправку (`wireSubmit`) и только потом заворачивает
 * в поведение. Превью делает то же самое, потому что итог отправки ему нужен свой — показать под
 * рукой, а не на странице приложения. Нет одной из двух половин — берётся `formBehavior` как есть.
 *
 * ## Прежняя плоская раскладка
 *
 * Имён у одного и того же по смыслу артефакта там исторически несколько: шаблон простой формы
 * отдавал готовую функцию `formRenderBehavior`, шаблон визарда — фабрику
 * `createRenderBehavior(form, model)`, кодоген билдера печатал `createJsonRenderBehavior`, а
 * начальные значения лежали объектом `initialFormModel`. Разбор этих вариантов собран здесь,
 * чтобы сборка превью не знала о них ничего.
 *
 * ## Различаем по ИМЕНИ экспорта, а не по арности
 *
 * `RenderBehaviorFn` — тоже функция одного аргумента, и отличить её от фабрики по сигнатуре
 * невозможно. Попытка «угадать по числу параметров» дала бы правдоподобную и неверную сборку:
 * поведение подключилось бы, но получило бы не то, что ждёт.
 *
 * ## Типы берутся ИЗ конфигурации фабрики, а не объявляются заново
 *
 * `validation`, `behavior` и `flow` типизированы через `CreateFormConfig` единой сборки. Это
 * не экономия строк: собственное объявление разошлось бы с фабрикой на первом же изменении
 * её конфигурации, и разъезд обнаружился бы не компилятором, а превью, которое «почему-то
 * не применяет поведение». У `renderBehavior` своей записи в конфигурации сборки нет: это слой
 * прежнего контракта, и его тип объявлен рядом со сборкой превью (`LegacyRenderBehavior`).
 *
 * @module plugins/reformer/render/compiling/exports
 */

import type { PreviewProblem } from '@reformer/builder-plugin-api';
import type { CreateFormConfig } from '@reformer/core';
import type { ComponentRegistry } from '@reformer/renderer-json';
import type {
  ArtifactFiles,
  BehaviorRules,
  LegacyRenderBehavior,
  Shape,
  WireSubmit,
} from '../runtime/build';
import { planModule, type ModulePlan, type ModuleRole } from './module';

export type { Shape };

type FormConfig = CreateFormConfig<Shape>;

/** Что нашлось в модуле формы. Любое поле может отсутствовать — превью деградирует частями. */
export interface FormContract {
  /**
   * Начальные значения — фабрикой (`createInitialValues`). Объект `initialFormModel` модулей
   * прежней раскладки заворачивается в фабрику здесь же: у сборки один вид входа.
   */
  readonly createInitialValues?: () => unknown;
  /** Правила валидации: готовая конфигурация либо правила со стратегией из `validationOptions`. */
  readonly validation?: FormConfig['validation'];
  /** Поток шагов визарда (`formFlow`). */
  readonly flow?: FormConfig['flow'];
  /** Готовое поведение формы (`formBehavior`). */
  readonly behavior?: FormConfig['behavior'];
  /** Правила поведения функцией над областью (`behaviorRules`) — к ним дописывается отправка. */
  readonly behaviorRules?: BehaviorRules;
  /** Отправка над областью поведения (`wireSubmit`). */
  readonly wireSubmit?: WireSubmit;
  /**
   * Правила узлов из `form.render.ts` модуля прежнего контракта — фабрика. Готовая функция
   * заворачивается в фабрику здесь же.
   */
  readonly renderBehavior?: LegacyRenderBehavior;
  /** Реестр компонентов формы. */
  readonly createRegistry?: () => ComponentRegistry;
  /** Из какого файла взят каждый артефакт — этими именами называются находки сборки. */
  readonly files: ArtifactFiles;
}

/** Что реально подключилось — для сводки и для тестов контракта. */
export type AppliedArtifact =
  | 'model'
  | 'validation'
  | 'flow'
  | 'behavior'
  | 'submit'
  | 'renderBehavior'
  | 'registry';

/** Экспорт вместе с файлом, из которого он взят. */
interface Picked {
  readonly value: unknown;
  readonly file: string;
}

/** Первый файл роли, в котором есть экспорт с таким именем. */
function pick(
  modules: ReadonlyMap<string, unknown>,
  files: readonly string[],
  name: string
): Picked | undefined {
  for (const file of files) {
    const exports = modules.get(file);
    if (exports === null || typeof exports !== 'object') continue;
    const value = (exports as Record<string, unknown>)[name];
    if (value !== undefined) return { value, file };
  }
  return undefined;
}

const isFn = (value: unknown): value is (...args: never[]) => unknown =>
  typeof value === 'function';

const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

/**
 * Ключи, по которым узнаётся уже готовая конфигурация валидации.
 *
 * Без этой проверки схема правил и конфигурация были бы неразличимы: обе — объекты. Ошибиться
 * здесь дорого: конфигурация, принятая за схему, дала бы форму, которая молча не валидируется.
 */
const VALIDATION_CONFIG_KEYS: readonly string[] = [
  'rules',
  'extras',
  'strategy',
  'debounce',
  'liveAfterSubmit',
  // Ключи прежней конфигурации: по ним она узнаётся, а переводит её {@link modernValidation}.
  'schema',
  'steps',
];

/** Похоже ли значение на `FormValidation`, а не на голую схему правил. */
export function isValidationConfig(value: unknown): boolean {
  return isObject(value) && VALIDATION_CONFIG_KEYS.some((key) => key in value);
}

/**
 * Собирает правила валидации из того, что экспортировали файлы модуля.
 *
 * `validationOptions` (стратегия запуска) — отдельный экспорт исторически, и уронить его нельзя:
 * стратегия решает, ругается ли форма по ходу ввода или только на отправке, то есть ровно то,
 * ради чего живое превью и открывают.
 */
export function composeValidation(
  formValidation: unknown,
  validationOptions: unknown
): FormConfig['validation'] {
  if (formValidation === undefined) return undefined;
  if (isValidationConfig(formValidation)) {
    // Готовую конфигурацию не дополняем: её автор уже сказал всё, что хотел, и дописать
    // стратегию поверх значило бы переспорить его молча.
    return modernValidation(formValidation as Record<string, unknown>);
  }
  if (isObject(validationOptions)) {
    return { rules: formValidation, ...validationOptions } as FormConfig['validation'];
  }
  // Пустой объект — тоже конфигурация: так модуль визарда без правил вне шагов говорит «полный
  // набор собирается из правил шагов потока».
  return formValidation as FormConfig['validation'];
}

/**
 * Конфигурация валидации в ключах единой сборки.
 *
 * Прежняя конфигурация держала полный набор правил в `schema`, а правила шагов — в `steps`.
 * Сборка читает `rules`, и конфигурация со `schema` для неё пуста: форма собралась бы и молча не
 * проверялась. Правила шагов теперь принадлежат потоку шагов — здесь им места нет.
 */
function modernValidation(config: Record<string, unknown>): FormConfig['validation'] {
  if (!('schema' in config) && !('steps' in config)) return config as FormConfig['validation'];
  const { schema, steps: _steps, ...rest } = config;
  return {
    ...(schema === undefined ? {} : { rules: schema }),
    ...rest,
  } as FormConfig['validation'];
}

/**
 * Похоже ли значение на поток шагов: объект со списком шагов.
 *
 * Проверка формы, а не вера в имя экспорта: поток уходит в сборку, и значение другого вида
 * уронило бы её целиком — вместо формы без проверки шагов человек увидел бы «форму собрать
 * не удалось».
 */
function isFlowConfig(value: unknown): value is NonNullable<FormConfig['flow']> {
  return isObject(value) && Array.isArray(value.steps);
}

/**
 * Разобрать исполненные модули в контракт формы.
 *
 * @param modules - Путь файла от корня модуля → его экспорты.
 * @param plan - Где искать каждую роль; по умолчанию план строится по самим исполненным файлам.
 */
export function extractContract(
  modules: ReadonlyMap<string, unknown>,
  plan: ModulePlan = planModule(modules.keys())
): FormContract {
  const files: { -readonly [Key in keyof ArtifactFiles]: string } = {};
  const contract: { -readonly [Key in keyof FormContract]: FormContract[Key] } = { files };
  const from = (role: ModuleRole, name: string): Picked | undefined =>
    pick(modules, plan.roles[role], name);

  const factory = from('initial', 'createInitialValues');
  const initial = from('initial', 'initialFormModel');
  if (factory !== undefined && isFn(factory.value)) {
    contract.createInitialValues = factory.value as () => unknown;
    files.initial = factory.file;
  } else if (initial !== undefined && isObject(initial.value)) {
    const values = initial.value;
    contract.createInitialValues = () => values;
    files.initial = initial.file;
  }

  const rules = from('validation', 'formValidation');
  const validation = composeValidation(
    rules?.value,
    from('validation', 'validationOptions')?.value
  );
  if (rules !== undefined && validation !== undefined) {
    contract.validation = validation;
    files.validation = rules.file;
  }

  const flow = from('flow', 'formFlow');
  if (flow !== undefined && isFlowConfig(flow.value)) {
    contract.flow = flow.value;
    files.flow = flow.file;
  }

  const behavior = from('behavior', 'formBehavior');
  if (behavior !== undefined) {
    contract.behavior = behavior.value as FormConfig['behavior'];
    files.behavior = behavior.file;
  }
  const behaviorRules = from('behavior', 'behaviorRules');
  if (behaviorRules !== undefined && isFn(behaviorRules.value)) {
    contract.behaviorRules = behaviorRules.value as BehaviorRules;
    files.behavior = behaviorRules.file;
  }

  const wireSubmit = from('submit', 'wireSubmit');
  if (wireSubmit !== undefined && isFn(wireSubmit.value)) {
    contract.wireSubmit = wireSubmit.value as WireSubmit;
    files.submit = wireSubmit.file;
  }

  const ready = from('renderBehavior', 'formRenderBehavior');
  // `createJsonRenderBehavior` — имя, которое печатал кодоген билдера прежнего контракта: уже
  // экспортированные каталоги импортируют именно его.
  const legacy =
    from('renderBehavior', 'createRenderBehavior') ??
    from('renderBehavior', 'createJsonRenderBehavior');
  if (legacy !== undefined && isFn(legacy.value)) {
    contract.renderBehavior = legacy.value as LegacyRenderBehavior;
    files.renderBehavior = legacy.file;
  } else if (ready !== undefined && isFn(ready.value)) {
    // Готовая функция — это фабрика, которой нечего спрашивать. Заворачиваем здесь, чтобы
    // у сборки был один вид входа, а не два.
    const behaviorFn = ready.value as ReturnType<LegacyRenderBehavior>;
    contract.renderBehavior = () => behaviorFn;
    files.renderBehavior = ready.file;
  }

  const createRegistry = from('registry', 'createRegistry');
  if (createRegistry !== undefined && isFn(createRegistry.value)) {
    contract.createRegistry = createRegistry.value as () => ComponentRegistry;
    files.registry = createRegistry.file;
  }

  return contract;
}

/**
 * Подключается ли отправка модуля: для этого нужны обе половины — правила функцией и
 * `wireSubmit`. Иначе берётся готовое `formBehavior`, а отправка остаётся неподключённой.
 */
export function wiresSubmit(contract: FormContract): boolean {
  return contract.behaviorRules !== undefined && contract.wireSubmit !== undefined;
}

/** Список подключённых артефактов в порядке показа. */
export function appliedArtifacts(contract: FormContract): readonly AppliedArtifact[] {
  const out: AppliedArtifact[] = [];
  if (contract.createInitialValues !== undefined) out.push('model');
  if (contract.validation !== undefined) out.push('validation');
  if (contract.flow !== undefined) out.push('flow');
  if (contract.behavior !== undefined || contract.behaviorRules !== undefined) out.push('behavior');
  if (wiresSubmit(contract)) out.push('submit');
  if (contract.renderBehavior !== undefined) out.push('renderBehavior');
  if (contract.createRegistry !== undefined) out.push('registry');
  return out;
}

/** То, что контракт отдаёт фабриками, — исполненное один раз. */
export interface ContractValues {
  /** Начальные значения модуля; `undefined` — их нет или фабрика отказала. */
  readonly initial?: Shape;
  /** Реестр компонентов формы; `undefined` — его нет или фабрика отказала. */
  readonly registry?: ComponentRegistry;
  readonly problems: readonly PreviewProblem[];
}

const describe = (error: unknown): string =>
  error instanceof Error ? error.message : String(error);

/**
 * Исполняет фабрики контракта: начальные значения и реестр.
 *
 * Отдельным шагом, а не при разборе: фабрика — код автора, и она вправе бросить. Отказ одной не
 * отменяет другой и не роняет форму — он становится находкой с именем файла, а форма собирается
 * без этого артефакта (значения — из мока, компоненты — из каталога кита).
 */
export function runFactories(contract: FormContract): ContractValues {
  const problems: PreviewProblem[] = [];
  const attempt = <T>(file: string | undefined, factory: (() => T) | undefined): T | undefined => {
    if (factory === undefined) return undefined;
    try {
      return factory();
    } catch (error) {
      problems.push({ file: file ?? '', phase: 'evaluate', message: describe(error) });
      return undefined;
    }
  };

  const initial = attempt(contract.files.initial, contract.createInitialValues);
  const registry = attempt(contract.files.registry, contract.createRegistry);
  return {
    // Не объект — значит фабрика вернула не значения формы: поверх мока такое не кладётся.
    ...(isObject(initial) ? { initial } : {}),
    ...(registry === undefined ? {} : { registry }),
    problems,
  };
}
