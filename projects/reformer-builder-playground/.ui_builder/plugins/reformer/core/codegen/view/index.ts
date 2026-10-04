/**
 * Вид генерации — данные, которые видит шаблон, и ничего сверх.
 *
 * ## Несущее правило
 *
 * Шаблон умеет ЦИКЛ, ВЕТВЛЕНИЕ по флагу и ПОДСТАНОВКУ строки. Шаблон не принимает РЕШЕНИЙ:
 * какой символ взять у кита, какой импорт дописать, какую заглушку поставить и с какой
 * причиной, как разобрать вид правила — всё это решается здесь, в TypeScript, и приезжает
 * в шаблон данными. Правило и делает разрез объективным: если для строки шаблона нужно
 * «сообразить», строка написана не там.
 *
 * ## Почему вид ОДИН, а не по одному на цель
 *
 * Довод уже записан в шапке `../context` про сам `EmitContext` — «один объект, а не пять
 * параметров, потому что состав того, что нужно эмиттеру, растёт; добавление поля не меняет
 * ни одной сигнатуры, а значит и ни одного вклада в точку расширения». К виду он применим
 * сильнее: вид — это ПУБЛИЧНАЯ ПОВЕРХНОСТЬ для шаблонов пользователя. Двенадцать частных форм
 * означали бы двенадцать страниц документации и человека, который не может написать НОВУЮ
 * цель, потому что для неё формы не завели.
 *
 * Частное всё-таки бывает — для чужой цели, которой нужно что-то своё. Оно приезжает
 * `CodegenTarget.view` и лежит отдельным полем `local`, а не подмешивается в корень: иначе
 * чужая цель молча перекрыла бы платформенное поле.
 *
 * @module plugins/reformer/core/codegen/view/index
 */

import { hasBehaviorRules, hasValidationRules } from '../../form-model/rules';
import type { EmitContext, EmittedFileRef } from '../context';
import { normalizeStepRef } from '@reformer/renderer-json';
import { MODULE_FILES, STEPS_INDEX, importOf } from '../layout';
import type { StepInfo } from '../steps';
import {
  formBehaviorFromRules,
  stepValidationFromRules,
  validationFromRules,
  wizardValidationFromRules,
} from '../emit/rules-bridge';
import type { Names } from '../naming';
import type { SelectorInfo } from '../selectors';
import type { FormMock } from '../types';
import { registryView, type RegistryView } from './registry';
import {
  renderBehaviorView,
  stepRenderView,
  type RenderBehaviorView,
  type StepRenderView,
} from './render-rules';
import { typesView, type TypesView } from './types';
import { wizardShimOf, type WizardShim } from './wizard';

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
 * Ровно этого не хватало `emit/model.ts`, где `JSON.stringify(…, 2)` уезжал с нулевой
 * колонки внутрь тела функции.
 */
export type Json = (value: unknown, spaces?: number) => string;

/**
 * Склеить непустые блоки пустой строкой между ними.
 *
 * Примитив РАСКЛАДКИ того же разряда, что `indent`: решение «какие блоки бывают» принято
 * выше, здесь остаётся только не оставить дыру там, где блок оказался пуст.
 */
export type Blocks = (groups: readonly string[]) => string;

