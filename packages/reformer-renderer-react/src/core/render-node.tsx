/**
 * RenderNodeComponent - рекурсивный рендеринг узлов RenderSchema
 *
 * @module reformer/renderer-react/render-node
 */

import { memo, useCallback, useRef, useSyncExternalStore, type ReactNode } from 'react';
import { effect, Signal } from '@reformer/core/signals';
import type { FieldNode, FormProxy } from '@reformer/core';
import { getNodeForSignal } from '@reformer/core';
import type {
  RenderNode,
  FieldWrapperProps,
  FieldAdapter,
  ModelFieldRenderNode,
  ArrayRenderNode,
  ArrayItemSlot,
  RenderModelArrayControl,
  RenderChild,
  RenderTextPart,
} from './types';
import {
  isContainerRenderNode,
  isModelFieldRenderNode,
  isArrayRenderNode,
  VOID_HTML_TAGS,
} from './utils';
import { useRenderContext } from './render-context';
import { useContext } from 'react';
import {
  useHiddenOverride,
  usePropsOverride,
  RenderSchemaOverrideContext,
} from './render-schema-proxy';
import { useCondition, useNodeLifecycle } from './render-behavior';
import { buildAdaptedFieldProps } from './field-adapter';

/**
 * Props для RenderNodeComponent
 */
interface RenderNodeComponentProps<T> {
  /** Узел для рендеринга */
  node: RenderNode<T>;
  /** Proxy формы (опционально — предоставляется wizard-компонентом через props или контекст) */
  form?: FormProxy<T>;
  /**
   * Компонент-обёртка для полей (опционально).
   * Переопределяет глобальный fieldWrapper из settings.
   * Используется в user-space компонентах (RendererFormWizard и т.д.)
   * при рендеринге дочерних узлов с нестандартным контекстом формы.
   */
  fieldWrapper?: React.ComponentType<FieldWrapperProps>;
}

// ============================================================================
// M1: единая схема — лист на сигнале модели + массив модели
// ============================================================================

/**
 * Подписка листового рендерера на `value` + `disabled` + реактивные `componentProps` поля (а не на
 * все 9 сигналов {@link useFormControl}). Обёрнутые `Component`/`FieldWrapper` получают `control` и
 * подписываются на errors/touched/pending/valid/… сами, поэтому родителю эти сигналы не нужны —
 * лишние ре-рендеры при churn'е валидации/touch устраняются, и `React.memo` пользовательских
 * компонентов поля не обесценивается.
 *
 * `componentProps` включён сюда специально: рантайм-обновления ноды (`updateComponentProps`, напр.
 * догруженные `options`) должны доезжать до контрола в ОБЕИХ ветках рендера — в т.ч. когда контрол
 * под адаптером и не получает `control` (иначе обновление молча терялось). Меняется он только по
 * явному `updateComponentProps`, поэтому churn'а не добавляет. Снапшот кэшируется по тройке
 * (value, disabled, componentProps): иначе useSyncExternalStore получал бы свежий объект каждый
 * getSnapshot и зациклился бы. SSR-safe.
 */
function useFieldRenderState(fieldNode: FieldNode<unknown>): {
  value: unknown;
  disabled: boolean;
  componentProps: Record<string, unknown>;
} {
  const cacheRef = useRef<{
    value: unknown;
    disabled: boolean;
    componentProps: Record<string, unknown>;
  }>({
    value: fieldNode.value.value,
    disabled: fieldNode.disabled.value,
    componentProps: fieldNode.componentProps.value,
  });
  const subscribe = useCallback(
    (onStoreChange: () => void) => {
      let first = true;
      return effect(() => {
        void fieldNode.value.value; // зависимость: сигнал value
        void fieldNode.disabled.value; // зависимость: сигнал disabled
        void fieldNode.componentProps.value; // зависимость: реактивные componentProps ноды
        if (first) {
          first = false;
          return;
        }
        onStoreChange();
      });
    },
    [fieldNode]
  );
  const getSnapshot = useCallback((): {
    value: unknown;
    disabled: boolean;
    componentProps: Record<string, unknown>;
  } => {
    const value = fieldNode.value.value;
    const disabled = fieldNode.disabled.value;
    const componentProps = fieldNode.componentProps.value;
    const prev = cacheRef.current;
    if (
      prev.value === value &&
      prev.disabled === disabled &&
      prev.componentProps === componentProps
    )
      return prev;
    const next = { value, disabled, componentProps };
    cacheRef.current = next;
    return next;
  }, [fieldNode]);
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}

