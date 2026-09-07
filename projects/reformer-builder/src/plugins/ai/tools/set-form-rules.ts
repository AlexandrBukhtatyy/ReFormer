/**
 * Правила формы: валидация, реактивные связи, условная видимость.
 *
 * Единственный write-инструмент, который правит НЕ схему. Правила — сайдкар (`@/lib/form-model/rules`):
 * в `JsonFormSchema` их положить некуда, контракт `@reformer/renderer-json` закрыт. Из них
 * генерируются `validation.ts` и `form.behavior.ts`, которые до сих пор были заглушками с TODO.
 *
 * Гейт здесь строже, чем у правок раскладки, и не случайно. Неверная раскладка видна на канвасе
 * сразу; неверное правило выглядит правдоподобно и ломается у пользователя — при сборке его
 * проекта или, хуже, молча в рантайме. Поэтому проверяются три вещи, каждая из которых уже
 * однажды всплывала:
 *
 *  - **пути модели существуют** — правило на несуществующее поле не сработает никогда, и
 *    заметить это без запуска формы нельзя;
 *  - **нет циклов** — `a` считается из `b`, `b` из `a` даёт бесконечный пересчёт;
 *  - **поле не пишется дважды** — два `computeFrom` на один target тихо перетирают друг друга.
 *
 * Условной видимости здесь намеренно НЕТ, хотя `FormRules` её держит и эмиттер умеет.
 * Правило видимости адресует узел по `selector`, а селекторы проставляются только при
 * экспорте и только контейнерам-секциям, массивам и кнопкам (`codegen/assign-selectors.ts`);
 * обычное поле его не получает вовсе, и задать его вручную не умеет ни один инструмент агента.
 * Принятое правило видимости поэтому почти всегда оказалось бы no-op — ни ошибки, ни эффекта,
 * худший исход из возможных. Параметр вернётся, когда селектором можно будет управлять.
 *
 * @module plugins/ai/tools/set-form-rules
 */

import { findCycle } from '@reformer/mcp/dist/core/utils/graph.js';
import { collectModelPaths } from '@/lib/form-model/query';
import { similarNames } from '../loop/suggest';
import { emptyRules, type FormRules } from '@/lib/form-model/rules';
import { fail, ok, type AgentTool, type ToolOutcome } from '../model/types';

/** Виды реактивных связей — те же десять, что понимает `@reformer/core/behaviors`. */
const BEHAVIOR_KINDS = [
  'compute',
  'computeFrom',
  'copyFrom',
  'syncFields',
  'onChange',
  'enableWhen',
  'disableWhen',
  'resetWhen',
  'transformValue',
  'revalidateWhen',
] as const;

interface Params {
  validation?: Array<{ target: string; rules: string[]; when?: string; each?: string }>;
  behavior?: Array<{ kind: string; target: string; sources?: string[]; expr?: string }>;
  /** `replace` — заменить весь набор; по умолчанию правила добавляются к существующим. */
  mode?: 'merge' | 'replace';
}

export const setFormRulesTool: AgentTool<Params> = {
  name: 'set_form_rules',
  description:
    'Validation and reactive behaviour of the form (validation.ts, form.behavior.ts). Model paths, ' +
    'not node addresses. Expressions are TypeScript read through model: model.country !== null.',
  inputSchema: {
    type: 'object',
    properties: {
      validation: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            target: { type: 'string' },
            rules: {
              type: 'array',
              items: { type: 'string' },
              description: 'required, email, min(1) — from @reformer/core/validators',
            },
            when: { type: 'string', description: 'Rule applies only when true' },
            each: { type: 'string', description: 'Array path: apply per item' },
          },
          required: ['target', 'rules'],
          additionalProperties: false,
        },
      },
      behavior: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            kind: { type: 'string', enum: [...BEHAVIOR_KINDS] },
            target: { type: 'string', description: 'Path it WRITES' },
            sources: {
              type: 'array',
              items: { type: 'string' },
              description: 'Paths it READS; cycles checked over these',
            },
            expr: { type: 'string' },
          },
          required: ['kind', 'target'],
          additionalProperties: false,
        },
      },
      mode: { type: 'string', enum: ['merge', 'replace'] },
    },
    additionalProperties: false,
  },
  readOnly: false,

  run(params, ctx): ToolOutcome {
    const known = new Set(collectModelPaths(ctx.draft));
    const next: FormRules = params.mode === 'replace' ? emptyRules() : cloneRules(ctx.rules);

    // Путь может указывать внутрь объекта или элемента массива (`items.price`), поэтому
    // сравнение по префиксу: точное совпадение отвергало бы законные вложенные пути.
    const unknown = (path: string) =>
      !known.has(path) &&
      ![...known].some((k) => path.startsWith(`${k}.`) || k.startsWith(`${path}.`));

    for (const rule of params.validation ?? []) {
      if (unknown(rule.target)) {
        return fail(
          'STALE_POINTER',
          `No field bound to "${rule.target}".`,
          similarNames(rule.target, [...known])
        );
      }
      next.validation.push({ ...rule });
    }

    for (const b of params.behavior ?? []) {
      if (unknown(b.target)) {
        return fail(
          'STALE_POINTER',
          `No field bound to "${b.target}".`,
          similarNames(b.target, [...known])
        );
      }
      for (const s of b.sources ?? []) {
        if (unknown(s)) {
          return fail(
            'STALE_POINTER',
            `Source "${s}" is not bound to any field.`,
            similarNames(s, [...known])
          );
        }
      }
      next.behavior.push({ ...b, sources: b.sources ?? [] } as (typeof next.behavior)[number]);
    }

    // Два поведения на один target перетирают друг друга молча — это не «последнее выигрывает»,
    // а гонка: порядок зависит от того, как их разложил сборщик.
    const writers = new Map<string, number>();
    for (const b of next.behavior) writers.set(b.target, (writers.get(b.target) ?? 0) + 1);
    const twice = [...writers].filter(([, n]) => n > 1).map(([t]) => t);
    if (twice.length > 0) {
      return fail('SCHEMA_INVALID', `Two behaviours write the same field: ${twice.join(', ')}.`);
    }

    const cycle = findCycle(
      next.behavior.map((b) => ({ target: b.target, reads: b.sources ?? [] }))
    );
    if (cycle) {
      return fail('SCHEMA_INVALID', `Cycle in computed fields: ${cycle.join(' → ')}.`);
    }

    return {
      ...ok(summarize(next)),
      rules: next,
      ops: [{ kind: 'update', ref: '/rules', summary: summarize(next) }],
    };
  },
};

function cloneRules(rules: FormRules): FormRules {
  return {
    validation: [...rules.validation],
    behavior: [...rules.behavior],
    render: [...rules.render],
  };
}

function summarize(rules: FormRules): string {
  return (
    `Готово. Правил: валидация ${rules.validation.length}, поведение ${rules.behavior.length}, ` +
    `render ${rules.render.length}. Они уходят в validation.ts и form.behavior.ts.`
  );
}