/** Что видит шаблон. */
export interface CodegenView {
  /** Производные имена формы: каталог, тип, компонент страницы, фабрика модели. */
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
  /** Готовый код из правил формы либо `null` — тогда печатается заготовка. */
  readonly rules: RulesView;
  /** Пути обязательных полей, выведенные из схемы. Без повторов и в порядке обхода. */
  readonly required: readonly string[];
  /**
   * Шим визарда либо `null`, если форме он не нужен или кит не даёт адаптера.
   *
   * Тот же ответ служит предикатом `applies` у цели, поэтому внутри шаблона шима
   * обращение к его полям безопасно: без шима цель не применяется.
   */
  readonly wizard: WizardShim | null;
  /**
   * Пошаговая проверка визарда либо `null`: визарда нет, шим напечатать нечем или валидацию
   * печатают правила формы (у тела из правил своей раскладки по шагам нет).
   */
  readonly stepValidation: StepValidationView | null;
  /** Привязки реестра: символы кита, заглушки с причинами, источники. */
  readonly registry: RegistryView;
  /**
   * Раскладка модуля: вид формы, спецификаторы импорта файлов корня и шаги визарда.
   *
   * Имена файлов приезжают сюда из `../layout`, а не пишутся в шаблонах литералами: иначе
   * переименование файла требовало бы правки каждого шаблона, который его импортирует.
   */
  readonly layout: LayoutView;
  /**
   * Шаг, для которого печатается файл, — у целей, размноженных по шагам (`each: 'step'`).
   * У файлов корня — `null`.
   */
  readonly step: StepView | null;
  /** Обвязка render-слоя: импорты, цель отправки, правила и подсказки секций. */
  readonly renderBehavior: RenderBehaviorView;
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

/**
 * Код, выведенный из правил формы.
 *
 * Поля — ГЕТТЕРЫ, и это не стиль. Печатают их билдеры `@reformer/mcp`, и бросок любого
 * из них при жадном вычислении уронил бы сборку ВИДА, то есть все двенадцать файлов
 * разом. Лениво же отказ остаётся отказом одной цели — ровно как было у эмиттеров.
 */
export interface RulesView {
  /** Тело `form.validation.ts` целиком либо `null`, если правил валидации нет. */
  readonly validationCode: string | null;
  /** Тело `form.behavior.ts` целиком либо `null`, если реактивных связей нет. */
  readonly behaviorCode: string | null;
}

function rulesView(ctx: EmitContext): RulesView {
  return {
    get validationCode() {
      if (!hasValidationRules(ctx.rules)) return null;
      // У визарда правила разложены по шагам: корень печатает код только ради правил вне шагов,
      // иначе — шаблон-агрегатор.
      return ctx.layout.kind === 'wizard'
        ? wizardValidationFromRules(ctx.rules, ctx.names, ctx.layout)
        : validationFromRules(ctx.rules, ctx.names);
    },
    get behaviorCode() {
      return hasBehaviorRules(ctx.rules) ? formBehaviorFromRules(ctx.rules, ctx.names) : null;
    },
  };
}

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
}

