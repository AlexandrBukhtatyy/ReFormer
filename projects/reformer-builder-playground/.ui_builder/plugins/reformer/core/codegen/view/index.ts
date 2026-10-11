/**
 * Вид генерации — данные, которые видит шаблон, и ничего сверх.
 *
 * ## Несущее правило
 *
 * Шаблон умеет ЦИКЛ, ВЕТВЛЕНИЕ по флагу и ПОДСТАНОВКУ строки. Шаблон не принимает РЕШЕНИЙ:
 * какой символ взять у кита, какой импорт дописать, какую заглушку поставить и с какой
 * причиной, как разобрать вид правила, какие параметры области деструктурировать — всё это
 * решается здесь, в TypeScript, и приезжает в шаблон данными. Правило и делает разрез
 * объективным: если для строки шаблона нужно «сообразить», строка написана не там.
 *
 * ## Почему вид ОДИН, а не по одному на цель
 *
 * Довод уже записан в шапке `../context` про сам `EmitContext` — «один объект, а не пять
 * параметров, потому что состав того, что нужно эмиттеру, растёт; добавление поля не меняет
 * ни одной сигнатуры, а значит и ни одного вклада в точку расширения». К виду он применим
 * сильнее: вид — это ПУБЛИЧНАЯ ПОВЕРХНОСТЬ для шаблонов пользователя. Восемнадцать частных форм
 * означали бы восемнадцать страниц документации и человека, который не может написать НОВУЮ
 * цель, потому что для неё формы не завели.
 *
 * Частное всё-таки бывает — для чужой цели, которой нужно что-то своё. Оно приезжает
 * `CodegenTarget.view` и лежит отдельным полем `local`, а не подмешивается в корень: иначе
 * чужая цель молча перекрыла бы платформенное поле.
 *
 * ## Пути и импорты — данными
 *
 * Модуль разложен по папкам ролей, и почти каждый файл импортирует соседей из других папок.
 * Пути файлов (`it.layout.files`) и спецификаторы импорта (`it.rel('create', 'types')`) шаблон
 * получает готовыми: литерал `'../types/loan'` в шаблоне разошёлся бы с раскладкой на первом же
 * переименовании, а у формы с документом в корне модуля он неверен с самого начала.
 *
 * @module plugins/reformer/core/codegen/view/index
 */

import { hasValidationRules } from '../../form-model/rules';
import type { EmitContext, EmittedFileRef } from '../context';
import { importOf, schemaDirOf, type ModuleFiles } from '../layout';
import type { StepInfo } from '../steps';
import {
  crossStepRulesFromRules,
  formRulesFromRules,
  stepRulesFromRules,
  type ValidationCode,
} from '../emit/rules-bridge';
import type { Names } from '../naming';
import type { SelectorInfo } from '../selectors';
import type { FormMock } from '../types';
import { behaviorView, mentions, type BehaviorView } from './behavior';
import { registryView, type RegistryView } from './registry';
import { typesView, type TypesView } from './types';

/**
 * Отступ блока строк.
 *
 * Пустая строка остаётся пустой: дописанные к ней пробелы — висячий whitespace, который
 * линтер потребителя пометит, а diff покажет невидимым изменением.
 */
export type Indent = (lines: readonly string[], spaces: number) => string;

/**
 * JSON-литерал, готовый лечь на глубину `spaces`.
 *
 * Первая строка БЕЗ отступа (её ставит сам шаблон в месте вставки), остальные — с ним.
 */
export type Json = (value: unknown, spaces?: number) => string;

/**
 * Склеить непустые блоки пустой строкой между ними.
 *
 * Примитив РАСКЛАДКИ того же разряда, что `indent`: решение «какие блоки бывают» принято
 * выше, здесь остаётся только не оставить дыру там, где блок оказался пуст.
 */
export type Blocks = (groups: readonly string[]) => string;

/**
 * Спецификатор импорта одного файла модуля из другого — по ролям: `it.rel('create', 'types')`
 * → `'../types/loan'`.
 *
 * Роли, а не пути: шаблон называет, ЧТО он импортирует, а где оно лежит, знает раскладка.
 */
export type Rel = (from: keyof ModuleFiles, to: keyof ModuleFiles) => string;

