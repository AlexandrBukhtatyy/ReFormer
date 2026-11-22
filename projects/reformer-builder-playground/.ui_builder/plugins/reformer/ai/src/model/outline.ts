/**
 * Дайджест схемы — то, как агент «видит» форму.
 *
 * Полный `JsonFormSchema` модели не отдаётся: реальные формы занимают тысячи строк, `componentProps`
 * почти целиком шум для структурных решений, а вложенные деревья (шаги визарда, шаблоны массивов)
 * ломают наивную оценку размера. Дайджест даёт по строке на узел — адрес, компонент, модель,
 * подпись — а полный узел запрашивается точечно (`get_form_node`).
 *
 * Обход идёт через `childSlots` (`@/plugins/reformer/core/form-model`) — единственное место, знающее про неоднородную
 * вложенность (`children` — у визарда это слот шагов, — `item.$template`, `wrapper`), поэтому
 * дайджест не хардкодит правила размещения повторно.
 *
 * Подформа (`{ model, part }`) и массив с `item: "$part(имя)"` в дереве корня — листья с пометкой
 * `part=имя`: их разметка лежит в `parts` документа, вне дерева корня. Она идёт после дерева
 * корня, по части на блок, с адресами `/parts/<имя>/…` — теми же JSON Pointer, которыми её правят
 * write-инструменты. Без этого содержимое части было бы недостижимо: ни прочесть, ни поправить.
 *
 * @module plugins/reformer/ai/model/outline
 */

import type { JsonFormSchema, JsonNode } from '@reformer/renderer-json';
import {
  childSlots,
  documentParts,
  isNodeLike,
  kindOf,
  PARTS_KEY,
  partRefOf,
  type ChildSlotKind,
  type NodeKind,
} from '../../../core/form-model';
import { type FormRules, type JsonPath } from '../../../core/form-model';
import { componentOf, labelOf, modelOf, nodeRef } from './node-ref';
import { joinWithinBudget } from '@reformer/builder-toolkit';

/** Одна строка дайджеста. */
export interface OutlineEntry {
  /** JSON Pointer — адрес, которым узел адресуют write-инструменты. */
  ref: string;
  /** Глубина от корня (для отступа). */
  depth: number;
  kind: NodeKind;
  /** Каталожное имя компонента. */
  component?: string;
  /** Путь модели без обёртки оператора. */
  model?: string;
  /** `label` поля либо `title` шага. */
  label?: string;
  /** Слот РОДИТЕЛЯ, в котором лежит узел; у корня отсутствует. */
  slot?: ChildSlotKind;
  /**
   * Обязательное поле: `componentProps.required === true` или правило `required` без условия;
   * `'conditional'` — правило `required` с условием `when`.
   */
  required?: true | 'conditional';
  /** Имя части, разметку которой узел подключает (`$part(имя)` подформы или шаблона строки). */
  part?: string;
  /** У корня разметки части — её имя: с этой строки начинается блок части. */
  partDef?: string;
}

/** Обязательность полей по правилам: полный путь модели → безусловно или с условием. */
type RequiredByRules = ReadonlyMap<string, true | 'conditional'>;

/**
 * Какие поля обязательны по правилам формы. Безусловное правило сильнее условного: поле, у
 * которого есть оба, обязательно всегда.
 */
function requiredByRules(rules: FormRules | undefined): RequiredByRules {
  const out = new Map<string, true | 'conditional'>();
  for (const rule of rules?.validation ?? []) {
    if (!rule.rules.some((check) => /^\s*required\b/.test(check))) continue;
    if (rule.when === undefined) out.set(rule.target, true);
    else if (!out.has(rule.target)) out.set(rule.target, 'conditional');
  }
  return out;
}

/**
 * Построить дайджест схемы (pre-order, начиная с корневого узла `['root']`).
 * Схема без узла-корня даёт пустой список, а не бросает: гейт качества — не здесь.
 *
 * @param rules - Правила формы: по ним поле помечается обязательным, как и по свойству
 *   `required`. Без этого обязательность жила в двух местах — в свойстве (видно в карте) и в
 *   правилах (видно в отдельном блоке затравки), — и модель на «какие поля обязательны» читала
 *   каждый узел, проверяя свойство (замер на живой модели, сценарий 17.1: 11 вызовов).
 */
export function buildOutline(schema: JsonFormSchema, rules?: FormRules): OutlineEntry[] {
  const out: OutlineEntry[] = [];
  const root = (schema as { root?: unknown }).root;
  if (!isNodeLike(root)) return out;
  const required = requiredByRules(rules);
  visit(root, ['root'], 0, undefined, out, { required, scope: '' });
  // Поля части пишут пути от группы подключения, а подключений бывает несколько: обязательность по
  // правилам к разметке части не приложить — у неё нет одного полного пути.
  for (const [name, markup] of documentParts(schema)) {
    const start = out.length;
    visit(markup, [PARTS_KEY, name], 0, undefined, out, { required: new Map(), scope: '' });
    const head = out[start];
    if (head !== undefined) out[start] = { ...head, partDef: name };
  }
  return out;
}

