/**
 * Целостность правил относительно схемы: правило, указывающее в никуда.
 *
 * **Почему это обязано существовать.** Правило render-слоя адресует узел по `selector`. Удалили
 * узел, переименовали селектор руками — и `schema.node('typo')` в рантайме даёт МОЛЧАЛИВЫЙ no-op:
 * ни ошибки, ни эффекта. Правило валидации на несуществующий путь модели ведёт себя так же. Это
 * тот класс поломок, который в этом проекте считается худшим, и обнаружить его без запуска формы
 * сегодня негде: `crossCheckBundle` из `@reformer/mcp` в билдере не зовётся, а звать его бесполезно
 * — он видит сериализованную раскладку в момент генерации, а не живую схему, которую правят.
 *
 * **Почему не удаляем молча.** Осиротевшее правило — работа пользователя. Стереть её при удалении
 * узла значит потерять её без спроса. Поэтому здесь только диагноз; решение — за человеком.
 *
 * @module lib/form-model/rules-integrity
 */

import { collectSchemaSelectors, type JsonFormSchema } from '@reformer/renderer-json';
import { collectModelPaths } from './query';
import type { FormRules } from './rules';

/** Одно осиротевшее правило. */
export interface RuleProblem {
  /** Какой список: `validation` | `behavior` | `render`. */
  list: 'validation' | 'behavior' | 'render';
  /** Индекс в списке — им правило и адресуется при удалении. */
  index: number;
  /** Адрес, которого нет: путь модели либо селектор. */
  missing: string;
  /** Готовая фраза для панели предупреждений. */
  message: string;
}

/**
 * Путь считается известным, если он есть среди привязок ЛИБО является их продолжением/префиксом.
 *
 * Точное совпадение отвергало бы законные вложенные пути (`items.price` при массиве `items`), а
 * это ровно те правила, которые пишут для массивов.
 */
function unknownPath(path: string, known: Set<string>): boolean {
  if (known.has(path)) return false;
  for (const k of known) {
    if (path.startsWith(`${k}.`) || k.startsWith(`${path}.`)) return false;
  }
  return true;
}

/** Правила, указывающие на несуществующие узлы и поля. Пустой массив — всё сходится. */
export function checkRules(schema: JsonFormSchema, rules: FormRules): RuleProblem[] {
  const problems: RuleProblem[] = [];
  const paths = new Set(collectModelPaths(schema));
  const selectors = new Set(collectSchemaSelectors(schema));

  rules.validation.forEach((rule, index) => {
    if (unknownPath(rule.target, paths)) {
      problems.push({
        list: 'validation',
        index,
        missing: rule.target,
        message: `Правило валидации на «${rule.target}»: такого поля в форме нет.`,
      });
    }
  });

  rules.behavior.forEach((rule, index) => {
    for (const target of [rule.target, ...(rule.sources ?? [])]) {
      if (unknownPath(target, paths)) {
        problems.push({
          list: 'behavior',
          index,
          missing: target,
          message: `Поведение «${rule.kind}» ссылается на «${target}»: такого поля в форме нет.`,
        });
        break;
      }
    }
  });

  rules.render.forEach((rule, index) => {
    if (!selectors.has(rule.selector)) {
      problems.push({
        list: 'render',
        index,
        missing: rule.selector,
        message:
          `Правило «${rule.kind}» адресует узел «${rule.selector}», которого в схеме нет — ` +
          'в рантайме оно ничего не сделает.',
      });
    }
  });

  return problems;
}

/** Строки для панели предупреждений — тот же канал, что у структурного линта схемы. */
export function ruleWarnings(schema: JsonFormSchema, rules: FormRules): string[] {
  return checkRules(schema, rules).map((p) => p.message);
}

/** Убрать осиротевшие правила — вызывается ТОЛЬКО по явному решению пользователя. */
export function dropOrphanRules(schema: JsonFormSchema, rules: FormRules): FormRules {
  const bad = checkRules(schema, rules);
  const drop = (list: RuleProblem['list']) =>
    new Set(bad.filter((p) => p.list === list).map((p) => p.index));
  const v = drop('validation');
  const b = drop('behavior');
  const r = drop('render');
  return {
    validation: rules.validation.filter((_, i) => !v.has(i)),
    behavior: rules.behavior.filter((_, i) => !b.has(i)),
    render: rules.render.filter((_, i) => !r.has(i)),
  };
}