function dataSourcesView(ctx: EmitContext): DataSourcesView {
  const { ds } = ctx.collected;
  const sources = ctx.mock.dataSources;
  return {
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

/** Шаг визарда глазами корневого `form.validation.ts`. */
export interface StepValidationStep {
  /** Имя шага в агрегаторе: `step1`, `step2`, … */
  readonly name: string;
  /** Селектор шага в схеме — уезжает в комментарий, чтобы шаг находился глазами. */
  readonly selector: string | null;
  readonly required: readonly string[];
}

export interface StepValidationView {
  readonly steps: readonly StepValidationStep[];
  /** Обязательные поля вне шагов: проверяются только полной проверкой (отправка). */
  readonly rest: readonly string[];
}

/**
 * Пошаговая проверка визарда: `null` у простой формы.
 *
 * От кита НЕ зависит: без адаптера визарда форма остаётся визардом (`steps/` печатается), просто
 * `registry.ts` регистрирует заглушку. Раньше в этом случае форма печаталась как простая.
 */
function stepValidationView(ctx: EmitContext): StepValidationView | null {
  if (ctx.layout.kind !== 'wizard') return null;
  const steps = ctx.layout.steps;
  // С правилами формы обязательность задают ПРАВИЛА, а не флаг required в схеме: печатать оба
  // значило бы проверять поле дважды и расходиться при правке одного из них.
  const fromRules = hasValidationRules(ctx.rules);
  const inSteps = new Set(steps.flatMap((step) => step.required));
  return {
    steps: steps.map((step) => ({
      name: step.alias,
      selector: step.selector,
      required: fromRules ? [] : step.required,
    })),
    rest: fromRules
      ? []
      : [...new Set(ctx.collected.requiredPaths)].filter((path) => !inSteps.has(path)),
  };
}

/** Спецификаторы импорта файлов корня — из файла корня. */
export interface RootImportsView {
  readonly schema: string;
  readonly types: string;
  readonly model: string;
  readonly registry: string;
  readonly wizard: string;
  readonly dataSources: string;
  readonly render: string;
  readonly behavior: string;
  readonly validation: string;
  readonly api: string;
  /** Агрегатор шагов (`./steps`). */
  readonly steps: string;
}

/** Шаг в агрегаторе `steps/index.ts`. */
export interface StepIndexEntry {
  readonly alias: string;
  readonly dir: string;
  readonly title: string;
  /** Импорт файла валидации шага из агрегатора (`./kontakty/validation`). */
  readonly validationImport: string;
  /** Импорт render-файла шага из агрегатора (`./kontakty/form.render`). */
  readonly renderImport: string;
  /** Спецификатор схемы шага в корне (`./steps/kontakty/form.schema.json`) — у вынесенного шага. */
  readonly schemaRef: string | null;
  /** Импорт схемы шага из агрегатора (`./kontakty/form.schema.json`) — у вынесенного шага. */
  readonly schemaImport: string | null;
}

export interface LayoutView {
  readonly kind: 'simple' | 'wizard';
  readonly isWizard: boolean;
  /**
   * Визард разбит по шагам: корневая схема держит ссылки, и `index.tsx` собирает её
   * `composeJsonFormSchema` из `stepSchemas` агрегатора.
   */
  readonly isSplit: boolean;
  readonly imports: RootImportsView;
  /** Имена файлов корня — для README и комментариев. */
  readonly files: typeof MODULE_FILES;
  readonly steps: readonly StepIndexEntry[];
  /** Имя агрегатора шагов (`steps/index.ts`). */
  readonly stepsIndex: string;
}

/** Файл шага глазами шаблона. */
export interface StepView {
  readonly index: number;
  readonly dir: string;
  readonly title: string;
  readonly selector: string | null;
  readonly alias: string;
  /** Обязательные поля шага (пусто, если валидацию задают правила формы). */
  readonly required: readonly string[];
  /**
   * `form.validation.ts` шага, напечатанный из правил формы, либо `null` — тогда заготовка шаблона.
   * Геттер: печатают его билдеры `@reformer/mcp`, и отказ одного шага не должен ронять вид.
   */
  readonly validationCode: string | null;
  /** Спецификаторы импорта из файла шага. */
  readonly imports: { readonly types: string };
  /** Render-правила и заготовки шага. */
  readonly render: StepRenderView;
}

function layoutView(ctx: EmitContext): LayoutView {
  const from = MODULE_FILES.index;
  const rel = (to: string): string => importOf(from, to);
  return {
    kind: ctx.layout.kind,
    isWizard: ctx.layout.kind === 'wizard',
    isSplit: ctx.composition !== null,
    imports: {
      schema: rel(MODULE_FILES.schema),
      types: rel(MODULE_FILES.types),
      model: rel(MODULE_FILES.model),
      registry: rel(MODULE_FILES.registry),
      wizard: rel(MODULE_FILES.wizard),
      dataSources: rel(MODULE_FILES.dataSources),
      render: rel(MODULE_FILES.render),
      behavior: rel(MODULE_FILES.behavior),
      validation: rel(MODULE_FILES.validation),
      api: rel(MODULE_FILES.api),
      steps: rel(STEPS_INDEX),
    },
    files: MODULE_FILES,
    steps: ctx.layout.steps.map((step) => ({
      alias: step.alias,
      dir: step.dir,
      title: step.title,
      validationImport: importOf(STEPS_INDEX, step.files.validation),
      renderImport: importOf(STEPS_INDEX, step.files.render),
      schemaRef: step.schemaRef,
      schemaImport:
        step.schemaRef === null ? null : importOf(STEPS_INDEX, normalizeStepRef(step.schemaRef)),
    })),
    stepsIndex: STEPS_INDEX,
  };
}

/** Вид файла шага. */
export function stepView(ctx: EmitContext, step: StepInfo): StepView {
  return {
    index: step.index,
    dir: step.dir,
    title: step.title,
    selector: step.selector,
    alias: step.alias,
    required: hasValidationRules(ctx.rules) ? [] : step.required,
    get validationCode() {
      return hasValidationRules(ctx.rules)
        ? stepValidationFromRules(ctx.rules, ctx.names, ctx.layout, step)
        : null;
    },
    imports: { types: importOf(step.files.validation, MODULE_FILES.types) },
    render: stepRenderView(ctx, step),
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
    wizard: wizardShimOf(ctx),
    stepValidation: stepValidationView(ctx),
    registry: registryView(ctx),
    layout: layoutView(ctx),
    step: null,
    renderBehavior: renderBehaviorView(ctx),
    files: ctx.files,
    indent,
    json,
    blocks,
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
