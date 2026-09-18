/**
 * Проверка схемы демо-стека: то, что разбор пропускает, но форма из этого не выйдет.
 *
 * Разбор отвечает «это схема стека»; проверка — «из неё получится форма». Пустое имя и два поля
 * с одним именем разбираются, но у первого нет значения в модели, а второе затирает первое.
 *
 * @module @reformer/builder-stack-plain/check
 */

import type { PlainForm } from './schema';

export type PlainProblemCode = 'empty-name' | 'duplicate-name' | 'no-options';

export interface PlainProblem {
  readonly code: PlainProblemCode;
  /** Номер поля в `fields`. */
  readonly index: number;
  readonly params: Readonly<Record<string, string | number>>;
}

export function checkPlainForm(form: PlainForm): readonly PlainProblem[] {
  const problems: PlainProblem[] = [];
  const seen = new Map<string, number>();
  form.fields.forEach((field, index) => {
    if (field.name.trim() === '') {
      problems.push({ code: 'empty-name', index, params: { index: index + 1 } });
    } else if (seen.has(field.name)) {
      problems.push({
        code: 'duplicate-name',
        index,
        params: { name: field.name, first: seen.get(field.name)! + 1 },
      });
    } else {
      seen.set(field.name, index);
    }
    if (field.type === 'select' && (field.options?.length ?? 0) === 0) {
      problems.push({ code: 'no-options', index, params: { name: field.name } });
    }
  });
  return problems;
}