/**
 * Поле единой схемы (M1): значение из сигнала модели; state-нода резолвится по сигналу через реестр.
 * `component`/`componentProps` берутся из схемы (как в схеме формы); `fieldWrapper` оборачивает.
 */
const ModelFieldRenderer = memo(function ModelFieldRenderer({
  node,
  fieldNode,
  fieldWrapper: FieldWrapper,
  nodeRef,
  resolveFieldAdapter,
}: {
  node: ModelFieldRenderNode;
  fieldNode: FieldNode<unknown>;
  fieldWrapper?: React.ComponentType<FieldWrapperProps>;
  /**
   * Ref из refRegistry (schema.node(selector).getRef()) — вешается на живой field-компонент,
   * чтобы render-behaviors могли достучаться до его императивного handle (FieldHandle и наследники).
   * Стабильный createRef → React.memo не тарашит. undefined, если нода без selector или ref не запрошен.
   */
  nodeRef?: React.RefObject<unknown>;
  /**
   * Резолв {@link FieldAdapter} по компоненту поля (из `settings.resolveFieldAdapter`). Если адаптер
   * найден — seam кладётся в контракт контрола (valueProp/changeProp/fromEmit/toValue), иначе
   * применяется как есть (текущее value-based поведение).
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  resolveFieldAdapter?: (component: React.ComponentType<any>) => FieldAdapter | undefined;
}): ReactNode {
  // Подписка на value+disabled+реактивные componentProps ноды (не на все 9 сигналов useFormControl).
  const { value, disabled, componentProps: nodeComponentProps } = useFieldRenderState(fieldNode);
  // Стабильные колбэки: fieldNode стабилен для данного сигнала → не пересоздаются каждый рендер,
  // поэтому React.memo на пользовательском Component держится.
  const onChange = useCallback((v: unknown) => fieldNode.setValue(v as never), [fieldNode]);
  const onBlur = useCallback(() => fieldNode.markAsTouched(), [fieldNode]);
  const Component = node.component;
  if (!Component) {
    if (typeof console !== 'undefined') {
      console.warn('[RenderSchema] Model field has no component — nothing to render.');
    }
    return null;
  }

  // Схемные пропы — дефолт; реактивные пропы ноды (updateComponentProps) — override. Так рантайм-
  // обновление (догруженные `options`, `loading`, …) доходит до контрола в ОБЕИХ ветках ниже —
  // в т.ч. когда контрол под адаптером и не получает `control` (§3.2 рекомендаций).
  const {
    className,
    wrapper: Wrapper = 'div',
    fieldWrapper: perFieldWrapper,
    testId: explicitTestId,
    ...inputComponentProps
  } = { ...node.componentProps, ...nodeComponentProps };

  // testId: явный из схемы, иначе из пути сигнала (`personalData.lastName` → `personalData-lastName`).
  const path = (node.value as { __path?: string }).__path;
  const testId =
    typeof explicitTestId === 'string'
      ? explicitTestId
      : path
        ? path.replace(/\./g, '-')
        : undefined;

  // Адаптер по компоненту поля: сырой контрол UI-kit получает seam в своём диалекте
  // (`checked`+событие, `value`+`(value, option)` и т.д.). Нет адаптера → value-based seam как есть.
  const adapter = resolveFieldAdapter?.(Component);

  // §3.1 (BREAKING): нода формы (`control`) передаётся контролу ТОЛЬКО по явному запросу — статикой
  // `Component.reformerNeedsControl === true` либо `adapter.passControl`. По умолчанию НЕ передаётся:
  // leaf-контролы UI-kit её не потребляют (иначе `control` тёк бы в DOM, и адаптеры заводились лишь
  // чтобы её вырезать), а errors/touched/label обслуживает FieldWrapper — он получает `control`
  // отдельно (ниже). Реактивные рантайм-пропы теперь мёржит сам рендерер (см. useFieldRenderState),
  // поэтому ради них `control` контролу больше не нужен.
  const needsControl =
    adapter?.passControl === true ||
    (Component as { reformerNeedsControl?: boolean }).reformerNeedsControl === true;
  const controlProp = needsControl ? { control: fieldNode } : {};

  let input: ReactNode;
  if (adapter) {
    const adaptedProps = buildAdaptedFieldProps(
      adapter,
      value,
      onChange,
      onBlur,
      inputComponentProps as Record<string, unknown>
    );
    if (testId && adaptedProps['data-testid'] === undefined) {
      adaptedProps['data-testid'] = `input-${testId}`;
    }
    input = (
      <Component
        disabled={disabled}
        {...adaptedProps}
        {...controlProp}
        {...(nodeRef !== undefined ? { ref: nodeRef } : {})}
      />
    );
  } else {
    const inputProps: Record<string, unknown> = {
      value,
      disabled,
      ...inputComponentProps,
    };
    if (testId && inputProps['data-testid'] === undefined) {
      inputProps['data-testid'] = `input-${testId}`;
    }
    input = (
      <Component
        {...controlProp}
        {...inputProps}
        {...(nodeRef !== undefined ? { ref: nodeRef } : {})}
        onChange={onChange}
        onBlur={onBlur}
      />
    );
  }

  const EffectiveWrapper = perFieldWrapper ?? FieldWrapper;
  return EffectiveWrapper ? (
    <EffectiveWrapper control={fieldNode} className={className} testId={testId}>
      {input}
    </EffectiveWrapper>
  ) : (
    <Wrapper className={className}>{input}</Wrapper>
  );
});

/**
 * Реактивная подписка на структурные изменения массива модели (push/removeAt/insert/**reorder**).
 * Возвращает ревизию-счётчик, а не длину: реордер сохраняет длину, поэтому snapshot=length НЕ менялся
 * бы и React не перерисовал список. Чтение `control.length` внутри `effect` подписывает на сигнал
 * `items` (его ссылка реассайнится при любой мутации, включая перестановку), а ревизия инкрементится
 * на каждое срабатывание — snapshot меняется → ре-рендер. SSR-safe.
 */
function useModelArrayRevision(control: RenderModelArrayControl): number {
  const revRef = useRef(0);
  // subscribe ОБЯЗАН быть стабильным: иначе React переподписывается каждый рендер, effect
  // повторно инкрементит revRef → снапшот меняется → ре-рендер → бесконечный цикл (краш).
  const subscribe = useCallback(
    (cb: () => void) =>
      effect(() => {
        void control.length; // зависимость от сигнала items (меняет identity при reorder)
        revRef.current += 1;
        cb();
      }),
    [control]
  );
  return useSyncExternalStore(
    subscribe,
    () => revRef.current,
    () => revRef.current
  );
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
 * Резолв `initialValue` элемента для кнопки «Добавить»: значение или фабрика `() => value`.
 * Экспортируется — им пользуются ui-kit-компоненты массива (`FormArray`) для `array.push(...)`.
 */
export const resolveInitialValue = (init: ArrayRenderNode<unknown>['initialValue']): unknown =>
  typeof init === 'function' ? (init as () => unknown)() : init;

/**
 * Один элемент модель-массива для компонента-рендерера: стабильный ключ, живой индекс, под-модель
 * элемента и готовое поддерево. Возвращается {@link useModelArrayItems}.
 */
export interface ModelArrayItem {
  /** Стабильный React-ключ по идентичности под-модели (stableKey). */
  key: number;
  /** Живой индекс в массиве — для `removeAt(index)`/`move(index, …)`. */
  index: number;
  /** Под-модель элемента (`control.at(index)`) — для `itemLabel(model, index)` и т.п. */
  model: unknown;
  /** Готовое поддерево элемента: `<RenderNodeComponent node={item(model)} …/>`. */
  element: ReactNode;
}

/**
 * Итерация модель-массива для компонента-рендерера: подписка на структурные изменения массива
 * (add/remove/**reorder**) + кэш поддеревьев по идентичности элемента + обёртка в
 * {@link RenderNodeComponent}. Возвращает на элемент `{ key, index, model, element }`. Единственная
 * копия итерации — на ней строятся ui-kit `List` (chrome-less) и `FormArray` (add/remove/reorder):
 * хром — их, данные (модель для label, индекс для remove) — отсюда. SSR-safe (наследует серверный
 * снапшот {@link useModelArrayRevision}). Подписка живёт в компоненте, который реально рендерит.
 */
export function useModelArrayItems(
  control: RenderModelArrayControl,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  item: (itemModel: any) => RenderNode<unknown>,
  fieldWrapper?: React.ComponentType<FieldWrapperProps>
): ReadonlyArray<ModelArrayItem> {
  useModelArrayRevision(control); // ре-рендер при структурных изменениях (включая reorder)
  const length = control.length;

  // Кэш поддеревьев по идентичности под-модели, ключ — фабрика `item` (сброс при смене схемы).
  const cacheRef = useRef<{
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    itemFn: (itemModel: any) => RenderNode<unknown>;
    map: WeakMap<object, RenderNode<unknown>>;
  } | null>(null);
  if (!cacheRef.current || cacheRef.current.itemFn !== item) {
    cacheRef.current = { itemFn: item, map: new WeakMap() };
  }
  const getSubtree = (im: unknown): RenderNode<unknown> => {
    if (im == null || typeof im !== 'object') return item(im);
    const map = cacheRef.current!.map;
    let sub = map.get(im as object);
    if (sub === undefined) {
      sub = item(im);
      map.set(im as object, sub);
    }
    return sub;
  };

  return Array.from({ length }, (_, index) => {
    const model = control.at(index);
    const key = stableKey(model);
    return {
      key,
      index,
      model,
      element: (
        <RenderNodeComponent key={key} node={getSubtree(model)} fieldWrapper={fieldWrapper} />
      ),
    };
  });
}

/** Однократное (на массив) предупреждение об узле без компонента-рендерера. */
const warnedArrays = new WeakSet<object>();
function warnArrayWithoutComponent(node: ArrayRenderNode<unknown>): void {
  if (typeof console === 'undefined') return;
  const control = node.array as unknown as object;
  if (warnedArrays.has(control)) return;
  warnedArrays.add(control);
  const path = (node.array as { __path?: string }).__path;
  console.warn(
    `[RenderSchema] Array node${path ? ` "${path}"` : ''} has no \`component\` — items are rendered ` +
      'without add/remove/reorder UI. Register an array component (e.g. `FormArray` from ' +
      '@reformer/ui-kit) and set `component` on the node.'
  );
}

/**
 * Fallback для узла-массива БЕЗ `component`: рендерит только элементы — без секции, кнопок и
 * какого-либо оформления. UI управления (добавить/удалить/переставить) — задача компонента
 * (`$component(FormArray)` из `@reformer/ui-kit` либо своего), рендерер разметку не шипает.
 */
const ModelArrayFallback = memo(function ModelArrayFallback({
  node,
  fieldWrapper,
}: {
  node: ArrayRenderNode<unknown>;
  fieldWrapper?: React.ComponentType<FieldWrapperProps>;
}): ReactNode {
  const items = useModelArrayItems(node.array, node.item, fieldWrapper);
  warnArrayWithoutComponent(node);
  return <>{items.map((it) => it.element)}</>;
});

/**
 * Массив, рендеримый ЗАРЕГИСТРИРОВАННЫМ компонентом (M1): узел `{ array, item, component }`.
 *
 * Итерацию — подписку на структуру, кэш поддеревьев, стабильные ключи — делает рендерер
 * ({@link useModelArrayItems}), а компонент получает результат обычными props:
 * {@link ArrayComponentProps} (`items` + `onAdd`/`onRemove`/`onMove`) плюс `componentProps` узла.
 * Компонент не знает ни про сигналы, ни про {@link RenderNode}, ни про хуки рендерера — поэтому
 * реализовать его может любая UI-библиотека, а протестировать можно на фейковых `items` без формы.
 */
const ModelArrayComponentRenderer = memo(function ModelArrayComponentRenderer({
  node,
  fieldWrapper,
}: {
  node: ArrayRenderNode<unknown>;
  fieldWrapper?: React.ComponentType<FieldWrapperProps>;
}): ReactNode {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const Comp = node.component as React.ComponentType<any>;
  const control = node.array;
  const items = useModelArrayItems(control, node.item, fieldWrapper);
  const { initialValue } = node;

  // Колбэки стабильны по `control`/`initialValue` — иначе memo-компоненты потребителя ломались бы
  // на каждый рендер секции.
  const onAdd = useCallback(
    () => control.push(resolveInitialValue(initialValue)),
    [control, initialValue]
  );
  const onRemove = useCallback((index: number) => control.removeAt(index), [control]);
  const onMove = useCallback((from: number, to: number) => control.move(from, to), [control]);

  const slots: ArrayItemSlot[] = items.map(({ key, index, model, element }) => ({
    key,
    index,
    model,
    children: element,
  }));

  return (
    <Comp
      items={slots}
      onAdd={onAdd}
      onRemove={onRemove}
      onMove={onMove}
      {...(node.componentProps ?? {})}
    />
  );
});

// ============================================================================
// TEXT CONTENT — статический и реактивный текст узла
// ============================================================================

/** Ребёнок-текст (литерал, число, сигнал), а не вложенный узел. */
function isTextPart(child: unknown): child is RenderTextPart {
  return typeof child === 'string' || typeof child === 'number' || child instanceof Signal;
}

/**
 * Группирует детей в чанки: подряд идущие текстовые части — в один текстовый чанк (склеиваются без
 * разделителя и подписываются одним {@link RenderTextContent}, как раньше делал массив `text`),
 * узлы — каждый своим чанком. `key` — индекс первого элемента чанка в исходном массиве.
 */
function groupChildren<T>(
  children: readonly RenderChild<T>[]
): Array<{ key: number; parts: RenderTextPart[] } | { key: number; node: RenderNode<T> }> {
  const out: Array<
    { key: number; parts: RenderTextPart[] } | { key: number; node: RenderNode<T> }
  > = [];
  let text: { key: number; parts: RenderTextPart[] } | null = null;
  children.forEach((child, i) => {
    if (isTextPart(child)) {
      if (!text) {
        text = { key: i, parts: [] };
        out.push(text);
      }
      text.parts.push(child);
      return;
    }
    text = null;
    out.push({ key: i, node: child });
  });
  return out;
}

/**
 * Только узлы — для компонентов с `__selfManagedChildren` (wizard, секция массива): они обходят
 * детей сами и ждут {@link RenderNode}. Текст в таком слоте — ошибка автора схемы, поэтому в dev
 * о нём предупреждаем, а не роняем рендер.
 */
function nodesOnly<T>(children: readonly RenderChild<T>[]): RenderNode<T>[] {
  const out: RenderNode<T>[] = [];
  let dropped = 0;
  for (const child of children) {
    if (isTextPart(child)) dropped += 1;
    else out.push(child);
  }
  if (dropped > 0 && process.env.NODE_ENV !== 'production' && typeof console !== 'undefined') {
    console.warn(
      `[RenderSchema] Компонент управляет children сам — текстовых частей он не рендерит; ` +
        `отброшено: ${dropped}. Оберните текст в узел (напр. { component: 'span', children: [...] }).`
    );
  }
  return out;
}

/** Части-сигналы (на них подписывается {@link RenderTextContent}); литералы отбрасываются. */
function collectTextSignals(parts: readonly RenderTextPart[]): Array<Signal<unknown>> {
  const out: Array<Signal<unknown>> = [];
  for (const p of parts) if (p instanceof Signal) out.push(p as Signal<unknown>);
  return out;
}

/** Склейка частей в строку: сигналы читаются, `null`/`undefined` дают пустую строку (как в React). */
function joinTextParts(parts: readonly RenderTextPart[]): string {
  let out = '';
  for (const p of parts) {
    const v = p instanceof Signal ? (p as Signal<unknown>).value : p;
    if (v != null) out += String(v);
  }
  return out;
}

/**
 * Стабильный ключ набора сигналов: меняется только когда набор реально другой. Нужен, чтобы
 * `subscribe` не пересоздавался на каждый рендер (схема-фабрика отдаёт новый литерал `text` каждый
 * раз, хотя сами сигналы модели стабильны) — иначе React дисposит и создаёт preact-effect на
 * каждый commit.
 */
function useSignalSetKey(signals: ReadonlyArray<Signal<unknown>>): number {
  const ref = useRef<{ signals: ReadonlyArray<Signal<unknown>>; key: number }>({ signals, key: 0 });
  const prev = ref.current;
  if (prev.signals.length !== signals.length || signals.some((s, i) => s !== prev.signals[i])) {
    ref.current = { signals, key: prev.key + 1 };
  }
  return ref.current.key;
}

/**
 * Разворачивает signal-значения в `componentProps` (появляются, когда `$model(...)` стоит в
 * componentProps — напр. `{ type: '$model(type)' }` в шаблоне элемента списка) в их `.value` и
 * точечно на них подписывается: компонент получает живое значение поля, а не сырой Signal, и
 * ре-рендерится при изменении. Пропсы без сигналов возвращаются по той же ссылке (стабильность
 * `React.memo`). Реактивность — через revision-счётчик, поэтому объект пропсов пересобирается inline
 * (дешёвый spread), без кэш-снапшота. SSR-safe. Вызывать безусловно (на верхнем уровне рендера).
 */
function useSignalProps(
  props: Record<string, unknown> | undefined
): Record<string, unknown> | undefined {
  const keys: string[] = [];
  if (props) for (const k of Object.keys(props)) if (props[k] instanceof Signal) keys.push(k);
  const signals: Array<Signal<unknown>> = keys.map((k) => props![k] as Signal<unknown>);
  const signalsKey = useSignalSetKey(signals);
  const signalsRef = useRef(signals);
  signalsRef.current = signals;
  const revRef = useRef(0);
  const subscribe = useCallback(
    (onStoreChange: () => void) => {
      if (signalsRef.current.length === 0) return () => {};
      let first = true;
      return effect(() => {
        for (const s of signalsRef.current) void s.value; // зависимости эффекта
        if (first) {
          first = false;
          return;
        }
        revRef.current += 1;
        onStoreChange();
      });
    },
    [signalsKey]
  );
  useSyncExternalStore(
    subscribe,
    () => revRef.current,
    () => revRef.current
  );
  if (!props || keys.length === 0) return props;
  const out: Record<string, unknown> = { ...props };
  for (const k of keys) out[k] = (props[k] as Signal<unknown>).value;
  return out;
}

/**
 * Текстовые дети узла — подряд идущие части одного чанка ({@link groupChildren}). Части-сигналы
 * подписываются точечно, поэтому изменение значения модели перерисовывает только этот текст, а не
 * поддерево узла. Снапшот — примитив-строка, поэтому кэшировать его (в отличие от объектных
 * снапшотов выше) не нужно: `useSyncExternalStore` сравнивает через `Object.is`. SSR-safe.
 */
const RenderTextContent = memo(function RenderTextContent({
  parts,
}: {
  parts: readonly RenderTextPart[];
}): ReactNode {
  const signals = collectTextSignals(parts);
  const signalsKey = useSignalSetKey(signals);
  // Актуальные части/сигналы читаются из ref-ов: subscribe/getSnapshot ключуются по составу
  // сигналов, а не по идентичности литерала `text`.
  const partsRef = useRef(parts);
  partsRef.current = parts;
  const signalsRef = useRef(signals);
  signalsRef.current = signals;

  const subscribe = useCallback(
    (onStoreChange: () => void) => {
      if (signalsRef.current.length === 0) return () => {};
      let first = true;
      return effect(() => {
        for (const s of signalsRef.current) void s.value; // зависимости эффекта
        if (first) {
          first = false;
          return;
        }
        onStoreChange();
      });
    },
    [signalsKey]
  );

  const getSnapshot = useCallback(() => joinTextParts(partsRef.current), []);

  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
});

/**
 * Рекурсивный рендеринг узла {@link RenderNode}. Определяет тип узла и рендерит
 * соответственно: {@link ModelFieldRenderNode} → компонент поля с wrapper (значение
 * из сигнала модели, state — по сигналу через реестр), {@link ArrayRenderNode} → секция
 * массива модели, {@link ContainerRenderNode} → контейнер с дочерними узлами. Учитывает
 * `hideWhen`/`setHidden`, `patchProps`, `onComponentEvent`, lifecycle-хуки и ref из
 * {@link RenderSchemaProxy}. Обычно вызывается {@link FormRenderer}; явный вызов нужен
 * при ручной композиции.
 *
 * @typeParam T - Тип значения формы
 * @param props - `node` (узел), опц. `form` и `fieldWrapper`
 * @returns Отрендеренное поддерево или `null` (если узел скрыт / нет ноды для сигнала)
 *
 * @example
 * ```tsx
 * import { RenderNodeComponent } from '@reformer/renderer-react';
 *
 * <RenderContextProvider value={{ settings: { fieldWrapper: FormField } }}>
 *   <RenderNodeComponent node={rootNode} />
 * </RenderContextProvider>
 * ```
 */
export function RenderNodeComponent<T>({
  node,
  form,
  fieldWrapper: fieldWrapperProp,
}: RenderNodeComponentProps<T>): ReactNode {
  const { settings } = useRenderContext();
  // prop имеет приоритет над глобальным settings (для user-space компонентов с вложенными формами)
  const fieldWrapper = fieldWrapperProp ?? settings?.fieldWrapper;

  // selector теперь доступен на обоих типах нод (FieldRenderNode и ContainerRenderNode)
  const { selector } = node;
  // Программное переопределение (createRenderSchema) — наивысший приоритет
  const hiddenOverride = useHiddenOverride(selector);
  const propsOverride = usePropsOverride(selector);
  // Ref из registry (если зарегистрирован через schema.node(selector).getRef())
  const overrideMaps = useContext(RenderSchemaOverrideContext);
  const nodeRef =
    selector && overrideMaps?.refRegistry.has(selector)
      ? overrideMaps.refRegistry.get(selector)
      : undefined;
  // Декларативное поведение (hideWhen) — средний приоритет
  const conditionFn = selector ? overrideMaps?.conditionRegistry.get(selector) : undefined;
  const isHiddenByBehavior = useCondition(conditionFn);
  // Итоговое: override > behavior > видимо по умолчанию
  const isHidden = hiddenOverride != null ? hiddenOverride : isHiddenByBehavior;

  // Lifecycle-хуки ноды (onMount/onUnmount). onInit — синхронный build-time хук (см. render-behavior),
  // не проходит через этот путь и не хранится в lifecycleRegistry.
  const lifecycleHooks = selector ? overrideMaps?.lifecycleRegistry.get(selector) : undefined;
  useNodeLifecycle(lifecycleHooks);

  // Разворачиваем signal-значения в componentProps (из `$model(...)`, напр. в шаблоне элемента
  // списка) — безусловно, до early-return. Использует контейнерная ветка (у листа свой seam).
  const unwrappedComponentProps = useSignalProps(
    node.componentProps as Record<string, unknown> | undefined
  );

  if (isHidden) {
    return null;
  }

  // ========================================
  // M1: ModelFieldRenderNode — лист на сигнале модели
  // ========================================
  if (isModelFieldRenderNode(node)) {
    const fieldNode = getNodeForSignal(node.value) as FieldNode<unknown> | undefined;
    if (!fieldNode) {
      if (typeof console !== 'undefined') {
        const p = (node.value as { __path?: string }).__path;
        console.warn(
          `[RenderSchema] No form node for signal${p ? ` "${p}"` : ''} — render value-leaf after createForm.`
        );
      }
      return null;
    }
    // Адресация ref листа: явный `selector` в приоритете, иначе — индексный путь модели
    // (`phones.0.number`), который сигнал несёт в `__path`. Даёт адресацию строк FormArray
    // (`schema.node('phones.0.number').getRef()`) без перечисления индексов автором схемы.
    const leafRefKey = selector ?? (node.value as { __path?: string }).__path;
    const leafRef =
      leafRefKey && overrideMaps?.refRegistry.has(leafRefKey)
        ? overrideMaps.refRegistry.get(leafRefKey)
        : undefined;
    return (
      <ModelFieldRenderer
        node={node}
        fieldNode={fieldNode}
        fieldWrapper={fieldWrapper}
        nodeRef={leafRef}
        resolveFieldAdapter={settings?.resolveFieldAdapter}
      />
    );
  }

  // ========================================
  // M1: ArrayRenderNode — массив модели { array, item }
  // ========================================
  if (isArrayRenderNode(node)) {
    // Задан `component` ($component(FormArray)/$component(List)/своя секция) — рендерит он.
    // Иначе — безхромный fallback: только элементы, без UI управления (см. ModelArrayFallback).
    return node.component ? (
      <ModelArrayComponentRenderer node={node} fieldWrapper={fieldWrapper} />
    ) : (
      <ModelArrayFallback node={node} fieldWrapper={fieldWrapper} />
    );
  }

  // ========================================
  // ContainerRenderNode - контейнер
  // ========================================
  if (isContainerRenderNode(node)) {
    const { selector, component: Component, children } = node;
    const baseProps = unwrappedComponentProps || {};
    // Применяем переопределение пропсов (если задано через schema.node(selector).patchProps())
    const propsPatched = propsOverride != null ? { ...baseProps, ...propsOverride } : baseProps;
    // Колбэки из callbackRegistry (onComponentEvent) — наивысший приоритет среди prop-overrides
    const callbackMap = selector ? overrideMaps?.callbackRegistry.get(selector) : undefined;
    const callbackOverrides = callbackMap ? Object.fromEntries(callbackMap) : {};
    const effectiveProps = callbackMap ? { ...propsPatched, ...callbackOverrides } : propsPatched;

    // Нативный HTML-тег (`component: 'div'`) — не компонент: `componentProps` тут DOM-атрибуты,
    // а `selector` адресует УЗЕЛ схемы, поэтому в разметку не пробрасывается (иначе утёк бы
    // неизвестным атрибутом). Для компонентов поведение прежнее.
    const isHtmlTag = typeof Component === 'string';
    const selectorProp = !isHtmlTag && selector !== undefined ? { selector } : {};
    // JSX по широкому `ElementType` разворачивается в union всех intrinsic-элементов и валит
    // компиляцию (TS2590). Рантайм-семантика от сужения не меняется: React сам различает
    // строку-тег и компонент.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const Comp = Component as React.ComponentType<any>;

    // Если компонент управляет children самостоятельно (например, wizard с RenderNode[]),
    // передаём children как сырые данные без авторендеринга через RenderNodeComponent.
    // form пробрасывается в self-managed компоненты как prop, чтобы они могли
    // вызывать `<RenderNodeComponent form={form} ...>` для своих дочерних узлов
    // (используется в RendererFormArraySection, RendererFormWizard и т.п.).
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    if (!isHtmlTag && (Component as any).__selfManagedChildren === true) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const SelfManagedComponent = Component as React.ComponentType<any>;
      // Не перетираем form, если уже задан в componentProps (orchestrator-инжект).
      const formProp =
        (effectiveProps as Record<string, unknown>).form === undefined && form !== undefined
          ? { form }
          : {};
      // children: предпочитаем node.children (если есть). Иначе fallback на
      // componentProps.children (некоторые компоненты, напр. FormRoot из page 2 v4,
      // передают raw RenderNode[] через componentProps).
      // Такой компонент рендерит детей сам и ждёт УЗЛЫ — текстовые части ему не отдаём
      // (он бы попытался прочитать у строки `component`/`children`).
      const childrenProp = children !== undefined ? { children: nodesOnly(children) } : {};
      return (
        <SelfManagedComponent
          {...(selector !== undefined ? { selector } : {})}
          {...effectiveProps}
          {...formProp}
          {...(nodeRef !== undefined ? { ref: nodeRef } : {})}
          {...childrenProp}
        />
      );
    }

    // Void-теги (<hr>, <br>, <img>) содержимого не имеют — React бросает на любых непустых
    // children, поэтому такому узлу не передаём ни `text`, ни `children` вовсе.
    if (isHtmlTag && VOID_HTML_TAGS.has(Component as string)) {
      return <Comp {...effectiveProps} {...(nodeRef !== undefined ? { ref: nodeRef } : {})} />;
    }

    return (
      <Comp
        {...selectorProp}
        {...effectiveProps}
        {...(nodeRef !== undefined ? { ref: nodeRef } : {})}
      >
        {/* Текст — такой же ребёнок, как узел: порядок соблюдается, соседние части склеиваются */}
        {children &&
          groupChildren(children).map((chunk) =>
            'parts' in chunk ? (
              <RenderTextContent key={chunk.key} parts={chunk.parts} />
            ) : (
              <RenderNodeComponent key={chunk.key} node={chunk.node} form={form} />
            )
          )}
      </Comp>
    );
  }

  return null;
}
