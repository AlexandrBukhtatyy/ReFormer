/**
 * Узел схемы: ветка по виду узла, видимость, подмена пропсов, события и жизненный цикл.
 *
 * @module renderer-vue/render-node
 */

import {
  defineComponent,
  h,
  inject,
  markRaw,
  onBeforeUnmount,
  onMounted,
  type Component,
  type PropType,
  type VNodeChild,
} from 'vue';
import { compileSchema, getNodeForSignal, isCompiledNode } from '@reformer/core';
import type {
  CompiledChild,
  CompiledContainerNode,
  CompiledNode,
  FormControl,
  FormSchemaNode,
  SchemaOverrideMaps,
} from '@reformer/core';
import { resolveLocalized } from '@reformer/core/i18n';
import {
  VOID_HTML_TAGS,
  mergeNodeProps,
  nodesOnly,
  overrideWithEvents,
  stableKey,
  unwrapSignalProps,
} from '@reformer/core/render';
import { useSignalValue } from './bridge/signals';
import {
  DEFAULT_I18N,
  FORM_BUNDLE,
  I18N,
  OVERRIDE_MAPS,
  RENDER_SETTINGS,
  SCHEMA_CONTROLLER,
} from './context';
import { declaresProp, toDomProps } from './logic/html';
import { ArrayComponent, ArrayFallback } from './render-array';
import { RenderField, type NodeRef } from './render-field';
import { RenderText } from './render-text';
import { ScopeBoundary } from './scope';
import type { RenderNodeFn } from './types';

/** Скомпилированный узел для авторского: компиляция одна на объект узла. */
const detachedNodes = new WeakMap<object, CompiledNode>();

/**
 * Узел скомпилированной схемы как есть; авторский узел (ручная композиция) компилируется один
 * раз и дальше берётся из памяти.
 */
function compiledNodeOf(node: CompiledNode | FormSchemaNode): CompiledNode {
  if (isCompiledNode(node)) return node;
  let compiled = detachedNodes.get(node);
  if (!compiled) {
    compiled = compileSchema(node as never).root;
    detachedNodes.set(node, compiled);
  }
  return compiled;
}

/**
 * Скрыт ли узел: принудительное значение (`setHidden`), иначе условие `hideWhen`, иначе виден.
 * Читает сигналы — вызывать внутри моста.
 */
function isHidden(maps: SchemaOverrideMaps, selector: string): boolean {
  // Версия селектора — подписка на `setHidden` / `resetHidden` и на появление условия у узла.
  void maps.versionFor(selector).value;
  const forced = maps.hiddenOverrides.get(selector) ?? null;
  if (forced != null) return forced;
  return maps.conditionRegistry.get(selector)?.() ?? false;
}

/** Подформы, о правилах `patchProps` / `onComponentEvent` на которых уже предупредили. */
const warnedParts = new Set<string>();

/**
 * Отрисовать узел схемы — для компонентов, которые ведут детей сами. Ссылка стабильна.
 */
const renderSchemaNode: RenderNodeFn = (node, key) => h(RenderNode, { key: key ?? node.id, node });

/** Способы отрисовки с обёрткой поля поддерева — по одному на обёртку, ссылка стабильна. */
const renderSchemaNodeWith = new WeakMap<Component, RenderNodeFn>();

/**
 * Способ отрисовки для компонента, который ведёт детей сам: обёртка поля, переданная узлу,
 * доходит и до узлов, которые он рисует.
 */
function renderNodeFor(fieldWrapper: Component | undefined): RenderNodeFn {
  if (fieldWrapper === undefined) return renderSchemaNode;
  let render = renderSchemaNodeWith.get(fieldWrapper);
  if (render === undefined) {
    render = (node, key) => h(RenderNode, { key: key ?? node.id, node, fieldWrapper });
    renderSchemaNodeWith.set(fieldWrapper, render);
  }
  return render;
}

/**
 * Дети контейнера: текст подписывается точечно, узлы рисуются рекурсивно. Обёртка поля,
 * переданная узлу, уходит и детям — она действует на всё поддерево.
 */