/** Что видит шаблон. */
export interface CodegenView {
  /** Производные имена формы: каталог, тип, компонент страницы, фабрики. */
  readonly names: Names;
  /**
   * Начальные значения и источники данных — тот же мок, что видит превью.
   *
   * Один набор на печать и на предпросмотр намеренно: разойдись они, модуль формы и её
   * предпросмотр показывали бы РАЗНЫЕ списки, и человек счёл бы это дефектом превью.
   */
  readonly mock: FormMock;
  /**
   * Источники данных, РАЗЛОЖЕННЫЕ по способу использования.
   *
   * Классификация, сортировка и умолчания сделаны здесь: список опций у не-массива
   * читается как пустой список, отсутствующий скаляр — как пустая строка. Шаблон такое
   * решить не может — он не отличит «источника нет» от «источник пуст».
   */
  readonly dataSources: DataSourcesView;
  /**
   * Кит в объёме, нужном ПЕЧАТИ: откуда импортировать и как он называется человеку.
   *
   * Резолв компонентов сюда не входит и не войдёт: он приезжает разложенным по целям,
   * которым нужен, — иначе шаблон начал бы решать, чего у кита нет.
   */
  readonly kit: KitInfoView;
  /** Селекторы схемы: секции, массивы и цель отправки. Уже проставлены `assignSelectors`. */
  readonly selectors: SelectorInfo;
  /** Тип формы, уже отрисованный из дерева типов. */
  readonly types: TypesView;
  /** Модели файлов, чьё содержимое выводится из правил формы: поведение и валидация. */
  readonly rules: RulesView;
  /** Пути обязательных полей, выведенные из схемы. Без повторов и в порядке обхода. */
  readonly required: readonly string[];
  /** Привязки реестра: символы кита, визард, заглушки с причинами, источники. */
  readonly registry: RegistryView;
  /** Отправка формы: какой узел схемы её начинает и каким событием. */
  readonly submit: SubmitView;
  /**
   * Раскладка модуля: вид формы, пути файлов и шаги визарда.
   *
   * Пути приезжают сюда из `../layout`, а не пишутся в шаблонах литералами: иначе
   * переименование файла требовало бы правки каждого шаблона, который его импортирует.
   */
  readonly layout: LayoutView;
  /**
   * Шаг, для которого печатается файл, — у целей, размноженных по шагам (`each: 'step'`).
   * У файлов формы — `null`.
   */
  readonly step: StepView | null;
  /**
   * Состав модуля этого прогона.
   *
   * Пуст, пока цели отвечают на вопрос «применяюсь ли я», и заполняется до первой печати —
   * та же семантика, что у `EmitContext.files`, и по той же причине.
   */
  readonly files: readonly EmittedFileRef[];
  /** Частные данные цели, если она их объявила. */
  readonly local?: object;
  readonly indent: Indent;
  readonly json: Json;
  readonly blocks: Blocks;
  readonly rel: Rel;
}

const indent: Indent = (lines, spaces) => {
  const pad = ' '.repeat(spaces);
  return lines.map((line) => (line === '' ? '' : `${pad}${line}`)).join('\n');
};

const blocks: Blocks = (groups) => groups.filter((group) => group !== '').join('\n\n');

const json: Json = (value, spaces = 0) => {
  const text = JSON.stringify(value, null, 2);
  if (spaces === 0) return text;
  const pad = ' '.repeat(spaces);
  return text
    .split('\n')
    .map((line, index) => (index === 0 || line === '' ? line : `${pad}${line}`))
    .join('\n');
};

/** Значение, которое считается при первом обращении и запоминается. */
function once<T>(compute: () => T): () => T {
  let state: { readonly value: T } | undefined;
  return () => {
    state ??= { value: compute() };
    return state.value;
  };
}

// ── Валидация ───────────────────────────────────────────────────────────────

/** Одно объявление правил (`defineValidation<T>(…)`) — импорты и тело, готовые к раскладке. */
export interface RulesBlockView {
  /** Строки импорта операторов и валидаторов — как печатать. */
  readonly imports: readonly string[];
  /** Строки тела — без отступа. Пусто — правил нет, шаблон оставляет в теле `TODO`. */
  readonly body: readonly string[];
  /** Читает ли тело модель: от этого зависит, деструктурируется ли `model` в колбэке. */
  readonly usesModel: boolean;
}

/** Импорт объявления правил, когда операторов в теле нет. */
const DEFINE_ONLY = "import { defineValidation } from '@reformer/core/validation';";

