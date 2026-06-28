/**
 * Рендерер единой схемы (M1, Ф6).
 *
 * Под архитектурой M1 схема — дерево узлов, где field-узел несёт `value: Signal` (сигнал
 * {@link FormModel}) + `component` + `componentProps`, а container-узел — React-компонент + `children`.
 * Значение разворачивается на границе ноды: `value` берётся из сигнала, `onChange` пишет его;
 * state (errors/disabled) — из FieldNode, найденной по сигналу через реестр `getNodeForSignal`.
 * Существующие UI-kit контролы НЕ меняются — получают плоский `value` + `onChange`.
 *
 * @module reformer/renderer-react/render-model
 */

import {
  memo,
  useMemo,
  useSyncExternalStore,
  type ReactNode,
  type ComponentType,
  type ElementType,
} from 'react';
import { Signal, effect } from '@preact/signals-core';
import { createForm, getNodeForSignal, useFormControl, type FieldNode } from '@reformer/core';

/* eslint-disable @typescript-eslint/no-explicit-any */

/** Узел-поле единой схемы: значение — сигнал модели. */
export interface ModelFieldNode {
  value: Signal<any>;
  component: ComponentType<any>;
  componentProps?: Record<string, unknown>;
  selector?: string;
  testId?: string;
}

/** Узел-контейнер: React-компонент + дочерние узлы. */
export interface ModelContainerNode {
  component: ComponentType<any>;
  componentProps?: Record<string, unknown>;
  children?: ModelNode[];
  selector?: string;
}

export type ModelNode = ModelFieldNode | ModelContainerNode;

const isFieldNode = (node: ModelNode): node is ModelFieldNode =>
  (node as ModelFieldNode).value instanceof Signal;

/** Field, у которого есть state-нода (errors/disabled/validation) из реестра. */
const ModelFieldWithNode = memo(function ModelFieldWithNode({
  node,
  fieldNode,
}: {
  node: ModelFieldNode;
  fieldNode: FieldNode<unknown>;
}): ReactNode {
  const state = useFormControl(fieldNode as FieldNode<any>);
  const Component = node.component;
  const inputProps: Record<string, unknown> = {
    value: state.value,
    disabled: state.disabled,
    ...node.componentProps,
  };
  if (node.testId && inputProps['data-testid'] === undefined) {
    inputProps['data-testid'] = `input-${node.testId}`;
  }
  return (
    <Component
      {...inputProps}
      onChange={(v: unknown) => fieldNode.setValue(v as never)}
      onBlur={() => fieldNode.markAsTouched()}
    />
  );
});

/** Field без state-ноды (например, элемент массива до построения формы) — прямая привязка к сигналу. */
const ModelFieldDirect = memo(function ModelFieldDirect({
  node,
}: {
  node: ModelFieldNode;
}): ReactNode {
  const Component = node.component;
  const valueSignal = node.value; // локальная ссылка на сигнал (не мутируем через проп)
  const inputProps: Record<string, unknown> = { value: valueSignal.value, ...node.componentProps };
  if (node.testId && inputProps['data-testid'] === undefined) {
    inputProps['data-testid'] = `input-${node.testId}`;
  }
  return (
    <Component
      {...inputProps}
      onChange={(v: unknown) => {
        // Сигнал по природе мутабелен (.value = x) — правило immutability здесь неприменимо.
        // eslint-disable-next-line react-hooks/immutability
        valueSignal.value = v;
      }}
    />
  );
});

const ModelField = memo(function ModelField({ node }: { node: ModelFieldNode }): ReactNode {
  // Резолвим ноду по сигналу (для state). Выбор компонента до хуков → консистентные хуки в каждом.
  const fieldNode = getNodeForSignal(node.value) as FieldNode<unknown> | undefined;
  return fieldNode ? (
    <ModelFieldWithNode node={node} fieldNode={fieldNode} />
  ) : (
    <ModelFieldDirect node={node} />
  );
});

/**
 * Рекурсивный рендер узла единой схемы: field → контрол (разворот сигнала), container → компонент
 * с дочерними узлами.
 *
 * @group Renderer
 * @example
 * ```tsx
 * <RenderModelNode node={schema} />
 * ```
 */