function renderChildren(
  children: readonly CompiledChild[],
  fieldWrapper: Component | undefined
): VNodeChild[] {
  return children.map((child) =>
    child.kind === 'text'
      ? h(RenderText, { key: child.id, parts: child.parts })
      : h(RenderNode, { key: child.id, node: child, fieldWrapper })
  );
}

/** Function ref Vue поверх ref узла из хранилища области. */
const attach = (target: NodeRef | undefined): Record<string, unknown> =>
  target
    ? {
        ref: (instance: unknown) => {
          target.current = instance;
        },
      }
    : {};

/**
 * Контейнер: компонент или HTML-тег с детьми; без компонента — одни дети.
 */
function renderContainer(
  node: CompiledContainerNode,
  props: Readonly<Record<string, unknown>>,
  nodeRef: NodeRef | undefined,
  fieldWrapper: Component | undefined
): VNodeChild {
  const { component, children, selector } = node;
  if (component === undefined || component === null || component === '') {
    return renderChildren(children, fieldWrapper);
  }

  // HTML-тег (`component: 'div'`) — не компонент: его пропсы — атрибуты DOM, а `selector`
  // адресует узел схемы и в разметку не уходит.
  if (typeof component === 'string') {
    const domProps = { ...toDomProps(props), ...attach(nodeRef) };
    return VOID_HTML_TAGS.has(component)
      ? h(component, domProps)
      : h(
          component,
          domProps,
          children.length > 0 ? renderChildren(children, fieldWrapper) : undefined
        );
  }

  const type = component as Component & { __selfManagedChildren?: boolean };
  // Необъявленный проп Vue отдаёт атрибутом корневому элементу: `selector` получает только
  // компонент, который его объявил, а `className` без объявления становится `class`.
  const ownProps: Record<string, unknown> = { ...props, ...attach(nodeRef) };
  if (selector !== undefined && declaresProp(type, 'selector')) ownProps.selector = selector;
  if ('className' in ownProps && !declaresProp(type, 'className')) {
    if (ownProps.class === undefined) ownProps.class = ownProps.className;
    delete ownProps.className;
  }

  // Компонент, который ведёт детей сам (визард, вкладки), получает узлы-дети данными и способ
  // их отрисовать. Детей передаём, только если автор их задал: иначе узлы могли прийти через
  // `componentProps`, и пустой список их бы перетёр.
  if (type.__selfManagedChildren === true) {
    if ((node.source as { children?: unknown }).children !== undefined) {
      const { nodes, dropped } = nodesOnly(children);
      if (dropped > 0 && process.env.NODE_ENV !== 'production') {
        console.warn(
          '[RenderSchema] Компонент управляет children сам — текстовых частей он не рендерит; ' +
            `отброшено: ${dropped}. Оберните текст в узел.`
        );
      }
      ownProps.children = nodes;
    }
    ownProps.renderNode = renderNodeFor(fieldWrapper);
    return h(type, ownProps);
  }

  return h(
    type,
    ownProps,
    children.length > 0 ? { default: () => renderChildren(children, fieldWrapper) } : undefined
  );
}

/**
 * Рекурсивный рендер узла схемы. Ветку выбирает вид узла (`kind`): поле → контрол с обёрткой,
 * массив под-форм → строки в своих областях, подформа → содержимое части в её области, контейнер
 * → компонент с детьми. Учитывает `hideWhen` / `setHidden`, `patchProps`, `onComponentEvent`,
 * хуки `onMount` / `onUnmount` и ref узла.
 *
 * Обычно узел рисует {@link FormRenderer}; явный вызов нужен при ручной композиции — авторский
 * узел рендерер скомпилирует сам. Узел читается при создании компонента: другому узлу — другой `key`.
 *
 * @example
 * ```ts
 * h(RenderNode, { key: step.id, node: step });
 * ```
 */
