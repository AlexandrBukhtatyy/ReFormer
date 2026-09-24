/**
 * Раскладка модуля: простая форма или визард, и если визард — его шаги.
 *
 * ## Вид формы решает СХЕМА, а не кит
 *
 * Раньше «это визард» отвечали четыре места (шим, событие отправки, пошаговая валидация,
 * render-обвязка), и пошаговая валидация зависела от того, есть ли у кита адаптер визарда: без
 * адаптера форма с шагами печаталась как простая. Раскладка модуля — свойство формы, поэтому
 * здесь один ответ из одного признака: в схеме есть узел с шагами. Кит решает только, печатать ли
 * `wizard.tsx`.
 *
 * ## Имя папки шага
 *
 * `kebab(заголовка)`: «Контакты» → `kontakty`. Номера в имени нет намеренно — порядок шагов задаёт
 * `steps/index.ts`, поэтому перестановка шагов не переименовывает папки и не бросает ручные правки
 * в старых. Заголовок-оператор (`$i18n(...)`) или пустой — селектор шага без `-section`, иначе
 * `step-<N>`. Совпадения разводятся суффиксом: `kontakty`, `kontakty-2`.
 *
 * @module @reformer/builder-stack-reformer/codegen/steps
 */

import {
  isArrayNode,
  isContainerNode,
  isFieldNode,
  parseOperator,
  type JsonFormSchema,
  type JsonNode,
} from '@reformer/renderer-json';
import { kebab } from '@reformer/builder-toolkit';
import { isNodeLike } from '../form-model/node-kind';
import { wizardStepsOf, type Collected } from './collect';
import { STEP_FILES, stepFilePath } from './layout';
import type { SelectorInfo } from './selectors';

/** Шаг визарда глазами раскладки. */
export interface StepInfo {
  /** Номер шага, с единицы. */
  readonly index: number;
  /** Имя папки шага (`kontakty`). */
  readonly dir: string;
  /** Путь папки шага от корня модуля (`steps/kontakty`). */
  readonly path: string;
  /** Заголовок шага как в схеме (для комментариев), либо `Шаг N`. */
  readonly title: string;
  /** Селектор узла шага (после `assignSelectors`). */
  readonly selector: string | null;
  /** `$nodeId` узла шага — задел для переноса папки при переименовании шага. */
  readonly nodeId: string | null;
  /** Обязательные поля шага — пути `$model`. */
  readonly required: readonly string[];
  /** Все пути `$model` полей и массивов шага — по ним правила валидации делятся по шагам. */
  readonly fields: readonly string[];
  /** Все селекторы поддерева шага, включая сам шаг, — по ним делятся render-правила. */
  readonly selectors: readonly string[];
  /** Секции шага (кандидаты на `hideWhen`), включая сам шаг. */
  readonly sections: readonly { readonly selector: string; readonly label: string }[];
  /** Имя шага в агрегаторе: `step1`, `step2`, … */
  readonly alias: string;
  /** Пути файлов шага от корня модуля. */
  readonly files: { readonly validation: string; readonly render: string };
}

export interface ModuleLayout {
  readonly kind: 'simple' | 'wizard';
  /** Шаги визарда по порядку; пусто у простой формы. */
  readonly steps: readonly StepInfo[];
}

/** Предел длины имени папки шага. */
const DIR_LIMIT = 32;

/**
 * Заголовок-оператор (`$i18n(...)`, `$model(...)`) словами не является.
 *
 * По форме `$имя(...)`, а не `parseOperator`: тот знает только операторы рендерера, а заголовок
 * бывает и под оператором приложения (`$i18n`) — из него вышло бы имя папки `i18nstepscontacts`.
 */
function isOperator(value: string): boolean {
  return /^\$[A-Za-z_]\w*\(.*\)$/s.test(value.trim());
}

/** Обрезать kebab-имя по границе слова. */
function clip(slug: string): string {
  if (slug.length <= DIR_LIMIT) return slug;
  const cut = slug.slice(0, DIR_LIMIT);
  const dash = cut.lastIndexOf('-');
  return (dash > 0 ? cut.slice(0, dash) : cut).replace(/-+$/, '');
}