/** Блок правил из тела, выведенного из правил формы. */
function blockOf(code: ValidationCode): RulesBlockView {
  return {
    imports: code.imports,
    body: code.body,
    usesModel: mentions(code.body.join('\n'), 'model'),
  };
}

/**
 * Блок-заготовка: `required` из схемы либо пустое тело.
 *
 * Обязательность здесь — флаг `required` узла схемы. Печатается только там, где правил формы
 * нет вовсе: с правилами обязательность задают ПРАВИЛА, и печатать оба значило бы проверять
 * поле дважды и расходиться при правке одного из них.
 */
function scaffoldBlock(required: readonly string[]): RulesBlockView {
  if (required.length === 0) return { imports: [DEFINE_ONLY], body: [], usesModel: false };
  return {
    imports: [
      "import { defineValidation, validate } from '@reformer/core/validation';",
      "import { required } from '@reformer/core/validators';",
    ],
    body: required.map((path) => `validate(model.$.${path}, [required()]);`),
    usesModel: true,
  };
}

/** Валидация формы (`validation/form.ts`) глазами шаблона. */
export interface ValidationView {
  /**
   * Объявление правил этого файла либо `null` — объявлять нечего (у визарда нет правил вне шагов).
   *
   * У простой формы — все правила (`formRules`), у визарда — только правила вне шагов
   * (`crossStepRules`): правила шагов лежат в `validation/<шаг>.ts` и уходят в сборку потоком.
   */
  readonly block: RulesBlockView | null;
  /** Имя объявления: `formRules` либо `crossStepRules`. */
  readonly rulesName: 'formRules' | 'crossStepRules';
  /** Поле `FormValidation`, которым правила уходят в сборку: `rules` либо `extras`. */
  readonly field: 'rules' | 'extras';
}

function validationView(ctx: EmitContext): ValidationView {
  const fromRules = hasValidationRules(ctx.rules);
  if (ctx.layout.kind !== 'wizard') {
    const code = fromRules ? formRulesFromRules(ctx.rules, ctx.names) : null;
    return {
      block:
        code === null ? scaffoldBlock([...new Set(ctx.collected.requiredPaths)]) : blockOf(code),
      rulesName: 'formRules',
      field: 'rules',
    };
  }
  if (fromRules) {
    const code = crossStepRulesFromRules(ctx.rules, ctx.names, ctx.layout);
    return {
      block: code === null ? null : blockOf(code),
      rulesName: 'crossStepRules',
      field: 'extras',
    };
  }
  // Обязательные поля вне шагов: «Далее» их не проверяет — только полная проверка при отправке.
  const inSteps = new Set(ctx.layout.steps.flatMap((step) => step.required));
  const rest = [...new Set(ctx.collected.requiredPaths)].filter((path) => !inSteps.has(path));
  return {
    block: rest.length === 0 ? null : scaffoldBlock(rest),
    rulesName: 'crossStepRules',
    field: 'extras',
  };
}

/**
 * Модели файлов, выведенные из правил формы.
 *
 * Поля — ГЕТТЕРЫ, и это не стиль. Тела правил печатают билдеры `@reformer/mcp`, и бросок
 * любого из них при жадном вычислении уронил бы сборку ВИДА, то есть все файлы модуля разом.
 * Лениво же отказ остаётся отказом одной цели — ровно как было у эмиттеров. Поэтому же они лежат
 * вложенным объектом: вид копируется (`withViewFiles`, `withStepView`), а копирование верхнего
 * уровня геттер исполнило бы.
 */
export interface RulesView {
  /** Модель `behavior/index.ts`: связи над моделью и правила узлов. */
  readonly behavior: BehaviorView;
  /** Модель `validation/form.ts`. */
  readonly validation: ValidationView;
}

function rulesView(ctx: EmitContext): RulesView {
  const behavior = once(() => behaviorView(ctx));
  const validation = once(() => validationView(ctx));
  return {
    get behavior() {
      return behavior();
    },
    get validation() {
      return validation();
    },
  };
}

// ── Кит и источники данных ──────────────────────────────────────────────────

/** Кит глазами печати. */
export interface KitInfoView {
  /** Спецификатор импорта: `@reformer/ui-kit`, `@hexa/ui`, … */
  readonly importSpecifier: string;
  /** Подпись для человека — она уезжает в README и в причины заглушек. */
  readonly label: string;
}

/** Источник-список: имя и опции, уже приведённые к массиву. */
export interface OptionSourceView {
  readonly name: string;
  readonly value: readonly unknown[];
}