export const RenderModelNode = memo(function RenderModelNode({
  node,
}: {
  node: ModelNode | null | undefined;
}): ReactNode {
  if (node == null) return null;
  if (isFieldNode(node)) return <ModelField node={node} />;
  const Component = node.component;
  return (
    <Component {...(node.componentProps || {})}>
      {node.children?.map((child, i) => (
        <RenderModelNode key={i} node={child} />
      ))}
    </Component>
  );
});

/**
 * Реактивная подписка на длину массива модели (для ре-рендера при push/removeAt).
 * SSR-безопасна (getServerSnapshot = текущая длина).
 */
function useModelArrayLength(control: { length: number }): number {
  return useSyncExternalStore(
    (cb) =>
      effect(() => {
        void control.length; // зависимость от length-сигнала модели
        cb();
      }),
    () => control.length,
    () => control.length
  );
}

/** Реактивный массив модели (минимальный контракт, используемый рендерером). */
export interface ModelArrayControl {
  length: number;
  at(index: number): unknown;
  push(item: unknown): void;
  removeAt(index: number): void;
}

export interface RenderModelArrayProps {
  /** Массив модели (`model.coBorrowers`). */
  control: ModelArrayControl;
  /** Схема элемента: под-модель элемента → узел поддерева. */
  itemComponent: (item: unknown) => ModelNode;
  /** Обёртка элементов (по умолчанию 'div'). */
  wrapper?: ElementType;
  className?: string;
  /** Значение/фабрика для кнопки «Добавить» (если задано — рендерится кнопка). */
  newItem?: unknown | (() => unknown);
  addButtonLabel?: string;
}

/**
 * Рендер массива под M1: элементы принадлежат модели, поддерево элемента строится `itemComponent`
 * по под-модели и рендерится {@link RenderModelNode} (поля привязываются к сигналам под-модели).
 * Длина реактивна — push/removeAt по модели перерисовывают список.
 *
 * @group Renderer
 */
// Стабильный React-ключ по идентичности под-модели элемента (фасад кэшируется в core).
const itemKeys = new WeakMap<object, number>();
let keyCounter = 0;
function stableKey(item: unknown): number {
  if (item == null || typeof item !== 'object') return keyCounter++;
  let k = itemKeys.get(item as object);
  if (k === undefined) {
    k = keyCounter++;
    itemKeys.set(item as object, k);
  }
  return k;
}

/**
 * Элемент массива: строит per-item форму ОДИН раз (регистрирует сигналы→ноды в реестре, чтобы
 * поля элемента получили валидацию/состояние), затем рендерит поддерево. `item` стабилен
 * (кэш фасадов в core) → useMemo не пересоздаёт форму при ре-рендерах/reorder.
 */
const ArrayItem = memo(function ArrayItem({
  item,
  itemComponent,
}: {
  item: unknown;
  itemComponent: (item: unknown) => ModelNode;
}): ReactNode {
  const node = useMemo(() => {
    const schema = itemComponent(item);

    createForm({ model: item as any, schema });
    return schema;
  }, [item, itemComponent]);
  return <RenderModelNode node={node} />;
});

export const RenderModelArray = memo(function RenderModelArray({
  control,
  itemComponent,
  wrapper: Wrapper = 'div',
  className,
  newItem,
  addButtonLabel,
}: RenderModelArrayProps): ReactNode {
  const length = useModelArrayLength(control);
  return (
    <Wrapper className={className}>
      {Array.from({ length }, (_, i) => {
        const item = control.at(i);
        return <ArrayItem key={stableKey(item)} item={item} itemComponent={itemComponent} />;
      })}
      {newItem !== undefined && (
        <button
          type="button"
          onClick={() =>
            control.push(typeof newItem === 'function' ? (newItem as () => unknown)() : newItem)
          }
        >
          {addButtonLabel ?? 'Add'}
        </button>
      )}
    </Wrapper>
  );
});

/* eslint-enable @typescript-eslint/no-explicit-any */