export const RenderNode = defineComponent({
  name: 'ReformerNode',
  props: {
    /** Узел скомпилированной схемы либо авторский узел. */
    node: { type: Object as PropType<CompiledNode | FormSchemaNode>, required: true },
    /** Обёртка полей поддерева — главнее обёртки из настроек рендерера. */
    fieldWrapper: { type: null as unknown as PropType<Component | undefined>, default: undefined },
  },
  setup(props) {
    const node = compiledNodeOf(props.node);
    const { selector } = node;
    const settings = inject(RENDER_SETTINGS, undefined);
    const bundle = inject(FORM_BUNDLE, null);
    const maps = inject(OVERRIDE_MAPS, null);
    const controllerContext = inject(SCHEMA_CONTROLLER, null);
    const i18n = inject(I18N, DEFAULT_I18N);
    // Ноды ЭТОЙ сборки: над одной моделью бывает несколько форм, и общий реестр отдал бы ноду
    // последней.
    const nodeOf: (handle: object) => unknown = bundle?.render?.nodeOf ?? getNodeForSignal;

    const hidden = useSignalValue(() => (maps && selector ? isHidden(maps, selector) : false));
    const propsOverride = useSignalValue(() => {
      if (!maps || !selector) return null;
      void maps.versionFor(selector).value;
      return maps.propsOverrides.get(selector) ?? null;
    });
    // Сигналы в `componentProps` контейнера (`$model(...)`) — значениями; у поля привязка своя.
    const containerProps =
      node.kind === 'container' ? useSignalValue(() => unwrapSignalProps(node.props)) : undefined;

    // Хуки жизненного цикла узла: `onMount` может вернуть очистку — она исполняется до `onUnmount`.
    const hooks = selector ? maps?.lifecycleRegistry.get(selector) : undefined;
    if (hooks) {
      let cleanup: void | (() => void);
      onMounted(() => {
        cleanup = hooks.onMount?.();
      });
      onBeforeUnmount(() => {
        if (typeof cleanup === 'function') cleanup();
        hooks.onUnmount?.();
      });
    }

    return () => {
      if (hidden.value) return null;

      const fieldWrapper = props.fieldWrapper ?? settings?.fieldWrapper;
      const events = selector ? maps?.callbackRegistry.get(selector) : undefined;
      const nodeRef = selector ? maps?.refRegistry.get(selector) : undefined;

      switch (node.kind) {
        case 'array':
          return node.component
            ? h(ArrayComponent, {
                node,
                fieldWrapper,
                propsOverride: propsOverride.value,
                events,
              })
            : h(ArrayFallback, { node, fieldWrapper });

        case 'part':
          // У подформы своего компонента нет — подмене пропсов и событиям некуда прийти.
          if (
            process.env.NODE_ENV !== 'production' &&
            selector !== undefined &&
            (propsOverride.value != null || (events?.size ?? 0) > 0) &&
            !warnedParts.has(selector)
          ) {
            warnedParts.add(selector);
            console.warn(
              `[RenderSchema] Подформа "${selector}" не рисует свой компонент: patchProps и ` +
                'onComponentEvent на ней ничего не сделают. Адресуйте узел внутри части.'
            );
          }
          return h(
            ScopeBoundary,
            { schema: node.content },
            {
              default: () =>
                h(RenderNode, { node: node.content.root, fieldWrapper: props.fieldWrapper }),
            }
          );

        case 'field': {
          const fieldNode = nodeOf(node.handle) as FormControl<unknown> | undefined;
          if (!fieldNode) {
            const path = node.handle.__path;
            console.warn(
              `[RenderSchema] No form node for signal${path ? ` "${path}"` : ''} — render ` +
                'value-leaf after createForm.'
            );
            return null;
          }
          // Ref листа: явный `selector` в приоритете, иначе — путь модели (`phones.0.number`).
          // Селектор ищется в своей области, а путь абсолютный — от корня сборки.
          return h(RenderField, {
            key: stableKey(fieldNode),
            node,
            // Нода уходит контролу и обёртке пропом: прокси Vue вместо неё порвал бы связь с формой.
            fieldNode: markRaw(fieldNode),
            fieldWrapper,
            nodeRef,
            pathRefs: selector ? undefined : (controllerContext?.rootMaps ?? maps)?.refRegistry,
            propsOverride: propsOverride.value,
            events,
          });
        }

        case 'container':
          return renderContainer(
            node,
            overrideWithEvents(
              resolveLocalized(
                mergeNodeProps(containerProps?.value, undefined, propsOverride.value),
                i18n
              ),
              events
            ),
            nodeRef,
            props.fieldWrapper
          );
      }
    };
  },
});
