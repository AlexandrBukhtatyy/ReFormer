/**
 * `build_form` — форма, шаг или блок одним intent: поля, раскладка и правила вместе.
 *
 * Тот же приём, что у `form_build` в MCP (план mcp-misty-graham): модель описывает форму ОДНИМ
 * декларативным объектом, детерминированная сборка превращает его в документ, а модели возвращается
 * только диагностика. Без него форма собиралась десятками вызовов `insert_node` и `set_form_rules`,
 * и большую спеку не довёл до конца ни один режим ассистента.
 *
 * ## Один язык с MCP
 *
 * Intent судит судья сервиса ReFormer (`judge_intent`, `../../service/compiler`) — тот же вердикт,
 * что у `form_build` и `validate_form` MCP: чтение с незнакомыми ключами и подъёмом записей,
 * кросс-проверка, неразмещённое, компоненты и свойства кита и то, чего документ не держит (код
 * модуля — отказ, начальные значения — заметка). Документ раскладки intent считает он же. Без
 * сервиса `build_form` в наборе нет (`../index`).
 *
 * ## Один отказ со всеми пунктами
 *
 * Всё, что проверяется до первой вставки, проверяется до неё и сразу целиком: вердикт судьи, размер
 * визарда, родитель и занятые поля, подформы, отказы правил (`planRules` — те же, что у
 * `set_form_rules`). Отказ один, до {@link MAX_FINDINGS} пунктов, у каждого код, место и починка:
 * раньше отказы шли по одному, и модель чинила intent по кругу (аудит 2026-11, D5).
 *
 * Сборка — последовательность уже существующих инструментов над одним черновиком: узлы ставит
 * `insert_node` (фабрика каталога и гейт схемы — его), правила — `set_form_rules`, видимость и
 * события узлов — `set_render_rules`. Отказ любого шага отменяет всё: черновик хода не меняется,
 * пока не собрано целое.
 *
 * Правило, чей путь не нашёл поля (`./rule-paths`), не отказ: оно откладывается, а сборка ложится —
 * поля и раскладка дороже связи, и отказ целиком из-за неё оставлял человека без формы
 * (ReFormer-t4fr). Ответ перечисляет отложенные правила с починкой.
 *
 * @module plugins/reformer/ai/tools/build-form
 */

import { collectSteps, modelPaths, type FormIntent } from '@reformer/form-intent';
import type { JsonFormSchema } from '@reformer/renderer-json';
import {
  collectModelPaths,
  emptyRules,
  setTextChild,
  type FormRules,
} from '../../../../core/form-model';
import { wizardNames } from '../../model/catalog-digest';
import { isResolved, resolveRef } from '../../model/node-ref';
import { buildOutline } from '../../model/outline';
import { insertSlotOf } from '../../model/slots';
import {
  fail,
  ok,
  type AgentTool,
  type ChangeOp,
  type ToolContext,
  type ToolOutcome,
} from '../../model/types';
import { INSERT_MAX_NODES, insertNodeTool } from '../insert-node';
import { REF_PROP } from '../params';
import { planRules, setFormRulesTool, type Params as RuleParams } from '../set-form-rules';
import { setRenderRulesTool } from '../set-render-rules';
import type { FormCompiler, JudgeFinding } from '../../service/compiler';
import { buildFormGrammar, WIZARD_MAX_FIELDS, WIZARD_MAX_STEPS } from './grammar';
import { planOf, type PlanNode } from './plan';
import { checkRulePaths, droppedRulesText, hasRuleParams } from './rule-paths';

interface Params {
  intent?: unknown;
  parent?: string;
  index?: number;
}

/** Бюджет ответа: грамматика длиннее сводки правки, а без неё первый вызов бесполезен. */
export const BUILD_FORM_TEXT_BUDGET = 4000;

/** Сколько пунктов назвать в отказе: модель чинит их за один заход, но не два десятка сразу. */
const MAX_FINDINGS = 12;

/** Сколько замечаний сборки показать. */
const MAX_NOTES = 8;

/** Пункт отказа: код, место, что не так и что сделать — как строка находки `form_build`. */
export interface BuildFinding {
  readonly code: string;
  readonly at?: string;
  readonly message: string;
  readonly hint?: string;
}

