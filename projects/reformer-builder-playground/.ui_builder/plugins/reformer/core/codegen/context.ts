/**
 * Контекст эмиссии — единственный аргумент каждого эмиттера.
 *
 * Один объект, а не пять параметров, потому что состав того, что нужно эмиттеру, растёт:
 * в v1 сигнатуры разошлись (`emitTypes(c, n)`, `emitBehavior(n, sel, rules)`,
 * `emitReadme(n, sel, c)`), и добавление кита означало бы правку каждой. Здесь добавление
 * поля не меняет ни одной сигнатуры — а значит, и ни одного вклада в точку расширения.
 *
 * Контекст СОБИРАЕТСЯ один раз на генерацию ({@link prepare}) и передаётся всем целям: обход
 * схемы, классификация источников и проставление селекторов стоят одинаково для каждого файла,
 * а результат обязан быть один и тот же — иначе `types/<dir>.ts` описывал бы не ту схему, которую
 * напечатал документ формы.
 *
 * @module plugins/reformer/core/codegen/context
 */

import type { JsonFormSchema } from '@reformer/renderer-json';
import { emptyRules, type FormRules } from '../form-model/rules';
import { splitFormSchema, type SplitFormSchema, type StepOrigins } from '../form-model/composite';
import { collect, valueTypesOf, type Collected } from './collect';
import type { KitView } from './components';
import { synthMock } from '../form-mock';
import { DEFAULT_SCHEMA_PATH, moduleFilesOf, type ModuleFiles } from './layout';
import { makeNames, type Names } from './naming';
import { assignSelectors, type SelectorInfo } from './selectors';
import { layoutOf, type ModuleLayout, type StepInfo } from './steps';
import type { FileClass, FormMock } from './types';

/** Что подаётся на вход генерации. */
export interface CodegenInput {
  /** Схема как её видит человек. Не мутируется: селекторы проставляются на копии. */
  readonly schema: JsonFormSchema;
  /** Свободное имя формы — обычно имя каталога модуля. */
  readonly formName: string;
  /** Кит и его каталог. Обязательны: без кита неизвестно, откуда импортировать компоненты. */
  readonly kit: KitView;
  /**
   * Путь документа формы ВНУТРИ модуля. По умолчанию `schema/form.schema.json`.
   *
   * Иной — у формы, чей документ лежит в корне модуля (создана до перехода на папки ролей):
   * документ остаётся на месте, а импорты и место файлов шагов считаются от него.
   */
  readonly schemaPath?: string;
  /** Правила формы. Их отсутствие — не ошибка: форма без правил валидна. */
  readonly rules?: FormRules;
  /** Авторские мок-данные. Без них синтезируются из схемы ({@link synthMock}). */
  readonly mock?: FormMock;
  /**
   * Какие шаги собранной схемы пришли из своих файлов (`$nodeId` → файл). Кодоген повторяет
   * структуру источника: разбитая форма печатается разбитой, шаги остаются в своих папках.
   */
  readonly origins?: StepOrigins;
  /** Вынести в файлы все шаги визарда — так печатается шаблон «Пошаговая форма». */
  readonly splitSteps?: boolean;
}

/**
 * Файл, который БУДЕТ произведён этим прогоном: имя и класс, без содержимого.
 *
 * Нужен ровно одному эмиттеру — README, который перечисляет состав модуля. В v1 этот список
 * был литералом внутри текста README и расходился с фактическим набором файлов при каждой
 * правке. Раз состав теперь решают вклады, перечислять его обязан тот же список, по которому
 * файлы и печатаются, — иначе чужая цель в README не появится никогда.
 */
export interface EmittedFileRef {
  readonly path: string;
  readonly cls: FileClass;
  /** Шаг визарда, которому принадлежит файл (номер с единицы); у файлов формы — нет. */
  readonly step?: number;
}

/** Всё, что эмиттеры читают, и ничего сверх. */
export interface EmitContext {
  /** Схема С ПРОСТАВЛЕННЫМИ селекторами — та, что уйдёт в документ формы. */
  readonly schema: JsonFormSchema;
  readonly names: Names;
  /**
   * Пути файлов модуля от его корня ({@link moduleFilesOf}).
   *
   * Несёт их контекст, а не константа раскладки: часть путей зависит от имени формы
   * (`<Type>.tsx`, `types/<dir>.ts`), а путь документа — от того, где он лежит.
   */
  readonly paths: ModuleFiles;
  readonly collected: Collected;
  readonly selectors: SelectorInfo;
  readonly mock: FormMock;
  readonly rules: FormRules;
  readonly kit: KitView;
  /**
   * Раскладка модуля: простая форма или визард с шагами. Решает схема, а не кит (см. `./steps`).
   */
  readonly layout: ModuleLayout;
  /**
   * Схема, разложенная по файлам шагов, — у визарда, разбитого по шагам; иначе `null`.
   * Считается по схеме С селекторами, поэтому файлы шагов печатаются теми же, что `schema`.
   */
  readonly composition: SplitFormSchema | null;
  /**
   * Шаг, для которого печатается файл, — у целей, размноженных по шагам. У файлов формы нет.
   */
  readonly step?: StepInfo;
  /**
   * Состав модуля этого прогона.
   *
   * Пуст в момент, когда цели отвечают на вопрос «применяюсь ли я»: применимость обязана
   * зависеть от формы и кита, а не от того, кто ещё вносил цели. Заполняется сразу после
   * отбора — до первого вызова `emit`.
   */
  readonly files: readonly EmittedFileRef[];
}

/** Разобрать вход в контекст: один обход схемы на всю генерацию. */
export function prepare(input: CodegenInput): EmitContext {
  const { schema, info } = assignSelectors(input.schema);
  // Вид значения полей, для которых у синтеза нет правила по имени, — из каталога кита. Одна
  // таблица на мок и тип листа: иначе начальные значения не подошли бы под тип формы.
  const valueTypeOf = valueTypesOf(input.kit.catalog);
  const mock = input.mock ?? synthMock(schema, valueTypeOf);
  const collected = collect(schema, mock, valueTypeOf);
  const split = splitFormSchema(schema, input.origins ?? new Map(), { all: input.splitSteps });
  const composition = split.parts.size > 0 ? split : null;
  const names = makeNames(input.formName);
  const paths = moduleFilesOf(names, input.schemaPath ?? DEFAULT_SCHEMA_PATH);
  return {
    schema,
    composition,
    names,
    paths,
    collected,
    selectors: info,
    layout: layoutOf(schema, collected, info, composition, paths.schema),
    mock,
    rules: input.rules ?? emptyRules(),
    kit: input.kit,
    files: [],
  };
}

/** Тот же контекст с известным составом модуля. */
export function withFiles(ctx: EmitContext, files: readonly EmittedFileRef[]): EmitContext {
  return { ...ctx, files };
}

/** Тот же контекст для файла шага. */
export function withStep(ctx: EmitContext, step: StepInfo): EmitContext {
  return { ...ctx, step };
}
