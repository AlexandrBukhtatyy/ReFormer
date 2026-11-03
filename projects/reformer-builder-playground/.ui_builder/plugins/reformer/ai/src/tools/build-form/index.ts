/**
 * `build_form` — форма, шаг или блок одним intent: поля, раскладка и правила вместе.
 *
 * Тот же приём, что у `form_build` в MCP (план mcp-misty-graham): модель описывает форму ОДНИМ
 * декларативным объектом, детерминированная сборка превращает его в документ, а модели возвращается
 * только диагностика. Без него форма собиралась десятками вызовов `insert_node` и `set_form_rules`,
 * и большую спеку не довёл до конца ни один режим ассистента.
 *
 * Сборка — не второй механизм правки, а последовательность уже существующих инструментов над одним
 * черновиком: узлы ставит `insert_node` (фабрика каталога и гейт схемы — его), правила —
 * `set_form_rules` (пути, коды замечаний, циклы, два писателя), видимость — `set_render_rules`
 * (селектор узла). Отказ любого шага отменяет всё: черновик хода не меняется, пока не собрано целое.
 *
 * Intent читает и раскладывает MCP (`readIntent`, `buildSchemaLayout`) — тот же словарь, в котором
 * билдер уже хранит правила (`core/form-model/rules`). Что из intent документу билдера некуда
 * положить (начальные значения, опции связей), ответ называет, а не теряет молча.
 *
 * @module plugins/reformer/ai/tools/build-form
 */

import {
  buildSchemaLayout,
  collectSteps,
  inspectLayoutRefs,
  modelPaths,
  readIntent,
  type FormIntent,
  type LayoutNode,
} from '@reformer/mcp/intent';
import type { JsonFormSchema } from '@reformer/renderer-json';
import { collectModelPaths, emptyRules, type FormRules } from '../../../../core/form-model';
import { listComponents, wizardNames } from '../../model/catalog-digest';
import { isResolved, resolveRef } from '../../model/node-ref';
import { buildOutline } from '../../model/outline';
import { insertSlotOf } from '../../model/slots';
import {
  fail,
  ok,
  TOOL_TEXT_BUDGET,
  type AgentTool,
  type ChangeOp,
  type ToolContext,
  type ToolOutcome,
} from '../../model/types';
import { INSERT_MAX_NODES, insertNodeTool } from '../insert-node';
import { REF_PROP } from '../params';
import { setFormRulesTool } from '../set-form-rules';
import { setRenderRulesTool } from '../set-render-rules';
import { buildFormGrammar } from './grammar';
import { liftInline } from './lift';
import { planOf, type PlanNode } from './plan';

interface Params {
  intent?: unknown;
  parent?: string;
  index?: number;
}

/** Бюджет ответа: грамматика длиннее сводки правки, а без неё первый вызов бесполезен. */
const BUILD_FORM_TEXT_BUDGET = 4000;

/** Сколько проблем чтения intent назвать: чинит их модель по нескольку за раз. */
const MAX_PROBLEMS = 12;

/** Сколько замечаний сборки показать. */
const MAX_NOTES = 8;