/**
 * Пути правил судья сверяет с моделью intent, а сборка — с черновиком, где стоят и прежние поля:
 * в шаг правило законно называет поле, собранное раньше. Их сверяет `./rule-paths`.
 */
const RULE_PATH_CODES: ReadonlySet<string> = new Set(['C4', 'C5']);

/** `build_form` над компилятором сервиса. */
export function createBuildFormTool(compiler: FormCompiler): AgentTool<Params> {
  return {
    name: 'build_form',
    description:
      'Build a whole form, a wizard step or a block from ONE intent: fields, layout and rules ' +
      'together. Call without intent to get its grammar. Point edits: the other tools.',
    inputSchema: {
      type: 'object',
      properties: {
        // Строкой — тоже: модель шлёт intent JSON-строкой, и проверка аргументов отклоняла вызов до
        // чтения, которое строку разбирает (замер 2026-11-03, сценарий 21.4: два отказа подряд).
        intent: {
          type: ['object', 'string'],
          description: 'The form as one intent; omit to get the grammar',
        },
        parent: { ...REF_PROP, description: 'Step or section to add to; omit for an empty form' },
        index: { type: 'integer', minimum: 0 },
      },
      additionalProperties: false,
    },
    readOnly: false,
    textBudget: BUILD_FORM_TEXT_BUDGET,

    async run(params, ctx): Promise<ToolOutcome> {
      const signal = ctx.turn?.signal;
      if (params.intent === undefined || params.intent === null) {
        const grammar = await compiler.grammar(ctx.catalog, signal);
        return grammar.ok
          ? ok(buildFormGrammar(ctx.catalog, grammar.value.grammar))
          : fail('UNAVAILABLE', grammar.message);
      }

      // Документ, а не модуль: заметок о печати модуля (интерфейсы, типы значений) судья не пишет —
      // модель принимала их за сбой (замер 2026-11-03, сценарий 3.6). Справочники — каталог кита.
      const judged = await compiler.judge(params.intent, ctx.catalog, signal);
      if (!judged.ok) return fail('UNAVAILABLE', judged.message);
      const verdict = judged.value;
      if (verdict.unread) {
        return refusal(
          'The intent was not read',
          verdict.errors,
          'Call build_form without intent for the grammar.'
        );
      }
      const intent = verdict.intent;

      // Без родителя — форма целиком: только пока она была пустой на начало хода. Повторный вызов
      // собирает её заново от базы: правка intent и пересборка, как у `form_build`.
      const rebuild = params.parent === undefined;
      const start = rebuild
        ? { draft: ctx.base, rules: emptyRules() }
        : { draft: ctx.draft, rules: ctx.rules };
      const findings: BuildFinding[] = verdict.errors.filter(
        (error) => !RULE_PATH_CODES.has(error.code) && !declaredBefore(error, start.rules)
      );
      // Свойство вне строгой схемы кита: модулю — предупреждение (уйдёт в DOM), документу — отказ:
      // гейт правки сверяет узел со схемой кита и такую вставку не пропустит. Сказать об этом до
      // вставки — значит назвать все такие места разом, со списком того, что у компонента есть.
      for (const warning of verdict.warnings) {
        if (warning.code !== 'component-props') continue;
        findings.push({
          code: warning.code,
          message: warning.message,
          hint: 'the kit schema of the component is closed: use the props it has',
        });
      }

      const steps = collectSteps(intent.layoutRoot).length;
      if (intent.fields.length + intent.arrays.length === 0 && steps === 0) {
        findings.push({ code: 'empty-intent', message: emptyIntentMessage(params.intent) });
      }
      const large = wizardTooLarge(intent, steps);
      if (large !== null) findings.push(large);

      if (rebuild && buildOutline(ctx.base).length > 1) {
        // Пункт называет оба выхода. Прежний текст называл один — «передай parent», — и модель,
        // которую просили о новой форме, послушно искала родителя в старой (ReFormer-9a9c).
        findings.push({
          code: 'form-not-empty',
          message: 'the form already has content',
          hint:
            'a new form the user asked for: call create_form; to add to this form: pass parent — ' +
            'the step or section',
        });
      }
      const parentRef = params.parent ?? '/root';
      const parent = resolveRef(start.draft, parentRef);
      const slot = isResolved(parent) ? insertSlotOf(parent.node, parent.path) : null;
      if (!isResolved(parent)) {
        findings.push({ code: 'parent', at: parentRef, message: parent.text });
      } else if (slot === null) {
        findings.push({
          code: 'parent',
          at: parentRef,
          message: 'the node does not hold children',
          hint: 'pick a step or section',
        });
      }
      if (!rebuild) {
        const taken = new Set(collectModelPaths(start.draft));
        const clash = [...modelPaths(intent)].filter((path) => taken.has(path));
        if (clash.length > 0) {
          findings.push({
            code: 'already-in-form',
            at: clash.slice(0, 8).join(', '),
            message: 'already in the form',
            hint: 'build_form adds new fields; change existing ones with set_node_prop',
          });
        }
      }

      const layout = planOf(verdict.document, ctx.catalog);
      const plan = 'error' in layout ? null : layout;
      if ('error' in layout) findings.push({ code: 'parts-unsupported', message: layout.error });

      // Пути правил — с полями черновика и intent: ровно то, что увидит `set_form_rules` после
      // вставки. Правило без поля откладывается, а не отменяет сборку (ReFormer-t4fr).
      const known = [...new Set([...collectModelPaths(start.draft), ...modelPaths(intent)])];
      const samples = sampleNamesOf(verdict.sampleNames);
      const ruleParams = ruleParamsOf(intent);
      let paths: { readonly notes: readonly string[]; readonly dropped: readonly string[] } = {
        notes: [],
        dropped: [],
      };
      let rules: RuleParams | null = null;
      if (ruleParams !== null) {
        const checked = checkRulePaths(ruleParams, known, {
          isSample: (name) => samples.has(name.toLowerCase()),
        });
        paths = checked;
        if (hasRuleParams(checked.params)) {
          rules = checked.params;
          const planned = planRules(rules, { rules: start.rules, known, lock: ctx.rulesLock });
          findings.push(
            ...planned.refusals.map((refused) => ({
              code: refused.kind,
              at: refused.at,
              message: refused.message,
              ...(refused.similar !== undefined && refused.similar.length > 0
                ? { hint: `did you mean ${refused.similar.join(', ')}?` }
                : {}),
            }))
          );
        }
      }

      if (findings.length > 0 || plan === null || slot === null) {
        const deferred = paths.dropped.length > 0 ? droppedRulesText(paths.dropped) : undefined;
        return refusal('The intent was not built', findings, deferred);
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
      const top = asStepIfWizard(topNodes(plan, slot.kind, state), slot.kind, state, params.intent);
      const placed = await place(state, parentRef, top, params.index, true);
      if (placed !== null) return placed;

      if (rules !== null) {
        const out = await setFormRulesTool.run(rules, at(state));
        if (!out.ok || out.rules === undefined) return located('Rules', out);
        state.rules = out.rules;
      }
      const render = renderRulesOf(intent, state);
      if ('missing' in render) {
        return fail(
          'INVALID_PARAMS',
          `Render rules name no built node: ${render.missing.join(', ')}. Nothing was changed.`
        );
      }
      if (render.rules.length > 0) {
        const out = await setRenderRulesTool.run({ mode: 'merge', rules: render.rules }, at(state));
        if (!out.ok) return located('Render rules', out);
        state.draft = out.schema ?? state.draft;
        state.rules = out.rules ?? state.rules;
      }

      return {
        ...ok(reply(intent, verdict.warnings, state, paths, samples)),
        schema: state.draft,
        rules: state.rules,
        ops: [...state.ops, { kind: 'update', ref: '/rules', summary: 'правила формы' }],
      };
    },
  };
}

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

/** Строка пункта отказа: `- <код> at <место>: <что не так> → <что сделать>`. */
const findingLine = (finding: BuildFinding): string =>
  `- ${finding.code}${finding.at === undefined ? '' : ` at ${finding.at}`}: ${finding.message}` +
  (finding.hint === undefined ? '' : ` → ${finding.hint}`);

/** Один отказ со всеми пунктами; черновик хода не тронут. */
function refusal(head: string, findings: readonly BuildFinding[], tail?: string): ToolOutcome {
  const lines = findings.slice(0, MAX_FINDINGS).map(findingLine);
  if (findings.length > MAX_FINDINGS) lines.push(`… and ${findings.length - MAX_FINDINGS} more.`);
  const count = `${findings.length} problem${findings.length === 1 ? '' : 's'}`;
  const text = [`${head}, nothing changed — ${count}:`, ...lines, ...(tail ? [tail] : [])].join(
    '\n'
  );
  return fail('INVALID_PARAMS', clip(text));
}

const clip = (text: string): string =>
  text.length <= BUILD_FORM_TEXT_BUDGET ? text : `${text.slice(0, BUILD_FORM_TEXT_BUDGET - 1)}…`;

/** Отказ вложенного шага сборки — с тем, на чём он случился; черновик хода не тронут. */
function located(what: string, outcome: ToolOutcome): ToolOutcome {
  return { ...outcome, text: `${what}: ${outcome.text} Nothing was changed.` };
}

/**
 * C3 о справочнике, который форма уже знает из прежних правил. При сборке по шагам поле шага
 * законно ссылается на справочник, заданный раньше: судья видит только этот intent.
 */
function declaredBefore(error: JudgeFinding, rules: FormRules): boolean {
  if (error.code !== 'C3' || rules.dataSources === undefined) return false;
  const name = /\$dataSource\(([^)]+)\)/.exec(error.message)?.[1];
  return name !== undefined && Object.hasOwn(rules.dataSources, name);
}