/** Источник-скаляр: имя и уже свёрнутый литерал (умолчание для отсутствующего — пустая строка). */
export interface ScalarSourceView {
  readonly name: string;
  readonly literal: string;
}

/** Источники данных по классам; внутри каждого — по имени, чтобы вывод не зависел от обхода. */
export interface DataSourcesView {
  readonly options: readonly OptionSourceView[];
  readonly scalars: readonly ScalarSourceView[];
  /** Подписи элементов массива: им нужна ФУНКЦИЯ, а не значение, поэтому только имена. */
  readonly labels: readonly string[];
  /**
   * Источников нет ни одного. Файл констант всё равно печатается — он авторский и ждёт значений, —
   * но обязан остаться модулем: файл без импортов и экспортов сборка с `isolatedModules` отвергает.
   */
  readonly isEmpty: boolean;
}

function dataSourcesView(ctx: EmitContext): DataSourcesView {
  const { ds } = ctx.collected;
  const sources = ctx.mock.dataSources;
  return {
    isEmpty: ds.optionLike.size + ds.scalarLike.size + ds.functionLike.size === 0,
    options: [...ds.optionLike].sort().map((name) => {
      const value = sources[name];
      return { name, value: Array.isArray(value) ? (value as unknown[]) : [] };
    }),
    scalars: [...ds.scalarLike]
      .sort()
      .map((name) => ({ name, literal: JSON.stringify(sources[name] ?? '') })),
    labels: [...ds.functionLike].sort(),
  };
}

// ── Раскладка ───────────────────────────────────────────────────────────────

/** Шаг визарда глазами файлов формы: потока, сборки и README. */
export interface StepEntryView {
  readonly index: number;
  /** Папка шага — где лежит его схема у разбитого визарда. */
  readonly dir: string;
  /** Имя шага в путях кода (`validation/<slug>.ts`). */
  readonly slug: string;
  readonly title: string;
  /** `id` шага в потоке — `selector` узла шага в схеме. */
  readonly id: string;
  /** Короткое имя шага для локальных имён: `step1`. */
  readonly alias: string;
  /** Файл правил шага от корня модуля. */
  readonly rulesFile: string;
  /** Псевдоним правил шага в потоке: `kontaktyRules`. */
  readonly rulesAlias: string;
  /** Импорт файла правил шага из файла потока. */
  readonly rulesImport: string;
  /** Спецификатор схемы шага в корневом документе (`./steps/kontakty/form.schema.json`) — у вынесенного шага. */
  readonly schemaRef: string | null;
  /** Файл схемы шага от корня модуля — у вынесенного шага. */
  readonly schemaFile: string | null;
  /** Импорт схемы шага из сборки (`application/create.ts`) — у вынесенного шага. */
  readonly schemaImport: string | null;
  /** Локальное имя импортированной схемы шага: `step1Schema`. */
  readonly schemaAlias: string;
}

export interface LayoutView {
  readonly kind: 'simple' | 'wizard';
  readonly isWizard: boolean;
  /**
   * Визард разбит по шагам: корневой документ держит ссылки, и сборка собирает схему
   * `composeJsonFormSchema` из файлов шагов.
   */
  readonly isSplit: boolean;
  /** Пути файлов модуля от его корня — для импортов (`it.rel`), README и комментариев. */
  readonly files: ModuleFiles;
  /** Каталог корневого документа внутри модуля с завершающим `/` либо пусто. */
  readonly schemaDir: string;
  readonly steps: readonly StepEntryView[];
  /** Шаги, вынесенные в свои файлы, — их схемы импортирует сборка. Пусто у неразбитой формы. */
  readonly splitSteps: readonly StepEntryView[];
}

function stepEntry(ctx: EmitContext, step: StepInfo): StepEntryView {
  const source = step.files.schemaSource;
  return {
    index: step.index,
    dir: step.dir,
    slug: step.slug,
    title: step.title,
    // Селектор шагу проставляет `assignSelectors`; имя шага — запасной ответ для схемы, по
    // которой селекторы не проставляли.
    id: step.selector ?? step.slug,
    alias: step.alias,
    rulesFile: step.files.validation,
    rulesAlias: step.rulesAlias,
    rulesImport: importOf(ctx.paths.flow, step.files.validation),
    schemaRef: step.schemaRef,
    schemaFile: source,
    schemaImport: source === null ? null : importOf(ctx.paths.create, source),
    schemaAlias: `${step.alias}Schema`,
  };
}