export const buildFormTool: AgentTool<Params> = {
  name: 'build_form',
  description:
    'Build a whole form, a wizard step or a block from ONE intent: fields, layout and rules ' +
    'together. Call without intent to get its grammar. Point edits: the other tools.',
  inputSchema: {
    type: 'object',
    properties: {
      intent: { type: 'object', description: 'The form as one intent; omit to get the grammar' },
      parent: { ...REF_PROP, description: 'Step or section to add to; omit for an empty form' },
      index: { type: 'integer', minimum: 0 },
    },
    additionalProperties: false,
  },
  readOnly: false,
  textBudget: BUILD_FORM_TEXT_BUDGET,

  async run(params, ctx): Promise<ToolOutcome> {
    if (params.intent === undefined || params.intent === null) {
      return ok(buildFormGrammar(ctx.catalog));
    }

    const fieldComponents = listComponents(ctx.catalog, { role: 'field' }).map((c) => c.name);
    const lifted = liftInline(params.intent, fieldComponents);
    if (lifted.problems.length > 0) {
      return fail(
        'INVALID_PARAMS',
        `The intent was not read, nothing changed:\n${lifted.problems
          .slice(0, MAX_PROBLEMS)
          .map((p) => `- ${p}`)
          .join('\n')}\nEvery field needs "name" (a dotted name is a group field: address.city).`
      );
    }
    const raw = lifted.intent;
    const read = readIntent(raw);
    if (read.problems.length > 0) {
      const lines = read.problems
        .slice(0, MAX_PROBLEMS)
        .map((p) => `- ${p.at}: ${p.message}; expected ${p.expected}`);
      return fail(
        'INVALID_PARAMS',
        `The intent was not read, nothing changed:\n${lines.join('\n')}\n` +
          'Call build_form without intent for the grammar.'
      );
    }
    const intent = withStepsLayout(read.intent, raw);
    const steps = collectSteps(intent.layoutRoot).length;
    if (intent.fields.length + intent.arrays.length === 0 && steps === 0) {
      return fail('INVALID_PARAMS', emptyIntentMessage(raw));
    }

    const layout = inspectLayoutRefs(intent);
    if (layout.unknown.length > 0) {
      return fail(
        'INVALID_PARAMS',
        `Layout names what fields do not declare: ${layout.unknown.join(' ')} Declare each ` +
          'one in "fields": [{ "name", "component", "label" }].'
      );
    }
    const unplaced = [...intent.fields, ...intent.arrays]
      .filter((e) => !layout.placed.has(e.name) && !layout.placed.has(e.modelPath ?? e.name))
      .map((e) => e.name);
    if (unplaced.length > 0) {
      return fail(
        'INVALID_PARAMS',
        `Not placed in any step: ${unplaced.join(', ')}. Every field and array stands in one step.`
      );
    }

    const plan = planOf(buildSchemaLayout(intent).document, ctx.catalog);
    if ('error' in plan) return fail('INVALID_PARAMS', plan.error);

    // Без родителя — форма целиком: только пока она была пустой на начало хода. Повторный вызов
    // собирает её заново от базы: правка intent и пересборка, как у `form_build`.
    const rebuild = params.parent === undefined;
    if (rebuild && buildOutline(ctx.base).length > 1) {
      return fail(
        'INVALID_PARAMS',
        'The form already has content: pass parent — the step or section to add to.'
      );
    }
    const start = rebuild
      ? { draft: ctx.base, rules: emptyRules() }
      : { draft: ctx.draft, rules: ctx.rules };
    const parentRef = params.parent ?? '/root';
    const parent = resolveRef(start.draft, parentRef);
    if (!isResolved(parent)) return parent;
    const slot = insertSlotOf(parent.node, parent.path);
    if (slot === null) {
      return fail(
        'INVALID_PARENT',
        `Node ${parentRef} does not hold children: pick a step or section.`
      );
    }
    if (!rebuild) {
      const taken = new Set(collectModelPaths(start.draft));
      const clash = [...modelPaths(intent)].filter((path) => taken.has(path));
      if (clash.length > 0) {
        return fail(
          'INVALID_PARAMS',
          `Already in the form: ${clash.slice(0, 8).join(', ')}. build_form adds new fields; ` +
            'change existing ones with set_node_prop.'
        );
      }
    }

    const state: PlaceState = {
      ctx,
      rules: start.rules,
      draft: start.draft,
      ops: [],
      refs: new Map(),
      steps: [],
      blocks: [],
      step: wizardNames(ctx.catalog)?.step,
    };
    const top = topNodes(plan, slot.kind, state);
    const placed = await place(state, parentRef, top, params.index, true);
    if (placed !== null) return placed;

    const ruleParams = ruleParamsOf(intent);
    if (ruleParams !== null) {
      const out = await setFormRulesTool.run(ruleParams, at(state));
      if (!out.ok || out.rules === undefined) return located('Rules', out);
      state.rules = out.rules;
    }
    if (intent.visibility.length > 0) {
      const missing = intent.visibility.filter((v) => !state.refs.has(v.selector));
      if (missing.length > 0) {
        return fail(
          'INVALID_PARAMS',
          `visibility names no built node: ${missing.map((v) => v.selector).join(', ')}.`
        );
      }
      const out = await setRenderRulesTool.run(
        {
          mode: 'merge',
          rules: intent.visibility.map((v) => ({
            ref: state.refs.get(v.selector) as string,
            kind: 'hideWhen',
            condition: v.condition,
          })),
        },
        at(state)
      );
      if (!out.ok) return located('Visibility', out);
      state.draft = out.schema ?? state.draft;
      state.rules = out.rules ?? state.rules;
    }

    return {
      // Замечания — после раскладки шагов: замечание MCP о плоской разметке к ней уже не относится.
      ...ok(reply(intent, intent.warnings, state)),
      schema: state.draft,
      rules: state.rules,
      ops: [...state.ops, { kind: 'update', ref: '/rules', summary: 'правила формы' }],
    };
  },
};

