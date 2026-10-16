/**
 * RenderNodeComponent - рекурсивный рендеринг узлов RenderSchema
 *
 * @module reformer/renderer-react/render-node
 */

import { memo, useCallback, useRef, useSyncExternalStore, type ReactNode } from 'react';
import { effect, type Signal } from '@reformer/core/signals';
import type {
  CompiledArrayNode,
  CompiledChild,
  CompiledFieldNode,
  CompiledNode,
  CompiledSchema,
  FormArray,
  FormControl,
  FormGroup,
} from '@reformer/core';
import {
  compileSchema,
  getNodeForSignal,
  isCompiledNode,
  isValueSignal,
  unknownSchemaSelectors,
} from '@reformer/core';
import { bindFieldProps, getFieldAdapter, useFieldHandleRef } from '@reformer/core/react';
import type {
  RenderNode,
  FieldWrapperProps,
  FieldAdapter,
  ArrayRenderNode,
  ArrayItemSlot,
  RenderModelArrayControl,
  RenderNodeFn,
  RenderTextPart,
} from './types';
import { VOID_HTML_TAGS } from './utils';
import { useRenderContext } from './render-context';
import { useContext, useEffect } from 'react';
import {
  useHiddenOverride,
  usePropsOverride,
  RenderSchemaOverrideContext,
  SchemaControllerContext,
} from './render-schema-proxy';
import {
  RenderBehaviorEffects,
  useCondition,
  useNodeLifecycle,
  useRefAttachmentWarning,
} from './render-behavior';

/**
 * Props для RenderNodeComponent
 */
interface RenderNodeComponentProps<T> {
  /**
   * Узел для рендеринга: узел скомпилированной схемы (`bundle.render.tree.root`, дети, которых
   * рендерер передал компоненту) либо авторский узел — его рендерер компилирует сам, один раз.
   */
  node: CompiledNode | RenderNode<T>;
  /** Proxy формы (опционально — предоставляется wizard-компонентом через props или контекст) */
  form?: FormGroup<T>;
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
function useFieldRenderState(fieldNode: FormControl<unknown>): {
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
  node: CompiledFieldNode;
  fieldNode: FormControl<unknown>;
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
  // Императивный handle поля для `schema.node(sel).getRef()`: собственный handle контрола либо
  // базовый FieldHandle из его DOM-узла. Хук — до early-return.
  const handleRef = useFieldHandleRef(nodeRef as React.Ref<unknown> | undefined);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const Component = node.component as React.ComponentType<any> | undefined;
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
  } = { ...node.props, ...nodeComponentProps } as Record<string, unknown> & {
    className?: string;
    wrapper?: React.ElementType;
    fieldWrapper?: React.ComponentType<FieldWrapperProps>;
    testId?: unknown;
  };

  // testId: явный из схемы, иначе из пути сигнала (`personalData.lastName` → `personalData-lastName`).
  const path = node.handle.__path;
  const testId =
    typeof explicitTestId === 'string'
      ? explicitTestId
      : path
        ? path.replace(/\./g, '-')
        : undefined;

  // Адаптер по компоненту поля: контрол получает seam в своём диалекте (`checked`+событие,
  // `value`+`(value, option)` и т.д.). Явный резолв из настроек (чужие компоненты) приоритетнее
  // статики `reformerAdapter`; нет ни того, ни другого → value-based seam как есть.
  const adapter = resolveFieldAdapter?.(Component) ?? getFieldAdapter(Component);

  // §3.1 (BREAKING): нода формы (`control`) передаётся контролу ТОЛЬКО по явному запросу — статикой
  // `Component.reformerNeedsControl === true` либо `adapter.passControl`. По умолчанию НЕ передаётся:
  // leaf-контролы UI-kit её не потребляют, а errors/touched/label обслуживает FieldWrapper — он
  // получает `control` отдельно (ниже). Реактивные рантайм-пропы мёржит сам рендерер
  // (см. useFieldRenderState), поэтому ради них `control` контролу не нужен.
  const needsControl =
    adapter?.passControl === true ||
    (Component as { reformerNeedsControl?: boolean }).reformerNeedsControl === true;