function layoutView(ctx: EmitContext): LayoutView {
  const steps = ctx.layout.steps.map((step) => stepEntry(ctx, step));
  return {
    kind: ctx.layout.kind,
    isWizard: ctx.layout.kind === 'wizard',
    isSplit: ctx.composition !== null,
    files: ctx.paths,
    schemaDir: schemaDirOf(ctx.paths.schema),
    steps,
    splitSteps: steps.filter((step) => step.schemaImport !== null),
  };
}

// ── Отправка ────────────────────────────────────────────────────────────────

/** Отправка формы глазами шаблона `application/submit.ts`. */
export interface SubmitView {
  /** Селектор узла, который начинает отправку: кнопка либо визард. */
  readonly selector: string;
  /** Событие узла: кнопка шлёт `onClick`, визард — `onSubmit`. */
  readonly event: SelectorInfo['submitEvent'];
  /**
   * Отправляет визард: обработчик он зовёт сам, после успешной полной проверки, и отдаёт ему
   * значения формы. У кнопки проверку перед запросом делает сама отправка.
   */
  readonly byWizard: boolean;
}

function submitView(ctx: EmitContext): SubmitView {
  return {
    selector: ctx.selectors.submitSelector,
    event: ctx.selectors.submitEvent,
    byWizard: ctx.selectors.submitEvent === 'onSubmit',
  };
}

/** Файл шага глазами шаблона. */
export interface StepView {
  readonly index: number;
  /** Папка шага — где лежит его схема у разбитого визарда. */
  readonly dir: string;
  /** Имя шага в путях кода. */
  readonly slug: string;
  readonly title: string;
  readonly selector: string | null;
  readonly alias: string;
  /** Пути файлов шага от корня модуля. */
  readonly files: StepInfo['files'];
  /** Спецификаторы импорта из файла правил шага. */
  readonly imports: { readonly types: string };
  /**
   * Правила шага (`stepRules`): из правил формы либо заготовка с `required` из схемы.
   * Геттер: тело печатают билдеры `@reformer/mcp`, и отказ одного шага не должен ронять вид.
   */
  readonly validation: RulesBlockView;
}

/** Вид файла шага. */
export function stepView(ctx: EmitContext, step: StepInfo): StepView {
  const validation = once((): RulesBlockView => {
    if (!hasValidationRules(ctx.rules)) return scaffoldBlock(step.required);
    const code = stepRulesFromRules(ctx.rules, ctx.names, ctx.layout, step);
    return code === null ? scaffoldBlock([]) : blockOf(code);
  });
  return {
    index: step.index,
    dir: step.dir,
    slug: step.slug,
    title: step.title,
    selector: step.selector,
    alias: step.alias,
    files: step.files,
    imports: { types: importOf(step.files.validation, ctx.paths.types) },
    get validation() {
      return validation();
    },
  };
}

/** Собрать вид из контекста эмиссии. Чистая функция, как и `prepare`. */
export function buildView(ctx: EmitContext): CodegenView {
  return {
    names: ctx.names,
    mock: ctx.mock,
    dataSources: dataSourcesView(ctx),
    kit: { importSpecifier: ctx.kit.kit.codegen.importSpecifier, label: ctx.kit.kit.label },
    selectors: ctx.selectors,
    types: typesView(ctx),
    rules: rulesView(ctx),
    required: [...new Set(ctx.collected.requiredPaths)],
    registry: registryView(ctx),
    submit: submitView(ctx),
    layout: layoutView(ctx),
    step: null,
    files: ctx.files,
    indent,
    json,
    blocks,
    rel: (from, to) => importOf(ctx.paths[from], ctx.paths[to]),
  };
}

/** Тот же вид с известным составом модуля — зеркало `withFiles` над контекстом. */
export function withViewFiles(view: CodegenView, files: readonly EmittedFileRef[]): CodegenView {
  return { ...view, files };
}

/** Вид с частными данными цели. Отдельная функция, чтобы `local` нельзя было выставить мимо. */
export function withLocal(view: CodegenView, local: object): CodegenView {
  return { ...view, local };
}

/** Вид для файла шага. Отдельная функция, чтобы `step` нельзя было выставить мимо. */
export function withStepView(view: CodegenView, step: StepView): CodegenView {
  return { ...view, step };
}