/** Что собирается по ходу: черновик, правила и адреса построенного. */
interface PlaceState {
  readonly ctx: ToolContext;
  rules: FormRules;
  draft: JsonFormSchema;
  readonly ops: ChangeOp[];
  /** Селектор intent → адрес узла: по нему правило видимости находит свою цель. */
  readonly refs: Map<string, string>;
  /** Шаги визарда по порядку — их адреса нужны модели для следующих вызовов. */
  readonly steps: Array<{ readonly title: string; readonly ref: string }>;
  /**
   * Контейнеры, поставленные прямо в родителя: секции, визард. Без их адресов модель после сборки
   * шла искать собранное `get_form_outline` (замер 2026-11-03, сценарий 3.6).
   */
  readonly blocks: Array<{
    readonly component: string;
    readonly title: string;
    readonly ref: string;
  }>;
  /** Имя шага кита: по нему узел плана узнаётся как шаг. */
  readonly step: string | undefined;
}

const at = (state: PlaceState): ToolContext => ({
  ...state.ctx,
  draft: state.draft,
  rules: state.rules,
});

/** Отказ вложенного шага сборки — с тем, на чём он случился; черновик хода не тронут. */
function located(what: string, outcome: ToolOutcome): ToolOutcome {
  return { ...outcome, text: `${what}: ${outcome.text} Nothing was changed.` };
}

/**
 * Что ставить в родителя. Голый `Box` корня intent разворачивается: иначе форма получала бы
 * `Box` внутри корневого `Box`. В визард ставятся его шаги, а не второй визард.
 */
function topNodes(root: PlanNode, slotKind: string, state: PlaceState): readonly PlanNode[] {
  const plain = root.component === 'Box' && root.props === undefined && root.rows.length === 0;
  const nodes = plain ? root.children : [root];
  if (slotKind !== 'steps') return nodes;
  return nodes.flatMap((node) =>
    node.children.length > 0 && node.children.every((c) => c.component === state.step)
      ? node.children
      : [node]
  );
}

/** Сколько детей узла уходит в один вызов вместе с ним. */
const CHILDREN_PER_CALL = INSERT_MAX_NODES - 1;

/**
 * Поставить узлы в родителя вызовами `insert_node`.
 *
 * Один вызов несёт узел и его прямых детей: дети ЗАМЕНЯЮТ содержимое по умолчанию (шаг «Шаг 1» у
 * визарда), а глубина вызова ограничена. Глубже — следующими вызовами по адресам из ответа
 * предыдущего; строки массивов — в `item.$template`. Адреса узлов приходят в `ops` в порядке
 * вставки: узел, затем его дети.
 *
 * @param top Узлы ставятся прямо в родителя вызова `build_form`: их контейнеры называет ответ.
 * @returns Отказ либо `null`.
 */
async function place(
  state: PlaceState,
  parentRef: string,
  nodes: readonly PlanNode[],
  index?: number,
  top = false
): Promise<ToolOutcome | null> {
  let position = index;
  for (const chunk of chunks(nodes)) {
    const out = await insertNodeTool.run(
      {
        parent: parentRef,
        ...(position === undefined ? {} : { index: position }),
        nodes: chunk.map((node) => ({
          ...spec(node),
          ...(node.children.length > 0
            ? { children: node.children.slice(0, CHILDREN_PER_CALL).map(spec) }
            : {}),
        })),
      },
      at(state)
    );
    if (!out.ok || out.schema === undefined) return located(`Placing into ${parentRef}`, out);
    state.draft = out.schema;
    state.ops.push(...(out.ops ?? []));

    const refs = (out.ops ?? []).map((op) => op.ref);
    const pending: Array<{
      ref: string;
      children: readonly PlanNode[];
      rows: readonly PlanNode[];
    }> = [];
    let next = 0;
    for (const node of chunk) {
      const ref = refs[next++];
      record(state, node, ref);
      if (top && node.model === undefined && node.component !== state.step) {
        const title = node.props?.title ?? node.props?.label;
        state.blocks.push({ component: node.component, title: String(title ?? ''), ref });
      }
      const kids = node.children.slice(0, CHILDREN_PER_CALL);
      for (const kid of kids) {
        const kidRef = refs[next++];
        record(state, kid, kidRef);
        pending.push({ ref: kidRef, children: kid.children, rows: kid.rows });
      }
      pending.push({ ref, children: node.children.slice(kids.length), rows: node.rows });
    }
    for (const item of pending) {
      if (item.children.length > 0) {
        const refused = await place(state, item.ref, item.children);
        if (refused !== null) return refused;
      }
      if (item.rows.length > 0) {
        const refused = await place(state, `${item.ref}/item/$template`, item.rows);
        if (refused !== null) return refused;
      }
    }
    if (position !== undefined) position += chunk.length;
  }
  return null;
}

