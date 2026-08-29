/**
 * Поведение UI: условная видимость, события узлов и динамические пропсы (`renderer.behavior.ts`).
 *
 * **Почему отдельный инструмент, а не параметр `set_form_rules`.** Тот адресует ПОЛЯ МОДЕЛИ и
 * проверяет пути, циклы и двойную запись. Этот адресует УЗЛЫ РАЗМЕТКИ и проверяет совсем другое.
 * Слить их в один значило бы описать модели схему, у которой половина полей осмысленна только при
 * определённом значении другого поля, — а именно на таких схемах модели ошибаются чаще всего.
 *
 * **Почему `ref`, а не `selector`.** Селектор — деталь, о которой модель знать не обязана и в
 * которой она будет ошибаться. Инструмент принимает тот же JSON Pointer, что и все остальные
 * write-инструменты, и сам обеспечивает узлу селектор (`@/lib/form-model/selectors`). Ровно этого условия и
 * не хватало раньше: `set_form_rules` отказывался принимать видимость, потому что «задать селектор
 * не умеет ни один инструмент агента», и принятое правило оказалось бы no-op.
 *
 * Один вызов меняет и схему (проставленный селектор), и сайдкар правил. Это представимо без правок
 * машинерии: `ToolOutcome` держит `schema` и `rules` независимо, `withOutcome` берёт оба, а
 * `applyChangeSet` кладёт их в ОДИН `pushHistory` — то есть один Ctrl+Z отменяет правку целиком.
 *
 * @module plugins/ai/core/tools/set-render-rules
 */

import { collectSchemaSelectors } from '@reformer/renderer-json';
import { ensureSelector } from '@/lib/form-model/selectors';
import {
  emptyRules,
  RENDER_RULE_KINDS,
  type FormRules,
  type RenderRuleIntent,
} from '@/lib/form-model/rules';
import { refToPath, resolveRef } from '../node-ref';
import { commitBatch } from '../gate';
import { fail, type AgentTool, type ToolOutcome } from '../types';

interface ParamRule {
  ref: string;
  kind: string;
  /** hideWhen: узел скрыт, когда выражение истинно. */
  condition?: string;
  /** onEvent: имя проп-события. */
  event?: string;
  /** onEvent: тело обработчика. */
  body?: string;
  /** patchProps: пропсы; строка `$expr(...)` вставляется выражением. */
  props?: Record<string, unknown>;
}

interface Params {
  rules?: ParamRule[];
  mode?: 'merge' | 'replace';
}

/** Чего не хватает правилу этого вида — сообщение отказа, а не молчаливый пропуск поля. */
function missingField(rule: ParamRule): string | null {
  if (rule.kind === 'hideWhen') return rule.condition ? null : 'condition';
  if (rule.kind === 'onEvent') {
    if (!rule.event) return 'event';
    return rule.body ? null : 'body';
  }
  if (rule.kind === 'patchProps') return rule.props ? null : 'props';
  return null;
}

/** Параметр → правило сайдкара с уже разрешённым селектором. */
function toRule(rule: ParamRule, selector: string): RenderRuleIntent {
  switch (rule.kind) {
    case 'hideWhen':
      return { kind: 'hideWhen', selector, condition: rule.condition! };
    case 'onEvent':
      return { kind: 'onEvent', selector, event: rule.event!, body: rule.body! };
    default:
      return { kind: 'patchProps', selector, props: rule.props! };
  }
}

/** Человеку — по-русски, модели — по-английски. Тот же разнос, что у описаний правок схемы. */
function describe(rule: RenderRuleIntent): { summary: string; report: string } {
  switch (rule.kind) {
    case 'hideWhen':
      return {
        summary: `«${rule.selector}» скрывается по условию`,
        report: `${rule.selector} → hideWhen(${rule.condition})`,
      };
    case 'onEvent':
      return {
        summary: `«${rule.selector}»: обработчик ${rule.event}`,
        report: `${rule.selector} → ${rule.event} handler`,
      };
    case 'patchProps':
      return {
        summary: `«${rule.selector}»: пропсы ${Object.keys(rule.props).join(', ')}`,
        report: `${rule.selector} → patchProps(${Object.keys(rule.props).join(', ')})`,
      };
  }
}

