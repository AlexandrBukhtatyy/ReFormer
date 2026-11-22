/**
 * Контракт модуля формы: какие экспорты превью ищет в исполненных файлах ролей.
 *
 * ## Раскладка «папки по ролям» — имена общие
 *
 * | файл                     | экспорт                        | что это                              |
 * | ------------------------ | ------------------------------ | ------------------------------------ |
 * | `model/initial-value.ts` | `createInitialValues`          | начальные значения — фабрикой        |
 * | `validation/form.ts`     | `formValidation`               | `FormValidation` сборки              |
 * | `validation/messages.ts` | `formMessages`, `formLocale`   | словарь замечаний и язык формы       |
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
 * ## Словарь замечаний — не артефакт сборки
 *
 * `formMessages` (`defineIssueMessages`) в сборку формы не входит: в приложении его подключает
 * страница модуля — `<ValidationMessagesProvider messages={formMessages}>`. Страницу превью не
 * исполняет, поэтому словарь разбирается здесь наравне с остальными ролями, а подключает его
 * сама поверхность — тем же провайдером вокруг формы. Модуль без словаря показывает замечания
 * текстами локали, как и раньше. Язык формы (`formLocale`) из того же файла — так же: страница
 * задаёт его форме `I18nProvider`, и поверхность ставит тот же провайдер.
 *
 * ## Прежняя плоская раскладка
 *
 * Имён у одного и того же по смыслу артефакта там исторически несколько: начальные значения лежали
 * объектом `initialFormModel`. Разбор этих вариантов собран здесь, чтобы сборка превью не знала о
 * них ничего. Слой правил узлов прежнего контракта (`form.render.ts`) превью не исполняет: его
 * правила переносятся в поведение формы.
 *
 * ## Типы берутся ИЗ конфигурации фабрики, а не объявляются заново
 *
 * `validation`, `behavior` и `flow` типизированы через `CreateFormConfig` единой сборки. Это
 * не экономия строк: собственное объявление разошлось бы с фабрикой на первом же изменении
 * её конфигурации, и разъезд обнаружился бы не компилятором, а превью, которое «почему-то
 * не применяет поведение».
 *
 * @module plugins/reformer/render/compiling/exports
 */

import type { PreviewProblem } from '@reformer/builder-plugin-api';
import type { ValidationMessagesProviderProps } from '@reformer/cdk';
import type { CreateFormConfig } from '@reformer/core';
import type { FormLocale } from '@reformer/core/i18n';
import type { ComponentRegistry } from '@reformer/renderer-json';
import type { ArtifactFiles, BehaviorRules, Shape, WireSubmit } from '../runtime/build';
import { planModule, type ModulePlan, type ModuleRole } from './module';

export type { Shape };

type FormConfig = CreateFormConfig<Shape>;

/**
 * Словарь замечаний формы: код замечания → текст. Тип взят у провайдера, который словарь
 * принимает, — по той же причине, по какой остальные типы берутся из конфигурации сборки.
 */
export type FormMessages = NonNullable<ValidationMessagesProviderProps['messages']>;

/** Что нашлось в модуле формы. Любое поле может отсутствовать — превью деградирует частями. */
export interface FormContract {
  /**
   * Начальные значения — фабрикой (`createInitialValues`). Объект `initialFormModel` модулей
   * прежней раскладки заворачивается в фабрику здесь же: у сборки один вид входа.
   */
  readonly createInitialValues?: () => unknown;
  /** Правила валидации: готовая конфигурация либо правила со стратегией из `validationOptions`. */
  readonly validation?: FormConfig['validation'];
  /** Словарь текстов замечаний (`formMessages`): его подключает поверхность, а не сборка. */
  readonly messages?: FormMessages;
  /**
   * Язык формы (`formLocale` того же файла): страница задаёт его форме своим `I18nProvider`, и
   * поверхность — тоже. По нему склоняются тексты словаря, пишутся единицы размера и подписи кита.
   */
  readonly locale?: FormLocale;
  /** Поток шагов визарда (`formFlow`). */
  readonly flow?: FormConfig['flow'];
  /** Готовое поведение формы (`formBehavior`). */
  readonly behavior?: FormConfig['behavior'];
  /** Правила поведения функцией над областью (`behaviorRules`) — к ним дописывается отправка. */
  readonly behaviorRules?: BehaviorRules;
  /** Отправка над областью поведения (`wireSubmit`). */
  readonly wireSubmit?: WireSubmit;
  /** Реестр компонентов формы. */
  readonly createRegistry?: () => ComponentRegistry;
  /** Из какого файла взят каждый артефакт — этими именами называются находки сборки. */
  readonly files: ArtifactFiles;
}

/** Что реально подключилось — для сводки и для тестов контракта. */
export type AppliedArtifact =
  | 'model'
  | 'validation'
  | 'messages'
  | 'flow'
  | 'behavior'
  | 'submit'
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
 * Похоже ли значение на словарь замечаний: объект «код → текст».
 *
 * Проверка формы, а не вера в имя экспорта: словарь уходит провайдеру, а тот читает его на каждом
 * замечании. Значение другого вида (`null`, функция, массив) уронило бы форму при первом же
 * показанном замечании — то есть ровно тогда, когда человек нажал «Отправить».
 */
function isMessages(value: unknown): value is FormMessages {
  return isObject(value);
}

/**
 * Похоже ли значение на локаль: код языка и словарь. `undefined` в файле — законный отказ от
 * своего языка (форма говорит языком приложения), прочее неподходящее молча не применяется — по
 * той же причине, что у словаря: провайдер локали читает её на каждой подписи.
 */
function isLocale(value: unknown): value is FormLocale {
  return isObject(value) && typeof value.code === 'string' && isObject(value.messages);
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

  const messages = from('messages', 'formMessages');
  if (messages !== undefined && isMessages(messages.value)) {
    contract.messages = messages.value;
    files.messages = messages.file;
  }
  const locale = from('messages', 'formLocale');
  if (locale !== undefined && isLocale(locale.value)) {
    contract.locale = locale.value;
    files.messages = locale.file;
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
  if (contract.messages !== undefined || contract.locale !== undefined) out.push('messages');
  if (contract.flow !== undefined) out.push('flow');
  if (contract.behavior !== undefined || contract.behaviorRules !== undefined) out.push('behavior');
  if (wiresSubmit(contract)) out.push('submit');
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
