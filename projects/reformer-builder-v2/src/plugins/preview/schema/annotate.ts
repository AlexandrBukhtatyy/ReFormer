/**
 * Аннотация схемы для превью: копия дерева, где каждому узлу в `componentProps.className`
 * дописан класс-токен его `$nodeId`.
 *
 * Токен доезжает до DOM (рендерер отдаёт `className` корню компонента, блоку поля или
 * html-тегу), давая превью недостающую связь «элемент DOM → узел схемы». По ней и работают
 * выбор кликом и подсветка выделенного.
 *
 * ## Результат ЭФЕМЕРЕН
 *
 * Живёт внутри одной сборки превью, не сохраняется и никуда не экспортируется. Исходная схема
 * не мутируется — это инвариант, закреплённый тестом: аннотированная копия, случайно уехавшая
 * в документ, добавила бы в файл пользователя классы, которых он не писал.
 *
 * ## Узел без `$nodeId` не аннотируется
 *
 * Не «аннотируется путём». Токен без адреса не на что отобразить обратно, а дописанный
 * в `className` мусор доехал бы до DOM. Такой узел просто не выбирается кликом — см.
 * {@link './node-token'}.
 *
 * @module plugins/preview/schema/annotate
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
import { nodeIdOf } from '@/lib/form-model/node-id';
import { isNodeLike } from '@/lib/form-model/node-kind';
import { EMPTY_CLASS, encodeNodeToken } from './node-token';

/**
 * Дефолт `className` array-узла без собственного компонента.
 *
 * У `ModelArraySectionRenderer` (и у `FormArray`/`FormArraySection` кита) это ДЕФОЛТ ПАРАМЕТРА,
 * а не слияние: передав только токен, мы отняли бы у списка отступы. Поэтому дефолт
 * подставляется явно. Значение перенесено из v1 дословно — оно принадлежит рендереру,
 * а не превью.
 */
const ARRAY_DEFAULT_CLASS = 'space-y-3 mt-2';

type Props = Record<string, unknown>;

/** `componentProps` узла с дописанным токеном (и служебным классом у пустого контейнера). */
function propsWithToken(
  props: Props | undefined,
  node: JsonNode,
  extra: { arrayDefault?: boolean; empty?: boolean } = {}
): Props | undefined {
  const id = nodeIdOf(node);
  const base = typeof props?.className === 'string' ? props.className : '';
  const fallback = extra.arrayDefault === true && base === '' ? ARRAY_DEFAULT_CLASS : '';
  const token = id === undefined ? '' : encodeNodeToken(id);
  const className = [base, fallback, token, extra.empty === true ? EMPTY_CLASS : '']
    .filter((part) => part !== '')
    .join(' ');
  // Пустой результат означает, что дописывать было нечего: не заводим `componentProps` там,
  // где их не было, — лишний пустой объект уехал бы в реестр и в сравнение пропсов.
  if (className === '') return props;
  return { ...props, className };
}

/** Аннотировать узел и всех его детей. */
function annotateNode(node: JsonNode): JsonNode {
  if (isArrayNode(node)) {
    const array = node as JsonArrayNode;
    return {
      ...array,
      componentProps: propsWithToken(array.componentProps, node, {
        arrayDefault: array.component === undefined,
      }),
      item: { $template: annotateNode(array.item.$template) },
    } as JsonNode;
  }

  if (isFieldNode(node)) {
    const field = node as JsonFieldNode;
    const next: JsonFieldNode = {
      ...field,
      componentProps: propsWithToken(field.componentProps, node),
    };
    if (field.wrapper) next.wrapper = annotateNode(field.wrapper);
    return next as JsonNode;
  }

  if (isContainerNode(node)) {
    const container = node as JsonContainerNode;
    const steps = container.componentProps?.steps;
    const hasSteps = Array.isArray(steps) && steps.some(isNodeLike);
    // «Пустой» — значит нечего рисовать: ни детей (узлов или текста), ни шагов. Такой узел
    // схлопывается в ноль пикселей и становится недостижим курсором.
    const childCount =
      (Array.isArray(container.children) ? container.children.length : 0) + (hasSteps ? 1 : 0);
    const next = {
      ...container,
      componentProps: propsWithToken(container.componentProps, node, { empty: childCount === 0 }),
    } as JsonContainerNode;

    if (hasSteps) {
      next.componentProps = {
        ...next.componentProps,
        steps: (steps as unknown[]).map((step) =>
          isNodeLike(step) ? annotateNode(step as JsonNode) : step
        ),
      };
    }
    if (Array.isArray(container.children)) {
      // Текстовые части аннотировать нечем: у них нет `componentProps` под токен.
      next.children = container.children.map((child) =>
        isNodeLike(child) ? annotateNode(child as JsonNode) : child
      );
    }
    return next as JsonNode;
  }

  return node;
}

/** Копия схемы с класс-токенами узлов. Исходная схема не изменяется. */
export function annotateSchema(schema: JsonFormSchema): JsonFormSchema {
  return { ...schema, root: annotateNode(schema.root) };
}
