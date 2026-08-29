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
 * а результат обязан быть один и тот же — иначе `types.ts` описывал бы не ту схему, которую
 * напечатал `renderer.schema.json`.
 *
 * @module reformer-builder/lib/codegen/context
 */

import type { JsonFormSchema } from '@reformer/renderer-json';
import { emptyRules, type FormRules } from '../form-model/rules';
import { collect, type Collected } from './collect';
import type { KitView } from './components';
import { synthMock } from '../form-mock';
import { makeNames, type Names } from './naming';
import { assignSelectors, type SelectorInfo } from './selectors';
import type { FileClass, FormMock } from './types';

/** Что подаётся на вход генерации. */
export interface CodegenInput {
  /** Схема как её видит человек. Не мутируется: селекторы проставляются на копии. */
  readonly schema: JsonFormSchema;
  /** Свободное имя формы — обычно имя файла схемы. */
  readonly formName: string;
  /** Кит и его каталог. Обязательны: без кита неизвестно, откуда импортировать компоненты. */
  readonly kit: KitView;
  /** Правила формы. Их отсутствие — не ошибка: форма без правил валидна. */
  readonly rules?: FormRules;
  /** Авторские мок-данные. Без них синтезируются из схемы ({@link synthMock}). */
  readonly mock?: FormMock;
}

/**
 * Файл, который БУДЕТ произведён этим прогоном: имя и класс, без содержимого.
 *
 * Нужен ровно одному эмиттеру — README, который перечисляет состав модуля. В v1 этот список
 * был литералом внутри текста README и расходился с фактическим набором файлов при каждой
 * правке (`renderer.wizard.tsx` в него дописывали руками отдельной веткой). Раз состав теперь
 * решают вклады, перечислять его обязан тот же список, по которому файлы и печатаются, —
 * иначе чужая цель в README не появится никогда.
 */
export interface EmittedFileRef {
  readonly path: string;
  readonly cls: FileClass;
}

/** Всё, что эмиттеры читают, и ничего сверх. */
export interface EmitContext {
  /** Схема С ПРОСТАВЛЕННЫМИ селекторами — та, что уйдёт в `renderer.schema.json`. */
  readonly schema: JsonFormSchema;
  readonly names: Names;
  readonly collected: Collected;
  readonly selectors: SelectorInfo;
  readonly mock: FormMock;
  readonly rules: FormRules;
  readonly kit: KitView;
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
  const mock = input.mock ?? synthMock(schema);
  return {
    schema,
    names: makeNames(input.formName),
    collected: collect(schema, mock),
    selectors: info,
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