/** Узел для `insert_node` без детей. */
function spec(node: PlanNode): Record<string, unknown> {
  return {
    component: node.component,
    ...(node.model === undefined ? {} : { model: node.model }),
    ...(node.props === undefined ? {} : { props: node.props }),
  };
}

/** Пакеты вызовов: узел вместе с прямыми детьми, не больше {@link INSERT_MAX_NODES} на вызов. */
function chunks(nodes: readonly PlanNode[]): PlanNode[][] {
  const out: PlanNode[][] = [];
  let current: PlanNode[] = [];
  let size = 0;
  for (const node of nodes) {
    const cost = 1 + Math.min(node.children.length, CHILDREN_PER_CALL);
    if (current.length > 0 && size + cost > INSERT_MAX_NODES) {
      out.push(current);
      current = [];
      size = 0;
    }
    current.push(node);
    size += cost;
  }
  if (current.length > 0) out.push(current);
  return out;
}

function record(state: PlaceState, node: PlanNode, ref: string): void {
  if (node.selector !== undefined) state.refs.set(node.selector, ref);
  if (node.component === state.step) {
    state.steps.push({ title: String(node.props?.title ?? ''), ref });
  }
}

/**
 * Шаги сокращённой записью (`steps: [{ title, fields }]`) — в раскладку узлами `step`.
 *
 * MCP шаги из `wizard` по узлам не раскладывает (у core и renderer-react разметку шагов пишет
 * автор), а документу билдера раскладка нужна. Заданный `layoutRoot` побеждает: раскладку модель
 * написала сама.
 */
function withStepsLayout(intent: FormIntent, raw: unknown): FormIntent {
  const steps = intent.wizard?.steps ?? [];
  if (steps.length === 0 || collectSteps(intent.layoutRoot).length > 0 || declaresLayout(raw)) {
    return intent;
  }
  const arrays = new Set(intent.arrays.map((a) => a.name));
  const layoutRoot: LayoutNode = {
    kind: 'container',
    component: 'Box',
    children: steps.map((step) => ({
      kind: 'step' as const,
      title: step.title,
      children: step.fields.map((ref) =>
        arrays.has(ref) ? { kind: 'array' as const, ref } : { kind: 'field' as const, ref }
      ),
    })),
  };
  return {
    ...intent,
    layoutRoot,
    warnings: intent.warnings.filter((w) => !w.startsWith('Шагов в intent')),
  };
}

/** Задал ли intent раскладку сам — теми же ключами, что читает `readIntent`. */
function declaresLayout(raw: unknown): boolean {
  const source = typeof raw === 'string' ? safeParse(raw) : raw;
  if (source === null || typeof source !== 'object') return false;
  const keys = source as Record<string, unknown>;
  return (
    ['layoutRoot', 'root', 'tree'].some((key) => keys[key] !== undefined) ||
    (typeof keys.layout === 'object' && keys.layout !== null)
  );
}

