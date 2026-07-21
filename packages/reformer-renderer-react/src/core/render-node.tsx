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
  ModelFieldRenderNode,
  ArrayRenderNode,
  RenderModelArrayControl,
  RenderText,
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
 * Подписка листового рендерера ТОЛЬКО на `value` + `disabled` поля (а не на все 9 сигналов
 * {@link useFormControl}). Обёрнутые `Component`/`FieldWrapper` получают `control` и подписываются
 * на errors/touched/pending/valid/… сами, поэтому родителю эти сигналы не нужны — лишние
 * ре-рендеры при churn'е валидации/touch устраняются, и `React.memo` пользовательских компонентов
 * поля не обесценивается. Снапшот кэшируется по паре (value, disabled): иначе useSyncExternalStore
 * получал бы свежий объект каждый getSnapshot и зациклился бы. SSR-safe.
 */
function useFieldValueAndDisabled(fieldNode: FieldNode<unknown>): {
  value: unknown;
  disabled: boolean;
} {
  const cacheRef = useRef<{ value: unknown; disabled: boolean }>({
    value: fieldNode.value.value,
    disabled: fieldNode.disabled.value,
  });
  const subscribe = useCallback(
    (onStoreChange: () => void) => {
      let first = true;
      return effect(() => {
        void fieldNode.value.value; // зависимость: сигнал value
        void fieldNode.disabled.value; // зависимость: сигнал disabled
        if (first) {
          first = false;
          return;
        }
        onStoreChange();
      });
    },
    [fieldNode]
  );
  const getSnapshot = useCallback((): { value: unknown; disabled: boolean } => {
    const value = fieldNode.value.value;
    const disabled = fieldNode.disabled.value;
    const prev = cacheRef.current;
    if (prev.value === value && prev.disabled === disabled) return prev;
    const next = { value, disabled };
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
}): ReactNode {
  // Подписка только на value+disabled (не на все 9 сигналов useFormControl).
  const { value, disabled } = useFieldValueAndDisabled(fieldNode);
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

  const {
    className,
    wrapper: Wrapper = 'div',
    fieldWrapper: perFieldWrapper,
    testId: explicitTestId,
    ...inputComponentProps
  } = node.componentProps ?? {};

  // testId: явный из схемы, иначе из пути сигнала (`personalData.lastName` → `personalData-lastName`).
  const path = (node.value as { __path?: string }).__path;
  const testId =
    typeof explicitTestId === 'string'
      ? explicitTestId
      : path
        ? path.replace(/\./g, '-')
        : undefined;

  const inputProps: Record<string, unknown> = {
    value,
    disabled,
    ...inputComponentProps,
  };
  if (testId && inputProps['data-testid'] === undefined) {
    inputProps['data-testid'] = `input-${testId}`;
  }

  const input = (
    <Component
      control={fieldNode}
      {...inputProps}
      {...(nodeRef !== undefined ? { ref: nodeRef } : {})}
      onChange={onChange}
      onBlur={onBlur}
    />
  );

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

const resolveInitial = (init: ArrayRenderNode<unknown>['initialValue']): unknown =>
  typeof init === 'function' ? (init as () => unknown)() : init;

/**
 * Секция массива единой схемы (M1): данные принадлежат модели (`node.array`), поддерево элемента
 * строит `node.item(itemModel)` и рендерит {@link RenderNodeComponent} (листья на сигналах под-модели
 * резолвятся через реестр — per-item формы создаёт `ModelArrayNode`, материализованный `createForm`).
 * Оформление совместимо с `FormArraySection` (карточки/кнопки/empty), поддерживает `fieldWrapper`.
 */
const ModelArraySectionRenderer = memo(function ModelArraySectionRenderer({
  node,
  fieldWrapper,
}: {
  node: ArrayRenderNode<unknown>;
  fieldWrapper?: React.ComponentType<FieldWrapperProps>;
}): ReactNode {
  const control = node.array;
  useModelArrayRevision(control); // ре-рендер при структурных изменениях массива, включая reorder
  const length = control.length;
  // Кэш поддеревьев по идентичности под-модели элемента (`im` кэшируется в ядре, зеркалит
  // stableKey WeakMap). Без него `node.item(im)` в цикле строил бы новый RenderNode на каждый
  // рендер → identity пропа `node` дочернего memo-рендерера менялась бы → memo ломался, и все
  // поля всех элементов ре-рендерились при любом структурном изменении (O(элементы×поля)).
  // Кэш сбрасывается при смене фабрики `node.item` (напр. новая схема).
  const subtreeCacheRef = useRef<{
    itemFn: ArrayRenderNode<unknown>['item'];
    map: WeakMap<object, RenderNode<unknown>>;
  } | null>(null);
  if (!subtreeCacheRef.current || subtreeCacheRef.current.itemFn !== node.item) {
    subtreeCacheRef.current = { itemFn: node.item, map: new WeakMap() };
  }
  const getSubtree = (im: unknown): RenderNode<unknown> => {
    if (im == null || typeof im !== 'object') return node.item(im) as RenderNode<unknown>;
    const cache = subtreeCacheRef.current!.map;
    let sub = cache.get(im as object);
    if (sub === undefined) {
      sub = node.item(im) as RenderNode<unknown>;
      cache.set(im as object, sub);
    }
    return sub;
  };
  const cp = node.componentProps ?? {};
  const {
    title,
    addButtonLabel = '+ Добавить',
    removeButtonLabel = 'Удалить',
    emptyMessage,
    itemLabel,
    reorderable = false,
    className = 'space-y-3 mt-2',
    cardClassName = 'mb-4 p-4 bg-white rounded border',
  } = cp;

  const getItemLabel = (im: unknown, index: number): string =>
    typeof itemLabel === 'function'
      ? itemLabel(im, index)
      : `${(itemLabel as string) ?? title ?? 'Элемент'} #${index + 1}`;

  // aria-labels перемещения и Tailwind-классы кнопок переопределяемы через componentProps
  // (дефолты сохраняют прежнее поведение). Позволяет i18n и консументам без Tailwind
  // подставить свои строки/классы, не форкая рендерер.
  const moveUpLabel = (cp.moveUpLabel as string | undefined) ?? 'Переместить вверх';
  const moveDownLabel = (cp.moveDownLabel as string | undefined) ?? 'Переместить вниз';
  const addBtnClass =
    (cp.addButtonClassName as string | undefined) ??
    'inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium transition-colors bg-primary text-primary-foreground shadow hover:bg-primary/90 h-9 px-4 py-2';
  const removeBtnClass =
    (cp.removeButtonClassName as string | undefined) ??
    'inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium transition-colors bg-destructive text-destructive-foreground shadow hover:bg-destructive/90 h-9 px-4 py-2';
  const moveBtnClass =
    (cp.moveButtonClassName as string | undefined) ??
    'inline-flex items-center justify-center rounded-md text-sm font-medium transition-colors border border-input bg-background shadow-sm hover:bg-accent hover:text-accent-foreground disabled:pointer-events-none disabled:opacity-40 h-9 w-9';

  const addButton = (cls: string) => (
    <button
      type="button"
      data-testid="array-add"
      className={cls}
      onClick={() => control.push(resolveInitial(node.initialValue))}
    >
      {addButtonLabel}
    </button>
  );

  return (
    <section className={className}>
      {title ? (
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-semibold">{title}</h3>
          {addButton(addBtnClass)}
        </div>
      ) : null}

      {Array.from({ length }, (_, i) => {
        const im = control.at(i);
        const subtree = getSubtree(im); // кэш по идентичности `im` → стабильный `node` для memo
        const showRemove = length > 1;
        return (
          <div key={stableKey(im)} className={cardClassName} data-testid={`array-item-${i}`}>
            {title || itemLabel ? (
              <div className="flex justify-between items-center mb-3">
                <h4 className="font-medium">{getItemLabel(im, i)}</h4>
                <div className="flex items-center gap-2">
                  {reorderable ? (
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        aria-label={moveUpLabel}
                        data-testid={`array-item-${i}-move-up`}
                        className={moveBtnClass}
                        disabled={i === 0}
                        onClick={() => control.move(i, i - 1)}
                      >
                        ↑
                      </button>
                      <button
                        type="button"
                        aria-label={moveDownLabel}
                        data-testid={`array-item-${i}-move-down`}
                        className={moveBtnClass}
                        disabled={i === length - 1}
                        onClick={() => control.move(i, i + 1)}
                      >
                        ↓
                      </button>
                    </div>
                  ) : null}
                  {showRemove ? (
                    <button
                      type="button"
                      data-testid={`array-item-${i}-remove`}
                      className={removeBtnClass}
                      onClick={() => control.removeAt(i)}
                    >
                      {removeButtonLabel}
                    </button>
                  ) : null}
                </div>
              </div>
            ) : null}
            <RenderNodeComponent node={subtree} fieldWrapper={fieldWrapper} />
          </div>
        );
      })}

      {length === 0 && emptyMessage ? (
        <div className="p-4 bg-gray-100 border border-gray-300 rounded text-center text-gray-600">
          {emptyMessage}
        </div>
      ) : null}

      {!title ? (
        <div>{addButton('text-sm text-blue-600 hover:text-blue-700 hover:underline')}</div>
      ) : null}
    </section>
  );
});

// ============================================================================
// TEXT CONTENT — статический и реактивный текст узла
// ============================================================================

/** Нормализует {@link RenderText} к массиву частей (одиночное значение → массив из одного). */
function toTextParts(text: RenderText): readonly RenderTextPart[] {
  return Array.isArray(text) ? text : [text as RenderTextPart];
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
 * Текстовое содержимое узла ({@link ContainerRenderNode.text}). Части-сигналы подписываются точечно,
 * поэтому изменение значения модели перерисовывает только этот текст, а не поддерево узла.
 * Снапшот — примитив-строка, поэтому кэшировать его (в отличие от объектных снапшотов выше)
 * не нужно: `useSyncExternalStore` сравнивает через `Object.is`. SSR-safe.
 */
const RenderTextContent = memo(function RenderTextContent({
  text,
}: {
  text: RenderText;
}): ReactNode {
  const parts = toTextParts(text);
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
      />
    );
  }

  // ========================================
  // M1: ArrayRenderNode — массив модели { array, item }
  // ========================================
  if (isArrayRenderNode(node)) {
    return <ModelArraySectionRenderer node={node} fieldWrapper={fieldWrapper} />;
  }

  // ========================================
  // ContainerRenderNode - контейнер
  // ========================================
  if (isContainerRenderNode(node)) {
    const { selector, component: Component, children } = node;
    const baseProps = node.componentProps || {};
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
      const childrenProp = children !== undefined ? { children } : {};
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
        {/* text идёт перед children — так `<p>Внимание! <b>…</b></p>` собирается без обёрток */}
        {node.text !== undefined ? <RenderTextContent text={node.text} /> : null}
        {children?.map((child, i) => (
          <RenderNodeComponent key={i} node={child} form={form} />
        ))}
      </Comp>
    );
  }

  return null;
}
