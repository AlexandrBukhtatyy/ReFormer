/**
 * Фабрики узлов по умолчанию (для дропа из палитры). Реконструируются из `role`+`name` — так
 * каталог-JSON остаётся чисто декларативным (без функций), а билдер восстанавливает `makeNode`
 * (спека §5).
 *
 * @module reformer-builder/catalog/make-node
 */

import type { JsonNode } from '@reformer/renderer-json';
import type { CatalogRole } from './types';
import { htmlTagSpec } from './html-tags';
import { LEAF_COMPONENT_NAMES } from '../model/node-kind';

export function fieldNode(name: string): JsonNode {
  return {
    value: '$model(newField)',
    component: `$component(${name})`,
    componentProps: { label: name },
  };
}

export function containerNode(name: string): JsonNode {
  return {
    component: `$component(${name})`,
    componentProps: { className: 'space-y-4' },
    children: [],
  };
}

/** Листовой компонент (Icon/Separator/…): самодостаточный визуал, без `children`. */
export function leafComponentNode(name: string): JsonNode {
  return {
    component: `$component(${name})`,
    componentProps: {},
  };
}

export function htmlNodeFor(name: string): JsonNode {
  const tag = name.slice('$html('.length, -1); // '$html(div)' → 'div'
  const component = `$html(${tag})` as `$html(${string})`;
  const spec = htmlTagSpec(tag);
  // Неизвестный тег трактуем как контейнер (безопасный дефолт — можно вкладывать детей).
  if (!spec || spec.content === 'container') {
    const componentProps = spec?.defaultClass ? { className: spec.defaultClass } : {};
    return { component, componentProps, children: [] };
  }
  if (spec.content === 'void') return { component, componentProps: {} };
  return { component, text: spec.defaultText ?? 'Текст' };
}

export function arrayNode(): JsonNode {
  return {
    array: '$model(items)',
    item: {
      $template: {
        component: '$component(Box)',
        componentProps: { className: 'space-y-3' },
        children: [],
      },
    },
    componentProps: { addButtonLabel: '+ Добавить элемент' },
  };
}

/** Шаг визарда: контейнер `$component(Step)` с подписью и телом (`children`). */
export function stepNode(title = 'Шаг'): JsonNode {
  return {
    component: '$component(Step)',
    componentProps: { title },
    children: [],
  };
}

/**
 * Визард: шаги живут в `componentProps.steps` (НЕ в `children` — иначе drop/insert уходили бы в
 * `children`, а не в слот `steps`). Сеем один шаг, чтобы слот `steps` сразу был активен
 * (`childSlots` показывает его только при непустом `steps`, см. `node-kind`).
 */
export function wizardNode(): JsonNode {
  return {
    component: '$component(Wizard)',
    componentProps: { steps: [stepNode('Шаг 1')] },
  };
}

/** Узел по умолчанию для записи каталога (по `role`/`name`). */
export function makeNodeFor(name: string, role: CatalogRole): JsonNode {
  if (role === 'array') return arrayNode();
  if (name.startsWith('$html(')) return htmlNodeFor(name);
  if (role === 'field') return fieldNode(name);
  if (name === 'Wizard') return wizardNode();
  if (name === 'Step') return stepNode();
  if (LEAF_COMPONENT_NAMES.has(name)) return leafComponentNode(name);
  return containerNode(name);
}