export const setRenderRulesTool: AgentTool<Params> = {
  name: 'set_render_rules',
  description:
    'UI behaviour of nodes (renderer.behavior.ts): hide a node by a condition, handle its event, ' +
    'patch its props. Node addresses, not model paths. Conditions read the form: ' +
    'form.pickup.value.value === true.',
  inputSchema: {
    type: 'object',
    properties: {
      rules: {
        type: 'array',
        minItems: 1,
        items: {
          type: 'object',
          properties: {
            ref: { type: 'string', description: 'Node address from get_form_outline' },
            kind: { type: 'string', enum: [...RENDER_RULE_KINDS] },
            condition: { type: 'string', description: 'hideWhen: node is HIDDEN when true' },
            event: { type: 'string', description: 'onEvent: onClick, onSubmit, onBlur' },
            body: { type: 'string', description: 'onEvent: handler body, TypeScript' },
            props: { type: 'object', description: 'patchProps: $expr(...) inserts an expression' },
          },
          required: ['ref', 'kind'],
          additionalProperties: false,
        },
      },
      mode: { type: 'string', enum: ['merge', 'replace'] },
    },
    additionalProperties: false,
  },
  readOnly: false,

  run(params, ctx): ToolOutcome {
    const incoming = params.rules ?? [];
    if (incoming.length === 0) {
      return fail('INVALID_PARAMS', 'No rules given.');
    }

    let schema = ctx.draft;
    const next: FormRules =
      params.mode === 'replace'
        ? { validation: [...ctx.rules.validation], behavior: [...ctx.rules.behavior], render: [] }
        : { ...emptyRules(), ...structuredCloneRules(ctx.rules) };

    const entries: { ref: string; kind: 'update'; summary: string; report: string }[] = [];

    for (const rule of incoming) {
      const lacks = missingField(rule);
      if (lacks) {
        return fail('INVALID_PARAMS', `Rule "${rule.kind}" needs "${lacks}".`);
      }

      const resolved = resolveRef(schema, rule.ref);
      if (!('node' in resolved)) return resolved;

      const ensured = ensureSelector(schema, refToPath(rule.ref));
      if (!ensured) return fail('STALE_POINTER', `No node at "${rule.ref}".`);
      schema = ensured.schema;

      const made = toRule(rule, ensured.selector);
      // Два правила одного вида на один узел — не «последнее выигрывает», а неопределённость:
      // порядок зависит от того, как их разложил сборщик. Заменяем, а не копим.
      const at = next.render.findIndex((r) => r.selector === made.selector && r.kind === made.kind);
      if (at >= 0) next.render[at] = made;
      else next.render.push(made);

      entries.push({ ref: rule.ref, kind: 'update', ...describe(made) });
    }

    // Схема прошла гейт вместе с проставленными селекторами: `selector` легален на всех трёх видах
    // узла, поэтому новых ошибок появиться не должно — но проверяем, а не предполагаем.
    const gated = commitBatch(ctx, schema, entries);
    if (!gated.ok) return gated;

    const known = new Set(collectSchemaSelectors(schema));
    const dead = next.render.filter((r) => !known.has(r.selector)).map((r) => r.selector);
    const note = dead.length
      ? ` Warning: ${dead.length} existing rule(s) point at missing nodes: ${dead.join(', ')}.`
      : '';

    return { ...gated, text: `${gated.text}${note}`, rules: next };
  },
};

/** Копия набора: массивы нельзя делить между черновиком хода и вкладкой. */
function structuredCloneRules(rules: FormRules): FormRules {
  return {
    validation: [...rules.validation],
    behavior: [...rules.behavior],
    render: [...rules.render],
  };
}
