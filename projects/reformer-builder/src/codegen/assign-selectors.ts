/**
 * Трансформация КОПИИ схемы перед эмиссией: проставить стабильные `selector`-ы секциям
 * (`Section`/титульные контейнеры) и `FormArray`-узлам, найти/вставить submit-триггер. Живой таб не
 * мутируется. Эти `selector`-ы попадают в `schema.ts`, а `renderer.behavior.ts` цепляется к ним
 * по-настоящему (submit, `hideWhen`). Пользовательские selector-ы сохраняются (дедуп поверх них).
 *
 * @module reformer-builder/codegen/assign-selectors
 */

import {
  isArrayNode,
  isContainerNode,
  parseOperator,
  type JsonFormSchema,
} from '@reformer/renderer-json';
import { isNodeLike, walkNodes } from '../model';
import { kebab } from './naming';

/** Узел в «сыром» виде — читаем/пишем динамические ключи схемы. */
interface AnyNode {
  component?: string;
  selector?: string;
  componentProps?: Record<string, unknown>;
  children?: unknown[];
  array?: string;
}

export interface SelectorInfo {
  /** Секции с условной видимостью (кандидаты на `hideWhen`). */
  sections: { selector: string; label: string }[];
  /** FormArray-узлы. */
  arrays: { selector: string; path: string }[];
  /** Узел-цель submit (`onComponentEvent(node, 'onClick'|'onSubmit')`). */
  submitSelector: string;
  /** Был ли вставлен новый submit-Button (иначе найден существующий триггер). */
  injectedSubmit: boolean;
}

export interface AssignResult {
  schema: JsonFormSchema;
  info: SelectorInfo;
}

/** Проставить selector-ы + submit-триггер на копии схемы. */
export function assignSelectors(input: JsonFormSchema): AssignResult {
  const schema = structuredClone(input);
  const used = new Set<string>();
  walkNodes(schema, (n) => {
    const s = (n as unknown as AnyNode).selector;
    if (typeof s === 'string' && s) used.add(s);
  });
  const uniq = (base: string): string => {
    const root = base || 'node';
    let s = root;
    let i = 2;
    while (used.has(s)) s = `${root}-${i++}`;
    used.add(s);
    return s;
  };

  const sections: SelectorInfo['sections'] = [];
  const arrays: SelectorInfo['arrays'] = [];
  let submitSelector = '';

  walkNodes(schema, (node) => {
    const n = node as unknown as AnyNode;
    const comp = parseOperator(n.component);

    if (isContainerNode(node)) {
      const title = n.componentProps?.title;
      const isSection = comp?.op === 'component' && comp.arg === 'Section';
      if (isSection || typeof title === 'string') {
        if (!n.selector)
          n.selector = uniq(`${kebab(String(title ?? comp?.arg ?? 'section'))}-section`);
        sections.push({ selector: n.selector, label: String(title ?? n.selector) });
      }
    }

    if (isArrayNode(node)) {
      const p = parseOperator(n.array);
      const path = p?.op === 'model' ? p.arg : 'items';
      if (!n.selector) n.selector = uniq(kebab(path));
      arrays.push({ selector: n.selector, path });
    }

    if (comp?.op === 'component' && (comp.arg === 'Button' || comp.arg.includes('Wizard'))) {
      if (!n.selector) n.selector = uniq('submit');
      if (!submitSelector) submitSelector = n.selector;
    }
  });

  let injectedSubmit = false;
  if (!submitSelector) {
    const root = schema.root as unknown as AnyNode;
    if (Array.isArray(root.children)) {
      submitSelector = uniq('submit');
      root.children.push({
        component: '$component(Button)',
        selector: submitSelector,
        componentProps: { children: 'Отправить', type: 'submit' },
      });
      injectedSubmit = true;
    } else if (isNodeLike(schema.root)) {
      // корень не держит children — вешаем submit прямо на корень
      if (!root.selector) root.selector = uniq('root');
      submitSelector = root.selector;
    }
  }

  return { schema, info: { sections, arrays, submitSelector, injectedSubmit } };
}
