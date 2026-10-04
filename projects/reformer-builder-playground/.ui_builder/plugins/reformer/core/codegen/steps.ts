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
 * `kebab(заголовка)` — правило в `form-model/step-dir`: его же спрашивает разбиение схемы по шагам.
 *
 * @module plugins/reformer/core/codegen/steps
 */

import {
  isArrayNode,
  isContainerNode,
  isFieldNode,
  parseOperator,
  type JsonFormSchema,
  type JsonNode,
} from '@reformer/renderer-json';
import { isNodeLike } from '../form-model/node-kind';
import { firstWizardStepRefs, stepDirOfRef, type SplitFormSchema } from '../form-model/composite';
import { isOperatorText, stepDirName, uniqueStepDir } from '../form-model/step-dir';
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
  /**
   * Спецификатор файла схемы шага из `$ref` корня — у шага, вынесенного в свой файл; иначе `null`.
   */
  readonly schemaRef: string | null;
  /**
   * Пути файлов шага от корня модуля. `schema` — только у вынесенного шага, лежащего по канону
   * `steps/<dir>/form.schema.json`; файл в другом месте кодоген не печатает — он остаётся, где был.
   */
  readonly files: {
    readonly validation: string;
    readonly render: string;
    readonly schema: string | null;
  };
}

export interface ModuleLayout {
  readonly kind: 'simple' | 'wizard';
  /** Шаги визарда по порядку; пусто у простой формы. */
  readonly steps: readonly StepInfo[];
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
 *
 * У шага, вынесенного в файл, папка — та, где лежит его схема (`composition`), а не слаг
 * заголовка: переименование шага не разводит код шага и его схему по разным папкам. Такие папки
 * занимаются первыми, остальные разводятся с ними.
 */
export function layoutOf(
  schema: JsonFormSchema,
  collected: Collected,
  selectors: SelectorInfo,
  composition: SplitFormSchema | null = null
): ModuleLayout {
  const nodes = isNodeLike(schema.root) ? wizardStepsOf(schema.root) : [];
  if (nodes.length === 0) return { kind: 'simple', steps: [] };

  const refs = composition === null ? [] : firstWizardStepRefs(composition.skeleton);
  const refDirs = refs.map((ref) => (ref === null ? null : stepDirOfRef(ref)));
  const taken = new Set<string>(refDirs.filter((dir): dir is string => dir !== null));
  const steps = nodes.map((node, i): StepInfo => {
    const index = i + 1;
    const raw = node as {
      selector?: unknown;
      $nodeId?: unknown;
      componentProps?: { title?: unknown };
    };
    const selector = typeof raw.selector === 'string' && raw.selector !== '' ? raw.selector : null;
    const title = raw.componentProps?.title;

    const refDir = refDirs[i] ?? null;
    const dir = refDir ?? uniqueStepDir(stepDirName(index, title, selector), taken);

    const { fields, selectors: subtree } = scan(node);
    const own = new Set(subtree);
    return {
      index,
      dir,
      path: stepFilePath(dir, '').replace(/\/$/, ''),
      title:
        typeof title === 'string' && title !== '' && !isOperatorText(title)
          ? title
          : `Шаг ${index}`,
      selector,
      nodeId: typeof raw.$nodeId === 'string' ? raw.$nodeId : null,
      required: [...new Set(collected.steps[i]?.required ?? [])],
      fields,
      selectors: subtree,
      sections: selectors.sections.filter((section) => own.has(section.selector)),
      alias: `step${index}`,
      schemaRef: refs[i] ?? null,
      files: {
        validation: stepFilePath(dir, STEP_FILES.validation),
        render: stepFilePath(dir, STEP_FILES.render),
        schema: refDir === null ? null : stepFilePath(dir, STEP_FILES.schema),
      },
    };
  });
  return { kind: 'wizard', steps };
}
