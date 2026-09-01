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
 * @module reformer-builder/lib/codegen/view
 */

import { hasBehaviorRules, hasValidationRules } from '../../form-model/rules';
import type { EmitContext, EmittedFileRef } from '../context';
import { formBehaviorFromRules, validationFromRules } from '../emit/rules-bridge';
import type { Names } from '../naming';
import type { SelectorInfo } from '../selectors';
import type { FormMock } from '../types';
import { registryView, type RegistryView } from './registry';
import { renderBehaviorView, type RenderBehaviorView } from './render-rules';
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
  /** Привязки реестра: символы кита, заглушки с причинами, источники. */
  readonly registry: RegistryView;
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
  /** Тело `validation.ts` целиком либо `null`, если правил валидации нет. */
  readonly validationCode: string | null;
  /** Тело `form.behavior.ts` целиком либо `null`, если реактивных связей нет. */
  readonly behaviorCode: string | null;
}

function rulesView(ctx: EmitContext): RulesView {
  return {
    get validationCode() {
      return hasValidationRules(ctx.rules) ? validationFromRules(ctx.rules, ctx.names) : null;
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
    registry: registryView(ctx),
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