function safeParse(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

/**
 * Отказ пустого intent — с тем, что пришло, и записью, которую ждёт сборка.
 *
 * Голое «полей нет» модель чинила наугад: в замере 2026-11-03 после него B.3 бросил `build_form` и
 * собрал блок мелкими вызовами.
 */
function emptyIntentMessage(raw: unknown): string {
  const source = typeof raw === 'string' ? safeParse(raw) : raw;
  const keys =
    source !== null && typeof source === 'object' && !Array.isArray(source)
      ? Object.keys(source)
      : [];
  return (
    'The intent has no fields, arrays or steps' +
    (keys.length > 0 ? ` (top-level keys received: ${keys.slice(0, 10).join(', ')})` : '') +
    '. Declare each field once in "fields": [{ "name", "component", "label" }] and place it by ' +
    'name in "steps": [{ "title", "fields": ["name"] }] or "layoutRoot". Call build_form ' +
    'without intent for the grammar.'
  );
}

/** Аргументы `set_form_rules` из intent; `null` — правил нет. */
function ruleParamsOf(intent: FormIntent): Parameters<typeof setFormRulesTool.run>[0] | null {
  const dataSources = Object.fromEntries(
    intent.dataSources
      .filter((d) => Array.isArray(d.values))
      .map((d) => [
        d.name,
        (d.values ?? []).map((v) =>
          v !== null && typeof v === 'object' ? v : { value: v, label: String(v) }
        ),
      ])
  );
  const empty =
    intent.validation.length === 0 &&
    intent.behavior.length === 0 &&
    Object.keys(dataSources).length === 0;
  if (empty) return null;
  return {
    mode: 'merge',
    ...(intent.validation.length > 0 ? { validation: intent.validation } : {}),
    ...(intent.behavior.length > 0
      ? {
          behavior: intent.behavior.map((b) => ({
            kind: b.kind,
            target: b.target,
            sources: b.sources,
            ...(b.expr === undefined ? {} : { expr: b.expr }),
            ...(b.each === undefined ? {} : { each: b.each }),
          })),
        }
      : {}),
    ...(Object.keys(dataSources).length > 0 ? { dataSources } : {}),
  };
}

/**
 * Предупреждения MCP, которые относятся к печати модуля, а не к документу билдера. Тип поля
 * документу не нужен — значение задаёт компонент; замечание «тип не указан» на каждое поле модель
 * принимала за сбой и шла проверять сборку (замер 2026-11-03, сценарий 3.6).
 */
const MODULE_ONLY_WARNING =
  /itemInterfaceName|initialValue|interfaceName|Ключи приведены|пришёл строкой|ни одного поля|тип не указан/;

/** Ответ модели: что собрано, адреса шагов, что не взято, замечания и напоминание о задании. */
function reply(intent: FormIntent, warnings: readonly string[], state: PlaceState): string {
  const rows = intent.arrays.reduce((sum, a) => sum + a.itemFields.length, 0);
  const counts = [
    state.steps.length > 0 ? `${state.steps.length} steps` : '',
    `${intent.fields.length + rows} fields`,
    intent.arrays.length > 0 ? `${intent.arrays.length} arrays` : '',
  ].filter(Boolean);
  const rules = state.rules;
  const lines = [
    `Built ${counts.join(', ')}. Rules now: validation ${rules.validation.length}, behavior ` +
      `${rules.behavior.length}, render ${rules.render.length}.`,
  ];
  if (state.blocks.length > 0) {
    const blocks = state.blocks
      .slice(0, MAX_NOTES)
      .map((b) => `${b.component}${b.title === '' ? '' : ` "${b.title}"`} ${b.ref}`);
    lines.push(`Placed: ${blocks.join('; ')}.`);
  }
  if (state.steps.length > 0) {
    lines.push(`Steps: ${state.steps.map((s) => `"${s.title}" ${s.ref}`).join('; ')}.`);
  }
  const lost = notKept(intent);
  if (lost.length > 0) lines.push(`Not kept: ${lost.join('; ')}.`);
  const notes = warnings.filter((w) => !MODULE_ONLY_WARNING.test(w)).slice(0, MAX_NOTES);
  if (notes.length > 0) lines.push(`Notes:\n${notes.map((n) => `- ${n}`).join('\n')}`);
  lines.push(
    'The build checks the intent, not the task: compare it with the request — every field, ' +
      'step, rule and dependency — before you finish.'
  );
  const text = lines.join('\n');
  return text.length <= TOOL_TEXT_BUDGET ? text : `${text.slice(0, TOOL_TEXT_BUDGET - 1)}…`;
}

/** Что из intent документу билдера положить некуда — называется, а не теряется молча. */
function notKept(intent: FormIntent): string[] {
  const out: string[] = [];
  const initial = intent.fields
    .filter((f) => f.initialValue !== undefined && f.initialValue !== '' && f.initialValue !== null)
    .map((f) => f.name);
  if (initial.length > 0) {
    out.push(`initial values of ${initial.join(', ')} — the start value follows the component`);
  }
  const rows = intent.arrays.filter((a) => a.initialValue.length > 0).map((a) => a.name);
  if (rows.length > 0) out.push(`starting rows of ${rows.join(', ')}`);
  const options = intent.behavior.filter((b) => b.options !== undefined).map((b) => b.target);
  if (options.length > 0) out.push(`options of the behaviour on ${options.join(', ')}`);
  return out;
}