/** Что обход несёт вниз: обязательность по правилам и путь модели строки массива. */
interface VisitScope {
  readonly required: RequiredByRules;
  /** Полный путь массива, внутри строки которого идёт обход; `''` — вне строк. */
  readonly scope: string;
}

function visit(
  node: JsonNode,
  path: JsonPath,
  depth: number,
  slot: ChildSlotKind | undefined,
  out: OutlineEntry[],
  context: VisitScope
): void {
  const props = (node as { componentProps?: Record<string, unknown> }).componentProps;
  const component = componentOf(node);
  const model = modelOf(node);
  const label = labelOf(node);
  const part = partRefOf(node);
  // Поле строки пишет путь от строки, правило строки — полный путь: сверяются полные.
  const full =
    model === undefined ? undefined : context.scope ? `${context.scope}.${model}` : model;
  const required =
    props?.required === true ? true : full === undefined ? undefined : context.required.get(full);
  out.push({
    ref: nodeRef(path),
    depth,
    kind: kindOf(node),
    ...(component ? { component } : {}),
    ...(model ? { model } : {}),
    ...(label ? { label } : {}),
    ...(slot ? { slot } : {}),
    ...(required !== undefined ? { required } : {}),
    ...(part !== undefined ? { part } : {}),
  });
  for (const s of childSlots(node, path)) {
    const inner =
      s.kind === 'template' && full !== undefined ? { ...context, scope: full } : context;
    for (const entry of s.entries) {
      const childPath = s.single ? s.path : [...s.path, entry.index];
      visit(entry.node, childPath, depth + 1, s.kind, out, inner);
    }
  }
}

/** Одна строка дайджеста в текст. */
function renderEntry(e: OutlineEntry): string {
  const parts = [e.component ?? `(${e.kind})`];
  if (e.model) parts.push(`model=${e.model}`);
  if (e.label) parts.push(`«${e.label}»`);
  if (e.required === true) parts.push('required');
  if (e.required === 'conditional') parts.push('required (conditional)');
  if (e.part) parts.push(`part=${e.part}`);
  const head = e.partDef ? `part «${e.partDef}»: ` : '';
  return `${'  '.repeat(e.depth)}${head}${e.ref} · ${parts.join(' · ')}`;
}

/**
 * Дайджест в текст для модели. При превышении бюджета обрезается ОСОЗНАННО — с хвостовой строкой
 * о числе пропущенных узлов, чтобы модель знала о неполноте и дозапросила нужное через
 * `get_form_node`, а не считала обрезанное дерево полным.
 *
 * Первым жертвуется СОДЕРЖИМОЕ, а не структура. Обрезка по порядку строк оставляла поля первого
 * шага и отбрасывала сами шаги — модель, которую попросили дописать поля во второй и третий шаг,
 * не находила их адресов, не могла подтвердить, что они существуют, и тратила весь ход на
 * сомнения. Без структуры карта бесполезна, без отдельных полей — всего лишь неполна, и недостающее
 * добирается точечным `get_form_node`.
 *
 * @param entries - Результат {@link buildOutline}.
 * @param budget - Бюджет в символах.
 */
export function renderOutline(entries: readonly OutlineEntry[], budget: number): string {
  if (!entries.length) return 'The form is empty: no nodes.';
  const full = entries.map(renderEntry);
  if (full.join('\n').length <= budget) return full.join('\n');
  return joinWithinBudget(
    [],
    collapseFields(entries),
    budget,
    (shown, total) =>
      `… ${total - shown} more line(s) — call get_form_node for the address you need`
  );
}

/**
 * Свернуть подряд идущие поля в одну строку-счётчик, сохранив всю структуру.
 *
 * Поля сворачиваются группами по родителю — ровно так они и лежат в дайджесте, друг за другом
 * после своего контейнера. Массивы (`kind: 'array'`) остаются: у них внутри шаблон, то есть они
 * такая же структура, как контейнер. Подформы (`kind: 'part'`) остаются тоже: за одной такой
 * строкой стоит целая группа полей, и счётчик «N полей» о ней бы соврал.
 */
function collapseFields(entries: readonly OutlineEntry[]): string[] {
  const out: string[] = [];
  let held: OutlineEntry[] = [];

  const flush = () => {
    if (!held.length) return;
    const indent = '  '.repeat(held[0].depth);
    out.push(`${indent}… ${held.length} field(s) here — get_form_node for their addresses`);
    held = [];
  };

  for (const entry of entries) {
    if (entry.kind === 'field') {
      held.push(entry);
      continue;
    }
    flush();
    out.push(renderEntry(entry));
  }
  flush();
  return out;
}