  const inputProps = bindFieldProps(
    adapter,
    { value, onChange, onBlur },
    inputComponentProps as Record<string, unknown>
  );
  if (testId && inputProps['data-testid'] === undefined) {
    inputProps['data-testid'] = `input-${testId}`;
  }
  const input = (
    <Component
      {...inputProps}
      disabled={disabled}
      {...(needsControl ? { control: fieldNode } : {})}
      {...(nodeRef !== undefined ? { ref: handleRef } : {})}
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

/**
 * Резолв `initialValue` элемента для кнопки «Добавить»: значение или фабрика `() => value`.
 *
 * @deprecated Рендерер им больше не пользуется: «Добавить» зовёт `push()` без значения, а шаблон
 *   нового элемента живёт в модели (`arrayOf(blank)`; `initialValue` узла — запасной).
 */
export const resolveInitialValue = (init: ArrayRenderNode<unknown>['initialValue']): unknown =>
  typeof init === 'function' ? (init as () => unknown)() : init;

// ============================================================================
// Области схемы: строка массива и подформа
// ============================================================================

/** Области, для которых проверка селекторов уже выполнена, — предупреждаем один раз. */
const checkedScopes = new WeakSet<object>();

/**
 * Граница области схемы. Поддерево строки массива или подформы получает хранилище СВОЕЙ области:
 * селекторы внутри него адресуются из поведения, подключённого к той же под-модели
 * (`applyEach` / `apply`), и не пересекаются ни с корнем, ни с соседними строками.
 *
 * Области есть только при рендере бандла `createForm` (схема-контроллер в контексте). При рендере
 * по `createRenderSchema` область одна на всё дерево — граница прозрачна.
 */
function ScopeBoundary({
  schema,
  children,
}: {
  /** Скомпилированная схема области: её модель — ключ области, индекс — для сверки селекторов. */
  schema: CompiledSchema;
  children: ReactNode;
}): ReactNode {
  const context = useContext(SchemaControllerContext);
  const model = schema.model;
  const maps =
    context && model !== undefined ? context.controller.scopeOf(model).__overrideMaps : null;

  useEffect(() => {
    if (!maps || process.env.NODE_ENV === 'production' || checkedScopes.has(maps)) return;
    checkedScopes.add(maps);
    const unknown = unknownSchemaSelectors(maps, schema);
    if (unknown.length > 0 && typeof console !== 'undefined') {
      console.warn(
        '[RenderSchema] поведение области обращается к узлам, которых нет в её поддереве: ' +
          `${unknown.map((selector) => `"${selector}"`).join(', ')}. Правило ничего не сделает.`
      );
    }
  }, [maps, schema]);

  if (!maps) return children;
  return (
    <RenderSchemaOverrideContext.Provider value={maps}>
      <RenderBehaviorEffects effectRegistry={maps.effectRegistry} />
      {children}
    </RenderSchemaOverrideContext.Provider>
  );
}

/** Скомпилированный узел для авторского: компиляция одна на объект узла. */
const detachedNodes = new WeakMap<object, CompiledNode>();

/**
 * Узел скомпилированной схемы как есть; авторский узел (ручная композиция, тело шага визарда в
 * JSX) компилируется один раз и дальше берётся из памяти.
 */
function compiledNodeOf(node: CompiledNode | RenderNode<unknown>): CompiledNode {
  if (isCompiledNode(node)) return node;
  let compiled = detachedNodes.get(node);
  if (!compiled) {
    compiled = compileSchema(node as never).root;
    detachedNodes.set(node, compiled);
  }
  return compiled;
}

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
  /** Готовое поддерево элемента. */
  element: ReactNode;
}

/**
 * Итерация модель-массива для компонента-рендерера: подписка на структурные изменения массива
 * (add/remove/**reorder**) + скомпилированная схема строки + обёртка в {@link RenderNodeComponent}.
 * Возвращает на элемент `{ key, index, model, element }`. Единственная копия итерации — на ней
 * строятся ui-kit `List` (chrome-less) и `FieldArray` (add/remove/reorder): хром — их, данные
 * (модель для label, индекс для remove) — отсюда. SSR-safe (наследует серверный снапшот
 * {@link useModelArrayRevision}). Подписка живёт в компоненте, который реально рендерит.
 *
 * Элемент `null` в массиве модели (пришёл с сервера) строкой не рисуется — как и в форме, где у него
 * нет строки. `index` остальных — по-прежнему индекс модели.
 */
export function useModelArrayItems(
  node: CompiledArrayNode,
  fieldWrapper?: React.ComponentType<FieldWrapperProps>
): ReadonlyArray<ModelArrayItem> {
  const control = node.control as RenderModelArrayControl;
  useModelArrayRevision(control); // ре-рендер при структурных изменениях (включая reorder)
  const length = control.length;

  return Array.from({ length }, (_, index) => index).flatMap((index) => {
    const model = control.at(index);
    if (model == null) return [];
    const key = stableKey(model);
    // Схема строки — одна на под-модель: та же, по которой сборка построила форму строки.
    const element =
      typeof model === 'object' ? (
        <ScopeBoundary key={key} schema={node.row(model)}>
          <RenderNodeComponent node={node.row(model).root} fieldWrapper={fieldWrapper} />
        </ScopeBoundary>
      ) : (
        <RenderNodeComponent
          key={key}
          node={(node.source as ArrayRenderNode<unknown>).item(model)}
          fieldWrapper={fieldWrapper}
        />
      );
    return [{ key, index, model, element }];
  });
}

/** Однократное (на массив) предупреждение об узле без компонента-рендерера. */
const warnedArrays = new WeakSet<object>();
function warnArrayWithoutComponent(control: RenderModelArrayControl): void {
  if (typeof console === 'undefined') return;
  if (warnedArrays.has(control)) return;
  warnedArrays.add(control);
  const path = control.__path;
  console.warn(
    `[RenderSchema] Array node${path ? ` "${path}"` : ''} has no \`component\` — items are rendered ` +
      'without add/remove/reorder UI. Register an array component (e.g. `FieldArray` from ' +
      '@reformer/ui-kit) and set `component` on the node.'
  );
}

/**
 * Fallback для узла-массива БЕЗ `component`: рендерит только элементы — без секции, кнопок и
 * какого-либо оформления. UI управления (добавить/удалить/переставить) — задача компонента
 * (`$component(FieldArray)` из `@reformer/ui-kit` либо своего), рендерер разметку не шипает.
 */
const ModelArrayFallback = memo(function ModelArrayFallback({
  node,
  fieldWrapper,
}: {
  node: CompiledArrayNode;
  fieldWrapper?: React.ComponentType<FieldWrapperProps>;
}): ReactNode {
  const items = useModelArrayItems(node, fieldWrapper);
  warnArrayWithoutComponent(node.control as RenderModelArrayControl);
  return <>{items.map((it) => it.element)}</>;
});

/**
 * Индекс строки формы для индекса элемента модели: строка `i` — `i`-й непустой элемент. Для
 * элемента `null` строки формы нет — `undefined`.
 */
function formIndexOf(control: RenderModelArrayControl, modelIndex: number): number | undefined {
  if (control.at(modelIndex) == null) return undefined;
  let formIndex = 0;
  for (let position = 0; position < modelIndex; position++) {
    if (control.at(position) != null) formIndex++;
  }
  return formIndex;
}

/**
 * Массив, рендеримый ЗАРЕГИСТРИРОВАННЫМ компонентом (M1): узел `{ model, item, component }`.
 *
 * Итерацию — подписку на структуру, схемы строк, стабильные ключи — делает рендерер
 * ({@link useModelArrayItems}), а компонент получает результат обычными props:
 * {@link ArrayComponentProps} (`items` + `onAdd`/`onRemove`/`onMove`) плюс `componentProps` узла.
 * Компонент не знает ни про сигналы, ни про узлы схемы, ни про хуки рендерера — поэтому
 * реализовать его может любая UI-библиотека, а протестировать можно на фейковых `items` без формы.
 */
const ModelArrayComponentRenderer = memo(function ModelArrayComponentRenderer({
  node,
  fieldWrapper,
}: {
  node: CompiledArrayNode;
  fieldWrapper?: React.ComponentType<FieldWrapperProps>;
}): ReactNode {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const Comp = node.component as React.ComponentType<any>;
  const control = node.control as RenderModelArrayControl;
  const items = useModelArrayItems(node, fieldWrapper);

  // Колбэки стабильны по `control` — иначе memo-компоненты потребителя ломались бы на каждый
  // рендер секции. Новый элемент берётся из шаблона массива: `arrayOf(blank)` в модели либо
  // `initialValue` узла, который сборка формы регистрирует запасным шаблоном.
  //
  // Мутации — через ноду массива формы, когда она есть (рендер сборки `createForm`): кнопки
  // интерфейса — запись через форму, она делает массив `dirty`. Индексы `items` — индексы модели,
  // нода считает по строкам формы, поэтому индекс переводится. Без формы или для элемента `null`
  // (строки формы у него нет) — прямо в массив модели.
  const onAdd = useCallback(() => {
    const array = getNodeForSignal(node.handle) as FormArray<object> | undefined;
    if (array) array.push();
    else control.push();
  }, [node.handle, control]);
  const onRemove = useCallback(
    (index: number) => {
      const array = getNodeForSignal(node.handle) as FormArray<object> | undefined;
      const row = array ? formIndexOf(control, index) : undefined;
      if (array && row !== undefined) array.removeAt(row);
      else control.removeAt(index);
    },
    [node.handle, control]
  );
  const onMove = useCallback(
    (from: number, to: number) => {
      const array = getNodeForSignal(node.handle) as FormArray<object> | undefined;
      const fromRow = array ? formIndexOf(control, from) : undefined;
      const toRow = array ? formIndexOf(control, to) : undefined;
      if (array && fromRow !== undefined && toRow !== undefined) array.move(fromRow, toRow);
      else control.move(from, to);
    },
    [node.handle, control]
  );

  const slots: ArrayItemSlot[] = items.map(({ key, index, model, element }) => ({
    key,
    index,
    model,
    children: element,
  }));

  return <Comp items={slots} onAdd={onAdd} onRemove={onRemove} onMove={onMove} {...node.props} />;
});

// ============================================================================
// TEXT CONTENT — статический и реактивный текст узла
// ============================================================================

/**
 * Только узлы — для компонентов с `__selfManagedChildren` (визард, табы): они обходят детей сами и
 * ждут узлы скомпилированной схемы. Текст в таком слоте — ошибка автора схемы, поэтому в dev о нём
 * предупреждаем, а не роняем рендер.
 */
function nodesOnly(children: readonly CompiledChild[]): CompiledNode[] {
  const out: CompiledNode[] = [];
  let dropped = 0;
  for (const child of children) {
    if (child.kind === 'text') dropped += 1;
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
  for (const p of parts) if (isValueSignal(p)) out.push(p);
  return out;
}

/** Склейка частей в строку: сигналы читаются, `null`/`undefined` дают пустую строку (как в React). */
function joinTextParts(parts: readonly RenderTextPart[]): string {
  let out = '';
  for (const p of parts) {
    const v = isValueSignal(p) ? p.value : p;
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
  if (props) for (const k of Object.keys(props)) if (isValueSignal(props[k])) keys.push(k);
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
 * Отрисовать узел схемы. Передаётся пропом `renderNode` компонентам, которые управляют детьми
 * сами (`__selfManagedChildren`): так UI-библиотека рисует полученные узлы, не зная о рендерере.
 * Ссылка стабильна — пропсы memo-компонентов не дёргаются.
 */
const renderSchemaNode: RenderNodeFn = (node, key) => <RenderNodeComponent key={key} node={node} />;

/** Дети контейнера: текст подписывается точечно, узлы рисуются рекурсивно. */
function renderChildren<T>(
  children: readonly CompiledChild[],
  form: FormGroup<T> | undefined
): ReactNode[] {
  return children.map((child) =>
    child.kind === 'text' ? (
      <RenderTextContent key={child.id} parts={child.parts} />
    ) : (
      <RenderNodeComponent key={child.id} node={child} form={form} />
    )
  );
}

/**
 * Рекурсивный рендеринг узла схемы. Ветку выбирает вид узла скомпилированной схемы (`kind`):
 * поле → компонент поля с обёрткой (значение из сигнала модели, состояние — по сигналу через
 * реестр), массив под-форм → строки в своих областях, подформа → содержимое части в её области,
 * контейнер → компонент с детьми (без компонента — одни дети). Учитывает `hideWhen`/`setHidden`,
 * `patchProps`, `onComponentEvent`, lifecycle-хуки и ref. Обычно вызывается {@link FormRenderer};
 * явный вызов нужен при ручной композиции — авторский узел рендерер скомпилирует сам.
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
 *   <RenderNodeComponent node={bundle.render.tree!.root} />
 * </RenderContextProvider>
 * ```
 */
export function RenderNodeComponent<T>({
  node: givenNode,
  form,
  fieldWrapper: fieldWrapperProp,
}: RenderNodeComponentProps<T>): ReactNode {
  const node = compiledNodeOf(givenNode as CompiledNode | RenderNode<unknown>);
  const { settings } = useRenderContext();
  // prop имеет приоритет над глобальным settings (для user-space компонентов с вложенными формами)
  const fieldWrapper = fieldWrapperProp ?? settings?.fieldWrapper;

  const { selector } = node;
  // Программное переопределение (createRenderSchema) — наивысший приоритет
  const hiddenOverride = useHiddenOverride(selector);
  const propsOverride = usePropsOverride(selector);
  // Ref из registry (если зарегистрирован через schema.node(selector).getRef())
  const overrideMaps = useContext(RenderSchemaOverrideContext);
  // Схема-контроллер сборки: есть при рендере бандла `createForm` (области по под-моделям).
  const controllerContext = useContext(SchemaControllerContext);
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

  // Нарушение контракта ref иначе никак не проявляется: getRef() молча отдаёт null.
  // Скрытая нода ref не крепит по определению — на неё не ругаемся.
  useRefAttachmentWarning(selector, nodeRef, isHidden);

  // Разворачиваем signal-значения в componentProps (из `$model(...)`, напр. в шаблоне элемента
  // списка) — безусловно, до early-return. Использует контейнерная ветка (у листа свой seam).
  const unwrappedComponentProps = useSignalProps(node.props as Record<string, unknown>);

  if (isHidden) {
    return null;
  }

  switch (node.kind) {
    case 'array':
      // Задан `component` ($component(FieldArray)/$component(List)/своя секция) — рендерит он.
      // Иначе — безхромный fallback: только элементы, без UI управления (см. ModelArrayFallback).
      return node.component ? (
        <ModelArrayComponentRenderer node={node} fieldWrapper={fieldWrapper} />
      ) : (
        <ModelArrayFallback node={node} fieldWrapper={fieldWrapper} />
      );

    case 'part':
      // Содержимое части — та же компиляция, по которой сборка привязала конфиг полей группы.
      return (
        <ScopeBoundary schema={node.content}>
          <RenderNodeComponent
            node={node.content.root}
            form={form}
            fieldWrapper={fieldWrapperProp}
          />
        </ScopeBoundary>
      );

    case 'field': {
      const binding = node.handle;
      const fieldNode = getNodeForSignal(binding) as FormControl<unknown> | undefined;
      if (!fieldNode) {
        if (typeof console !== 'undefined') {
          const p = binding.__path;
          console.warn(
            `[RenderSchema] No form node for signal${p ? ` "${p}"` : ''} — render value-leaf after createForm.`
          );
        }
        return null;
      }
      // Адресация ref листа: явный `selector` в приоритете, иначе — индексный путь модели
      // (`phones.0.number`), который сигнал несёт в `__path`. Даёт адресацию строк FieldArray
      // (`schema.node('phones.0.number').getRef()`) без перечисления индексов автором схемы.
      // Селектор ищется в своей области, а путь абсолютный — он ищется от корня сборки.
      const leafRef = selector
        ? overrideMaps?.refRegistry.get(selector)
        : binding.__path
          ? (controllerContext?.rootMaps ?? overrideMaps)?.refRegistry.get(binding.__path)
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

    case 'container':
      break;
  }

  const { component: Component, children } = node;
  // Контейнер без компонента — группировка в схеме: рисуются только его дети.
  if (Component === undefined || Component === null || Component === '') {
    return <>{renderChildren(children, form)}</>;
  }

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

  // Компонент, который управляет детьми сам (визард, табы), получает узлы-дети данными и способ
  // их отрисовать. `form` пробрасывается пропом, чтобы он мог звать
  // `<RenderNodeComponent form={form} …>` для своих дочерних узлов.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  if (!isHtmlTag && (Component as any).__selfManagedChildren === true) {
    // Не перетираем form, если уже задан в componentProps (orchestrator-инжект).
    const formProp =
      (effectiveProps as Record<string, unknown>).form === undefined && form !== undefined
        ? { form }
        : {};
    // Детей передаём, только если автор их задал: иначе узлы могут прийти через componentProps
    // (`componentProps.children` / `steps`), и пустой список их бы перетёр. Текстовые части такому
    // компоненту не отдаём — он ждёт узлы.
    const childrenProp =
      (node.source as { children?: unknown }).children !== undefined
        ? { children: nodesOnly(children) }
        : {};
    // `renderNode` — способ отрисовать полученные узлы, не импортируя рендерер: компонент из
    // UI-библиотеки (визард) зовёт его для тела шага.
    return (
      <Comp
        {...(selector !== undefined ? { selector } : {})}
        {...effectiveProps}
        {...formProp}
        {...(nodeRef !== undefined ? { ref: nodeRef } : {})}
        {...childrenProp}
        renderNode={renderSchemaNode}
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
      {/* Текст — такой же ребёнок, как узел: порядок соблюдается, соседние части склеены */}
      {children.length > 0 ? renderChildren(children, form) : undefined}
    </Comp>
  );
}