/**
 * Имя папки шага БЕЗ учёта соседей: по заголовку, иначе по селектору, иначе по номеру.
 *
 * Разведение совпадений — забота {@link layoutOf}: оно зависит от всех шагов сразу.
 */
export function stepDirName(index: number, title: unknown, selector: string | null): string {
  if (typeof title === 'string' && title.trim() !== '' && !isOperator(title)) {
    const slug = clip(kebab(title));
    if (slug !== '') return slug;
  }
  if (selector !== null) {
    const slug = clip(kebab(selector.replace(/-section$/, '')));
    if (slug !== '') return slug;
  }
  return `step-${index}`;
}

/** Собрать пути `$model` и селекторы поддерева шага одним обходом. */
function scan(step: JsonNode): { fields: string[]; selectors: string[] } {
  const fields: string[] = [];
  const selectors: string[] = [];
  const visit = (node: JsonNode): void => {
    const selector = (node as { selector?: unknown }).selector;
    if (typeof selector === 'string' && selector !== '') selectors.push(selector);
    if (isArrayNode(node)) {
      const parsed = parseOperator(node.array);
      if (parsed?.op === 'model') fields.push(parsed.arg);
      return;
    }
    if (isFieldNode(node)) {
      const parsed = parseOperator(node.value);
      if (parsed?.op === 'model') fields.push(parsed.arg);
      return;
    }
    if (isContainerNode(node)) {
      node.children?.forEach((child) => {
        if (isNodeLike(child)) visit(child);
      });
      const steps = node.componentProps?.steps;
      if (Array.isArray(steps)) {
        steps.forEach((nested) => {
          if (isNodeLike(nested)) visit(nested);
        });
      }
    }
  };
  visit(step);
  return { fields: [...new Set(fields)], selectors: [...new Set(selectors)] };
}

/**
 * Раскладка модуля по схеме С ПРОСТАВЛЕННЫМИ селекторами.
 *
 * Селекторы нужны уже проставленные: имя папки шага, у которого нет заголовка, берётся из его
 * селектора, и оно обязано совпадать с тем, что уйдёт в `form.schema.json`.
 */
export function layoutOf(
  schema: JsonFormSchema,
  collected: Collected,
  selectors: SelectorInfo
): ModuleLayout {
  const nodes = isNodeLike(schema.root) ? wizardStepsOf(schema.root) : [];
  if (nodes.length === 0) return { kind: 'simple', steps: [] };

  const taken = new Set<string>();
  const steps = nodes.map((node, i): StepInfo => {
    const index = i + 1;
    const raw = node as {
      selector?: unknown;
      $nodeId?: unknown;
      componentProps?: { title?: unknown };
    };
    const selector = typeof raw.selector === 'string' && raw.selector !== '' ? raw.selector : null;
    const title = raw.componentProps?.title;

    const base = stepDirName(index, title, selector);
    let dir = base;
    let n = 2;
    while (taken.has(dir)) {
      dir = `${base}-${n}`;
      n += 1;
    }
    taken.add(dir);

    const { fields, selectors: subtree } = scan(node);
    const own = new Set(subtree);
    return {
      index,
      dir,
      path: stepFilePath(dir, '').replace(/\/$/, ''),
      title:
        typeof title === 'string' && title !== '' && !isOperator(title) ? title : `Шаг ${index}`,
      selector,
      nodeId: typeof raw.$nodeId === 'string' ? raw.$nodeId : null,
      required: [...new Set(collected.steps[i]?.required ?? [])],
      fields,
      selectors: subtree,
      sections: selectors.sections.filter((section) => own.has(section.selector)),
      alias: `step${index}`,
      files: {
        validation: stepFilePath(dir, STEP_FILES.validation),
        render: stepFilePath(dir, STEP_FILES.render),
      },
    };
  });
  return { kind: 'wizard', steps };
}
