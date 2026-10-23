/**
 * Чей шаблон и кого спросить: правила выбора стека для вопросов хозяина шаблонов.
 *
 * Хозяин не знает ни одного формата формы — документ, вид, токены модуля, пустую форму и место
 * модуля он спрашивает у стеков (`TemplateStack` SDK). У шаблона стек один — тот, чей `owns`
 * узнал набор файлов. У вопросов без набора (документ, рядом с которым кладут форму; форма без
 * шаблона) — первый стек, у которого есть ответ.
 *
 * @module plugins/forms/templates/content/stacks
 */

import type { FormTemplate, TemplateFile } from '../contract';
import type { TemplateStack } from '@reformer/builder-plugin-api';

/** Стек шаблона: первый, чей `owns` узнал набор файлов; `null` — набор ничей. */
export function templateStackOf(
  stacks: readonly TemplateStack[],
  files: readonly TemplateFile[]
): TemplateStack | null {
  return stacks.find((stack) => stack.owns(files)) ?? null;
}

/**
 * Токены имён модуля для формы — у стека шаблона.
 *
 * У ничьего шаблона (стили, конфиги, файлы без документа формы) — у первого стека, где они есть:
 * шаблон проекта, написанный руками, вправе назвать файл именем модуля и получить то имя, с
 * которым согласится генерация.
 */
export function moduleTokensOf(
  stacks: readonly TemplateStack[],
  files: readonly TemplateFile[],
  formName: string
): Readonly<Record<string, string>> {
  const owner = templateStackOf(stacks, files) ?? stacks.find((stack) => stack.tokens);
  return owner?.tokens?.(formName) ?? {};
}

/**
 * Имена токенов модуля у всех стеков — слова, которые снимок каталога не вправе съесть своей
 * токенизацией. Значения не важны: имена токенов от имени формы не зависят.
 */
export function moduleTokenNames(stacks: readonly TemplateStack[]): readonly string[] {
  return [...new Set(stacks.flatMap((stack) => Object.keys(stack.tokens?.('form') ?? {})))];
}

/** Глубина документа в его модуле — у первого стека, который знает модуль; `null` — модуля нет. */
export function moduleDepthOf(
  stacks: readonly TemplateStack[],
  documentPath: string
): number | null {
  for (const stack of stacks) {
    const depth = stack.moduleDepthOf?.(documentPath);
    if (depth !== undefined && depth !== null) return depth;
  }
  return null;
}

/** Пустая форма — у первого стека, который её умеет; `null` — создать форму без шаблона нечем. */
export function emptyTemplateOf(stacks: readonly TemplateStack[]): FormTemplate | null {
  const stack = stacks.find((candidate) => candidate.empty);
  return stack?.empty?.() ?? null;
}
