/**
 * Аннотация схемы для runtime-превью: копия дерева, где каждому узлу в `componentProps.className`
 * дописан класс-токен его пути ({@link encodeNodeToken}). Токен доезжает до DOM (рендерер отдаёт
 * `className` корню компонента, блоку поля или html-тегу), давая превью недостающую связь
 * «DOM-элемент → узел схемы»: по ней работают выделение, хит-тест и drag-drop.
 *
 * ⚠️ Результат ЭФЕМЕРЕН: живёт только внутри `RuntimePreview`, не сохраняется и не экспортируется.
 * Исходная схема не мутируется — `tab.schema` остаётся чистой (инвариант закреплён тестом).
 *
 * @module reformer-builder/preview-runtime/annotate-schema
 */

import {
  isArrayNode,
  isContainerNode,
  isFieldNode,
  type JsonArrayNode,
  type JsonContainerNode,
  type JsonFieldNode,
  type JsonFormSchema,
  type JsonNode,
} from '@reformer/renderer-json';
import { isNodeLike, type JsonPath } from '../model';
import { encodeNodeToken, EMPTY_CLASS } from './node-token';

/**
 * Дефолт `className` array-узла без собственного компонента: у `ModelArraySectionRenderer`
 * (и ui-kit `FormArray`/`FormArraySection`) это ДЕФОЛТ ПАРАМЕТРА, а не merge — передав только токен,
 * мы бы отняли у списка отступы. Поэтому подставляем дефолт явно.
 */
const ARRAY_DEFAULT_CLASS = 'space-y-3 mt-2';

type Props = Record<string, unknown>;

/** `componentProps` узла с дописанным токеном (и, для пустого контейнера, служебным классом). */
function propsWithToken(
  props: Props | undefined,
  path: JsonPath,
  extra: { arrayDefault?: boolean; empty?: boolean } = {}
): Props {
  const base = typeof props?.className === 'string' ? props.className : '';
  const fallback = extra.arrayDefault && !base ? ARRAY_DEFAULT_CLASS : '';
  const className = [base, fallback, encodeNodeToken(path), extra.empty ? EMPTY_CLASS : '']
    .filter(Boolean)
    .join(' ');
  return { ...props, className };
}

/** Аннотировать узел и всех его детей (пути — те же, что строит `childSlots`). */
function annotateNode(node: JsonNode, path: JsonPath): JsonNode {
  if (isArrayNode(node)) {
    const arr = node as JsonArrayNode;
    return {
      ...arr,
      componentProps: propsWithToken(arr.componentProps, path, { arrayDefault: !arr.component }),
      item: { $template: annotateNode(arr.item.$template, [...path, 'item', '$template']) },
    } as JsonNode;
  }

  if (isFieldNode(node)) {
    const field = node as JsonFieldNode;
    const next: JsonFieldNode = {
      ...field,
      componentProps: propsWithToken(field.componentProps, path),
    };
    if (field.wrapper) next.wrapper = annotateNode(field.wrapper, [...path, 'wrapper']);
    return next as JsonNode;
  }

  if (isContainerNode(node)) {
    const c = node as JsonContainerNode;
    const steps = c.componentProps?.steps;
    const hasSteps = Array.isArray(steps) && steps.some(isNodeLike);
    // «Пустой» = нечего рисовать: ни детей, ни шагов, ни текста (такой узел схлопывается в 0px).
    const childCount = (Array.isArray(c.children) ? c.children.length : 0) + (hasSteps ? 1 : 0);
    const empty = childCount === 0 && c.text == null;
    const next = {
      ...c,
      componentProps: propsWithToken(c.componentProps, path, { empty }),
    } as JsonContainerNode;

    if (hasSteps) {
      const stepsPath = [...path, 'componentProps', 'steps'];
      next.componentProps = {
        ...next.componentProps,
        steps: (steps as unknown[]).map((s, i) =>
          isNodeLike(s) ? annotateNode(s, [...stepsPath, i]) : s
        ),
      };
    }
    if (Array.isArray(c.children)) {
      next.children = c.children.map((child, i) => annotateNode(child, [...path, 'children', i]));
    }
    return next as JsonNode;
  }

  return node;
}

/** Копия схемы с класс-токенами путей у каждого узла. Исходная схема не изменяется. */
export function annotateSchema(schema: JsonFormSchema): JsonFormSchema {
  return { ...schema, root: annotateNode(schema.root, ['root']) };
}