/**
 * Визард крупнее {@link WIZARD_MAX_STEPS} шагов или {@link WIZARD_MAX_FIELDS} полей — по шагам. Одни
 * шаги без полей (первый вызов такой сборки) проходят при любом их числе.
 */
function wizardTooLarge(intent: FormIntent, steps: number): BuildFinding | null {
  const size =
    intent.fields.length + intent.arrays.reduce((sum, a) => sum + 1 + a.itemFields.length, 0);
  if (steps < 2 || size === 0 || (steps <= WIZARD_MAX_STEPS && size <= WIZARD_MAX_FIELDS)) {
    return null;
  }
  const titles = collectSteps(intent.layoutRoot).map((step) => ({ title: step.title }));
  return {
    code: 'wizard-too-large',
    message:
      `a wizard of ${steps} steps and ${size} fields is built step by step (one intent holds up ` +
      `to ${WIZARD_MAX_STEPS} steps and ${WIZARD_MAX_FIELDS} fields)`,
    hint:
      `first call — only the steps: ${JSON.stringify({ steps: titles })}; then one build_form ` +
      "per step: parent = the step address from the reply, intent = that step's fields, arrays " +
      'and rules',
  };
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

/**
 * Поля без шага в визард — один шаг с ними. В визарде лежат только шаги, а модель, добавляя шаг,
 * пишет intent самим шагом: `{ "title": "Доставка", "fields": [ … ] }` с `parent` = визард. Отказ
 * `insert_node` стоил ей ещё двух вызовов (замер 2026-11-03, сценарий B.2). Заголовок — из
 * `title` intent, без него — «Step».
 */
function asStepIfWizard(
  nodes: readonly PlanNode[],
  slotKind: string,
  state: PlaceState,
  raw: unknown
): readonly PlanNode[] {
  if (slotKind !== 'steps' || state.step === undefined) return nodes;
  if (nodes.length === 0 || nodes.some((node) => node.component === state.step)) return nodes;
  const source = typeof raw === 'string' ? safeParse(raw) : raw;
  const title =
    source !== null && typeof source === 'object' && 'title' in source
      ? String((source as { title: unknown }).title)
      : 'Step';
  return [{ component: state.step, props: { title }, children: nodes, rows: [] }];
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
      writeText(state, node, ref);
      if (top && node.model === undefined && node.component !== state.step) {
        const title = node.props?.title ?? node.props?.label;
        state.blocks.push({ component: node.component, title: String(title ?? ''), ref });
      }
      const kids = node.children.slice(0, CHILDREN_PER_CALL);
      for (const kid of kids) {
        const kidRef = refs[next++];
        record(state, kid, kidRef);
        writeText(state, kid, kidRef);
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

/**
 * Текст узла — после вставки, той же правкой, что `set_node_prop(key: 'text')`: содержимое по
 * умолчанию («Кнопка» у `Button`) заменяется, у пустого контейнера текст встаёт первым ребёнком.
 */
function writeText(state: PlaceState, node: PlanNode, ref: string): void {
  if (node.text === undefined) return;
  const found = resolveRef(state.draft, ref);
  if (!isResolved(found)) return;
  state.draft = setTextChild(state.draft, found.path, node.text).schema;
}

function record(state: PlaceState, node: PlanNode, ref: string): void {
  if (node.selector !== undefined) state.refs.set(node.selector, ref);
  if (node.component === state.step) {
    state.steps.push({ title: String(node.props?.title ?? ''), ref });
  }
}

function safeParse(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

/**
 * Пункт пустого intent — с тем, что пришло, и записью, которую ждёт сборка.
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
    'the intent has no fields, arrays or steps' +
    (keys.length > 0 ? ` (top-level keys received: ${keys.slice(0, 10).join(', ')})` : '') +
    '. Declare each field once in "fields": [{ "name", "component", "label" }] and place it by ' +
    'name in "steps": [{ "title", "fields": ["name"] }] or "layoutRoot"'
  );
}

/**
 * Аргументы `set_form_rules` из intent; `null` — правил нет. Записи с `call` документ не держит:
 * их называет вердикт судьи (`not-in-document`), а правилам они дали бы эхо «правило ничего не
 * проверяет».
 */
function ruleParamsOf(intent: FormIntent): RuleParams | null {
  const validation = intent.validation.filter((rule) => rule.call === undefined);
  const behavior = intent.behavior.filter((link) => link.kind !== 'call');
  // Справочник без значений документ не держит — о нём заметка судьи (`not-kept`).
  const dataSources = Object.fromEntries(
    intent.dataSources
      .filter((d) => Array.isArray(d.values) && d.values.length > 0)
      .map((d) => [
        d.name,
        (d.values ?? []).map((v) =>
          v !== null && typeof v === 'object' ? v : { value: v, label: String(v) }
        ),
      ])
  );
  const empty =
    validation.length === 0 && behavior.length === 0 && Object.keys(dataSources).length === 0;
  if (empty) return null;
  return {
    mode: 'merge',
    ...(validation.length > 0 ? { validation } : {}),
    ...(behavior.length > 0
      ? {
          behavior: behavior.map((b) => ({
            kind: b.kind,
            target: b.target,
            sources: b.sources,
            ...(b.expr === undefined ? {} : { expr: b.expr }),
            ...(b.each === undefined ? {} : { each: b.each }),
            // Условие пересчёта и опции печатает генерация и читает обратно читатель кода: раньше
            // условный пересчёт становился безусловным (аудит 2026-11, D4).
            ...(b.when === undefined ? {} : { when: b.when }),
            ...(b.options === undefined ? {} : { options: b.options }),
          })),
        }
      : {}),
    ...(Object.keys(dataSources).length > 0 ? { dataSources } : {}),
  };
}

/** Правило вызова `set_render_rules`. */
type RenderParam = NonNullable<Parameters<typeof setRenderRulesTool.run>[0]['rules']>[number];

/**
 * Render-правила из intent: видимость — `hideWhen`, событие компонента — `onEvent` (ReFormer-o8rm).
 * Хуки узлов, которым в документе нет места, до сюда не доходят: их отказ — вердикт судьи.
 */
function renderRulesOf(
  intent: FormIntent,
  state: PlaceState
): { readonly rules: RenderParam[] } | { readonly missing: string[] } {
  const wanted: Array<{ readonly selector: string; readonly rule: Omit<RenderParam, 'ref'> }> = [
    ...intent.visibility.map((v) => ({
      selector: v.selector,
      rule: { kind: 'hideWhen', condition: v.condition },
    })),
    ...(intent.nodes ?? [])
      .filter((node) => node.kind === 'onComponentEvent' && node.selector !== undefined)
      .map((node) => ({
        selector: node.selector as string,
        // `async` по `await` в теле ставит сам `set_render_rules`.
        rule: { kind: 'onEvent', event: node.event ?? '', body: node.expr },
      })),
  ];
  const missing = [
    ...new Set(wanted.filter((w) => !state.refs.has(w.selector)).map((w) => w.selector)),
  ];
  if (missing.length > 0) return { missing };
  return {
    rules: wanted.map((w) => ({ ref: state.refs.get(w.selector) as string, ...w.rule })),
  };
}

/** Заметка судьи строкой: место — если текст его ещё не называет. */
const noteText = (note: JudgeFinding): string =>
  note.at === undefined || note.message.includes(note.at)
    ? note.message
    : `${note.at}: ${note.message}`;

/**
 * Ответ модели: что собрано, адреса шагов, что не сохранено, замечания и напоминание о задании.
 *
 * @param paths - Пути правил, которые сборка починила сама, и отложенные правила (`./rule-paths`).
 *   Отложенные идут сразу за сводкой: при обрезке ответа по бюджету теряться им нельзя.
 */
function reply(
  intent: FormIntent,
  warnings: readonly JudgeFinding[],
  state: PlaceState,
  paths: { readonly notes: readonly string[]; readonly dropped: readonly string[] },
  samples: ReadonlySet<string>
): string {
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
  if (paths.dropped.length > 0) lines.push(droppedRulesText(paths.dropped));
  if (state.blocks.length > 0) {
    const blocks = state.blocks
      .slice(0, MAX_NOTES)
      .map((b) => `${b.component}${b.title === '' ? '' : ` "${b.title}"`} ${b.ref}`);
    lines.push(`Placed: ${blocks.join('; ')}.`);
  }
  if (state.steps.length > 0) {
    lines.push(`Steps: ${state.steps.map((s) => `"${s.title}" ${s.ref}`).join('; ')}.`);
  }
  // Что форма не сохранит, называется отдельной строкой: это не замечание о записи, а потеря.
  const lost = warnings.filter((w) => w.code === 'not-kept').map((w) => w.message);
  if (lost.length > 0) lines.push(`Not kept: ${lost.join('; ')}.`);
  const sample = sampleFields(intent, samples);
  if (sample.length > 0) {
    lines.push(
      `Fields ${sample.join(', ')} match the grammar example; keep them only if the user asked ` +
        'for them.'
    );
  }
  const notes = [
    ...paths.notes,
    ...warnings.filter((w) => w.code !== 'not-kept').map(noteText),
  ].slice(0, MAX_NOTES);
  if (notes.length > 0) lines.push(`Notes:\n${notes.map((n) => `- ${n}`).join('\n')}`);
  lines.push(
    'The build checks the intent, not the task: compare it with the request — every field, ' +
      'step, rule and dependency — before you finish.'
  );
  return clip(lines.join('\n'));
}

/** Имена полей и массивов образца грамматики (последний сегмент), в нижнем регистре. */
function sampleNamesOf(names: readonly string[]): ReadonlySet<string> {
  return new Set(names.map((name) => (name.split('.').at(-1) ?? name).toLowerCase()));
}

/** С какого числа совпадений с образцом intent похож на его копию, а не на совпадение имён. */
const SAMPLE_MATCH_MIN = 3;

/**
 * Поля intent с именами образца грамматики — если их не меньше {@link SAMPLE_MATCH_MIN}. Образец
 * идёт в затравке каждой пустой формы, и небольшая модель переносит его поля в форму о другом
 * (ReFormer-9a9c). Отказывать нельзя: форма заказа законно содержит price и total. Поэтому
 * сборка только называет совпадения, а решает модель — по запросу.
 */
function sampleFields(intent: FormIntent, samples: ReadonlySet<string>): string[] {
  const names = [...intent.fields, ...intent.arrays].map((f) => f.name.split('.').at(-1) ?? f.name);
  const matched = [...new Set(names.filter((name) => samples.has(name.toLowerCase())))];
  return matched.length >= SAMPLE_MATCH_MIN ? matched : [];
}
