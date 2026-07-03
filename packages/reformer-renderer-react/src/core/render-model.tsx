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
import {
  createForm,
  getNodeForSignal,
  useFormControl,
  type FieldNode,
  type FormSchemaNode,
} from '@reformer/core';

/* eslint-disable @typescript-eslint/no-explicit-any */

/** Узел-поле единой схемы: значение — сигнал модели. */
export interface ModelFieldNode extends FormSchemaNode {
  value: Signal<any>;
  /** UI-компонент поля (в рендере обязателен, в отличие от базового {@link FormSchemaNode}). */
  component: ComponentType<any>;
}

/** Узел-контейнер: React-компонент + дочерние узлы. */
export interface ModelContainerNode extends FormSchemaNode {
  /** React-компонент контейнера (в рендере обязателен). */
  component: ComponentType<any>;
  children?: ModelNode[];
}

/**
 * Узел дерева единой схемы (M1) для {@link RenderModelNode}: либо лист-поле
 * {@link ModelFieldNode} (несёт `value: Signal` модели), либо контейнер
 * {@link ModelContainerNode} (React-компонент + `children`). Дискриминируется
 * по наличию `value instanceof Signal`.
 */
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
 * Рекурсивный рендер узла единой схемы {@link ModelNode}: field-узел → контрол (разворот
 * сигнала, `value`/`onChange`, state по сигналу через реестр), container-узел → React-компонент
 * с дочерними узлами. `node == null` → рендерит `null`.
 *
 * @param props - `{ node }` — узел {@link ModelNode} или `null`/`undefined`
 * @returns Отрендеренное поддерево или `null`
 *
 * @example Дерево «контейнер + поле»
 * ```tsx
 * const node: ModelNode = {
 *   component: Box,
 *   children: [{ value: model.$.email, component: Input }],
 * };
 * <RenderModelNode node={node} />
 * ```
 *
 * @group Renderer
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

/** Props для {@link RenderModelArray}: реактивный массив модели + схема элемента и оформление. */
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

/**
 * Рендер массива единой схемы (M1): элементы принадлежат модели (`control`), поддерево
 * каждого элемента строит `itemComponent` по под-модели и рендерит {@link RenderModelNode}
 * (поля привязываются к сигналам под-модели). Длина реактивна — `push`/`removeAt` по модели
 * перерисовывают список. При заданном `newItem` рендерится кнопка «Добавить».
 *
 * Низкоуровневый рендерер: для полноценной секции массива (карточки, удаление, reorder,
 * `fieldWrapper`) используйте `ArrayRenderNode` (`{ array, item }`) внутри
 * {@link RenderNodeComponent}/{@link FormRenderer}.
 *
 * @param props - {@link RenderModelArrayProps}
 * @returns Обёртка со списком элементов и опц. кнопкой добавления
 *
 * @example Массив под-моделей
 * ```tsx
 * <RenderModelArray
 *   control={model.coBorrowers}
 *   itemComponent={(im) => ({
 *     component: Box,
 *     children: [{ value: im.$.phone, component: Input }],
 *   })}
 *   newItem={createBlankCoBorrower}
 *   addButtonLabel="Добавить созаёмщика"
 * />
 * ```
 *
 * @group Renderer
 */
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
