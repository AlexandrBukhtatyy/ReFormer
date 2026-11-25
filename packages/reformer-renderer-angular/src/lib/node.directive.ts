/**
 * Узел схемы: ветка по виду узла, видимость, подмена пропсов, события и жизненный цикл.
 *
 * Рендерер императивный: узел — директива на `<ng-container>`, которая создаёт компоненты реестра
 * и элементы HTML в своём контейнере представлений и обновляет их из effect ядра. Лишних
 * элементов в разметке нет: от узла в DOM остаётся только комментарий-якорь.
 *
 * @module renderer-angular/node
 */

import {
  ApplicationRef,
  ChangeDetectionStrategy,
  Component,
  DOCUMENT,
  Directive,
  EnvironmentInjector,
  Injectable,
  Injector,
  TemplateRef,
  ViewContainerRef,
  createComponent,
  inject,
  input,
  isDevMode,
  untracked,
  viewChild,
  type ComponentRef,
  type EmbeddedViewRef,
  type OnChanges,
  type OnDestroy,
  type Type,
} from '@angular/core';
import { compileSchema, getNodeForSignal, isCompiledNode } from '@reformer/core';
import type {
  CompiledArrayNode,
  CompiledChild,
  CompiledContainerNode,
  CompiledFieldNode,
  CompiledNode,
  CompiledPartNode,
  FormArray,
  FormControl,
  FormSchemaNode,
  SchemaOverrideMaps,
} from '@reformer/core';
import { resolveLocalized } from '@reformer/core/i18n';
import {
  VOID_HTML_TAGS,
  bindControlledFieldProps,
  fieldTestId,
  formIndexOf,
  getFieldAdapter,
  joinTextParts,
  mergeNodeProps,
  needsControl,
  nodesOnly,
  overrideWithEvents,
  splitFieldProps,
  stableKey,
  unwrapSignalProps,
  withComponentEvents,
  type FieldAdapter,
} from '@reformer/core/render';
import { effect, untracked as untrackedCore } from '@reformer/core/signals';
import { ComponentBinding, ElementBinding } from './bindings';
import { acceptsProp, componentIoOf } from './component-io';
import {
  FORM_BUNDLE,
  OVERRIDE_MAPS,
  REFORMER_I18N,
  RENDERER_SETTINGS,
  SCHEMA_CONTROLLER,
} from './context';
import { createHtmlElement } from './html-element.component';
import { createScopeBoundary, type ScopeBoundary } from './scope';
import type { ArrayItemContent, ArrayItemSlot } from './types';

type Props = Readonly<Record<string, unknown>>;

/** Ref узла из хранилища области. */
interface NodeRef {
  current: unknown;
}

/** То, что узел держит на экране, пока он виден. */
interface Content {
  /**
   * Снять подписки и ref. `detach` — убрать и представления: `false`, когда директиву уничтожает
   * сам Angular (её представления он убирает сам).
   */
  destroy(detach: boolean): void;
}

const NO_CONTENT: Content = { destroy() {} };

/** Фасад массива модели: длина, строки и мутации. */
interface ArrayControl {
  readonly __path: string;
  readonly length: number;
  at(index: number): unknown;
  push(item?: unknown): void;
  removeAt(index: number): void;
  move(from: number, to: number): void;
}

/**
 * Диалект контрола Angular по умолчанию — двусторонняя привязка `[(value)]`: значение входом
 * `value`, изменение выходом `valueChange` (у `model()` — та же пара). Действует для компонента
 * без статики `reformerAdapter`.
 */
export const VALUE_CHANGE_ADAPTER: FieldAdapter = {
  valueProp: 'value',
  changeProp: 'onValueChange',
};

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
 * Читает сигналы — вызывать внутри effect.
 */
function isHidden(maps: SchemaOverrideMaps, selector: string): boolean {
  // Версия селектора — подписка на `setHidden` / `resetHidden` и на появление условия у узла.
  void maps.versionFor(selector).value;
  const forced = maps.hiddenOverrides.get(selector) ?? null;
  if (forced != null) return forced;
  return maps.conditionRegistry.get(selector)?.() ?? false;
}

/** `schema.node(selector).patchProps()` узла. Читает сигнал версии — вызывать внутри effect. */
function propsOverrideOf(
  maps: SchemaOverrideMaps | null,
  selector: string | undefined
): Props | null {
  if (!maps || !selector) return null;
  void maps.versionFor(selector).value;
  return maps.propsOverrides.get(selector) ?? null;
}

/** Подформы, о правилах `patchProps` / `onComponentEvent` на которых уже предупредили. */
const warnedParts = new Set<string>();
/** Массивы, о которых уже предупредили: узел без компонента. */
const warnedArrays = new WeakSet<object>();
/** Компоненты, о которых уже предупредили: детей узла им некуда положить. */
const warnedProjection = new WeakSet<object>();

/** Строки массива: элемент `null` строкой не рисуется; `index` остальных — индекс модели. */
function arrayItems(
  node: CompiledArrayNode,
  control: ArrayControl,
  fieldWrapper: Type<unknown> | undefined
): ArrayItemSlot[] {
  const items: ArrayItemSlot[] = [];
  for (let index = 0; index < control.length; index++) {
    const model = control.at(index);
    if (model == null) continue;
    let content: ArrayItemContent;
    if (typeof model === 'object') {
      const schema = node.row(model);
      content = { schema, node: schema.root, fieldWrapper };
    } else {
      const item = (node.source as unknown as { item(value: unknown): FormSchemaNode }).item(model);
      content = { schema: undefined, node: item, fieldWrapper };
    }
    items.push({ key: stableKey(model), index, model, content });
  }
  return items;
}

/** Текстовая часть среди детей контейнера. */
type CompiledTextChild = Extract<CompiledChild, { kind: 'text' }>;

/** Контекст шаблона узла. */
interface NodeTemplateContext {
  $implicit: CompiledNode | FormSchemaNode;
  fieldWrapper: Type<unknown> | undefined;
}

/** Контекст шаблона текста. */
interface TextTemplateContext {
  $implicit: string;
}

/** Контекст шаблона строки массива. */
interface ItemTemplateContext {
  $implicit: ArrayItemSlot;
}

/**
 * Рекурсивный рендер узла схемы. Ветку выбирает вид узла (`kind`): поле → контрол с обёрткой,
 * массив под-форм → строки в своих областях, подформа → содержимое части в её области, контейнер
 * → компонент с детьми. Учитывает `hideWhen` / `setHidden`, `patchProps`, `onComponentEvent`,
 * хуки `onMount` / `onUnmount` и ref узла.
 *
 * Обычно узел рисует {@link FormRenderer}; директива в шаблоне нужна компоненту, который ведёт
 * детей сам (визард, вкладки), и при ручной композиции — авторский узел рендерер скомпилирует сам.
 *
 * @example
 * ```html
 * @for (step of children(); track step.id) {
 *   <ng-container [reformerNode]="step" />
 * }
 * ```
 */
@Directive({ selector: '[reformerNode]' })
export class ReformerNode implements OnChanges, OnDestroy {
  /** Узел скомпилированной схемы либо авторский узел. */
  readonly reformerNode = input.required<CompiledNode | FormSchemaNode>();
  /** Обёртка полей поддерева — главнее обёртки из настроек рендерера. */
  readonly reformerNodeFieldWrapper = input<Type<unknown> | undefined>(undefined);

  private readonly anchor = inject(ViewContainerRef);
  private readonly injector = inject(Injector);
  private readonly environmentInjector = inject(EnvironmentInjector);
  private readonly appRef = inject(ApplicationRef);
  private readonly document = inject(DOCUMENT);
  private readonly templates = inject(RenderTemplates);
  private readonly settings = inject(RENDERER_SETTINGS, { optional: true }) ?? undefined;
  private readonly bundle = inject(FORM_BUNDLE, { optional: true });
  private readonly maps = inject(OVERRIDE_MAPS, { optional: true });
  private readonly controllerContext = inject(SCHEMA_CONTROLLER, { optional: true });
  private readonly i18n = inject(REFORMER_I18N);

  private teardown: ((detach: boolean) => void) | undefined;

  ngOnChanges(): void {
    // Хук исполняется внутри перерисовки родителя: сигналы Angular, прочитанные при создании
    // поддерева, не должны стать её зависимостями.
    untracked(() => {
      this.teardown?.(true);
      this.teardown = this.setup(
        compiledNodeOf(this.reformerNode()),
        this.reformerNodeFieldWrapper()
      );
    });
  }

  ngOnDestroy(): void {
    this.teardown?.(false);
    this.teardown = undefined;
  }

  /** Ноды ЭТОЙ сборки: над одной моделью бывает несколько форм, и общий реестр отдал бы ноду последней. */
  private nodeOf(handle: object): unknown {
    return (this.bundle?.render?.nodeOf ?? getNodeForSignal)(handle);
  }

  /** Инжектор, в настройках которого обёртка поля поддерева, — для компонента, ведущего детей сам. */
  private withFieldWrapper(fieldWrapper: Type<unknown>): Injector {
    return Injector.create({
      providers: [{ provide: RENDERER_SETTINGS, useValue: { ...this.settings, fieldWrapper } }],
      parent: this.injector,
    });
  }

  private setup(
    node: CompiledNode,
    fieldWrapper: Type<unknown> | undefined
  ): (detach: boolean) => void {
    const { selector } = node;
    const maps = this.maps;

    let content: Content | undefined;
    const stopVisibility = effect(() => {
      const hidden = maps && selector ? isHidden(maps, selector) : false;
      untrackedCore(() => {
        if (hidden) {
          content?.destroy(true);
          content = undefined;
        } else {
          content ??= this.mount(node, fieldWrapper);
        }
      });
    });

    // Хуки жизненного цикла узла: `onMount` может вернуть очистку — она исполняется до `onUnmount`.
    const hooks = selector ? maps?.lifecycleRegistry.get(selector) : undefined;
    const cleanup = hooks?.onMount?.();

    return (detach) => {
      if (typeof cleanup === 'function') cleanup();
      hooks?.onUnmount?.();
      stopVisibility();
      content?.destroy(detach);
      content = undefined;
    };
  }

  private mount(node: CompiledNode, fieldWrapper: Type<unknown> | undefined): Content {
    switch (node.kind) {
      case 'container':
        return this.mountContainer(node, fieldWrapper);
      case 'field':
        return this.mountField(node, fieldWrapper ?? this.settings?.fieldWrapper);
      case 'array':
        return node.component
          ? this.mountArray(node, fieldWrapper ?? this.settings?.fieldWrapper)
          : this.mountArrayRows(node, fieldWrapper ?? this.settings?.fieldWrapper);
      case 'part':
        return this.mountPart(node, fieldWrapper);
    }
  }

  // -------------------------------------------------------------------------
  // Контейнер
  // -------------------------------------------------------------------------

  /**
   * Контейнер: компонент или HTML-тег с детьми; без компонента — одни дети. Обёртка поля,
   * переданная узлу, уходит детям — она действует на всё поддерево.
   */
  private mountContainer(
    node: CompiledContainerNode,
    fieldWrapper: Type<unknown> | undefined
  ): Content {
    const { component, children, selector } = node;
    const maps = this.maps;
    const anchor = this.anchor;

    if (component === undefined || component === null || component === '') {
      const stopChildren = this.renderChildrenInPlace(children, fieldWrapper);
      return {
        destroy: (detach) => {
          stopChildren();
          if (detach) anchor.clear();
        },
      };
    }

    // Сигналы в `componentProps` контейнера (`$model(...)`) — значениями; подмена поведения —
    // поверх схемы, колбэк `onComponentEvent` главнее пропса схемы с тем же именем.
    const readProps = (): Props =>
      overrideWithEvents(
        resolveLocalized(
          mergeNodeProps(unwrapSignalProps(node.props), undefined, propsOverrideOf(maps, selector)),
          this.i18n
        ),
        selector ? maps?.callbackRegistry.get(selector) : undefined
      );
    const nodeRef = selector ? maps?.refRegistry.get(selector) : undefined;

    // HTML-тег (`component: 'div'`) — не компонент: его пропсы — атрибуты DOM, а `selector`
    // адресует узел схемы и в разметку не уходит.
    if (typeof component === 'string') {
      const placeholder =
        VOID_HTML_TAGS.has(component) || children.length === 0
          ? undefined
          : this.document.createComment('');
      const host = createHtmlElement({
        tag: component,
        document: this.document,
        environmentInjector: this.environmentInjector,
        elementInjector: this.injector,
        children: placeholder ? [placeholder] : [],
      });
      anchor.insert(host.hostView);
      const element = host.location.nativeElement as HTMLElement;
      const binding = new ElementBinding(element);
      const stopProps = effect(() => {
        const props = readProps();
        untrackedCore(() => binding.apply(props));
      });
      host.changeDetectorRef.detectChanges();
      const stopChildren = placeholder
        ? this.renderChildrenInside(children, this.injector, placeholder, fieldWrapper)
        : () => {};
      if (nodeRef) nodeRef.current = element;

      return {
        destroy: (detach) => {
          stopProps();
          stopChildren();
          binding.destroy();
          if (nodeRef && nodeRef.current === element) nodeRef.current = null;
          if (detach) anchor.clear();
        },
      };
    }

    const type = component as Type<unknown> & { __selfManagedChildren?: boolean };
    // Компонент, который ведёт детей сам (визард, вкладки), получает узлы-дети данными и рисует
    // их директивой `reformerNode`. Детей передаём, только если автор их задал: иначе узлы могли
    // прийти через `componentProps`, и пустой список их бы перетёр.
    const selfManaged = type.__selfManagedChildren === true;
    let managedChildren: CompiledNode[] | undefined;
    if (selfManaged && (node.source as { children?: unknown }).children !== undefined) {
      const { nodes, dropped } = nodesOnly(children);
      if (dropped > 0 && isDevMode()) {
        console.warn(
          '[RenderSchema] Компонент управляет children сам — текстовых частей он не рендерит; ' +
            `отброшено: ${dropped}. Оберните текст в узел.`
        );
      }
      managedChildren = nodes;
    }

    // Дети уходят компоненту содержимым (`<ng-content />`). Сначала создаётся компонент с
    // заглушкой на месте детей, затем дети — с его инжектором: так им видны его провайдеры.
    const placeholder =
      !selfManaged && children.length > 0 ? this.document.createComment('') : undefined;
    const host = anchor.createComponent(type, {
      // Узлы, которые компонент рисует сам директивой `reformerNode`, берут обёртку поля из
      // настроек: переданная узлу обёртка встаёт туда — так она доходит и до них.
      injector: selfManaged && fieldWrapper ? this.withFieldWrapper(fieldWrapper) : this.injector,
      projectableNodes: placeholder ? [[placeholder]] : undefined,
    });
    const binding = new ComponentBinding(host, type);
    const stopProps = effect(() => {
      const props = readProps();
      untrackedCore(() => {
        const own: Record<string, unknown> = { ...props };
        // Необъявленный проп уходит атрибутом хост-элементу: `selector` получает только
        // компонент, который объявил такой вход.
        if (selector !== undefined && binding.io.inputs.has('selector')) own['selector'] = selector;
        if (managedChildren) own['children'] = managedChildren;
        binding.apply(own);
      });
    });
    host.changeDetectorRef.detectChanges();
    const stopChildren = placeholder
      ? this.renderChildrenInside(children, host.injector, placeholder, fieldWrapper, type)
      : () => {};
    const instance: unknown = host.instance;
    if (nodeRef) nodeRef.current = instance;

    return {
      destroy: (detach) => {
        stopProps();
        stopChildren();
        binding.destroy();
        if (nodeRef && nodeRef.current === instance) nodeRef.current = null;
        if (detach) anchor.clear();
      },
    };
  }

  /**
   * Текст части в её представлении: за сигналами ядра следит effect ядра и сам помечает
   * представление к перерисовке. Сигнал Angular тут не годится: представление шаблона, у которого
   * нет родителя-компонента, Angular по сигналу не перерисовывает.
   *
   * @returns Остановка подписки.
   */
  private watchText(
    child: CompiledTextChild,
    view: EmbeddedViewRef<TextTemplateContext>
  ): () => void {
    return effect(() => {
      const text = joinTextParts(child.parts);
      if (view.context.$implicit === text) return;
      view.context.$implicit = text;
      view.markForCheck();
    });
  }

  /**
   * Дети контейнера без компонента — на месте самого узла: текст подписывается точечно, узлы
   * рисуются рекурсивно.
   *
   * @returns Остановка подписок текста.
   */
  private renderChildrenInPlace(
    children: readonly CompiledChild[],
    fieldWrapper: Type<unknown> | undefined
  ): () => void {
    const stops: Array<() => void> = [];
    for (const child of children) {
      if (child.kind === 'text') {
        const view = this.anchor.createEmbeddedView(this.templates.text, { $implicit: '' });
        stops.push(this.watchText(child, view));
        view.detectChanges();
      } else {
        this.anchor
          .createEmbeddedView(
            this.templates.node,
            { $implicit: child, fieldWrapper },
            { injector: this.injector }
          )
          .detectChanges();
      }
    }
    return () => {
      for (const stop of stops) stop();
    };
  }

  /**
   * Дети внутри родителя — тега или компонента: встают на место заглушки.
   *
   * Представления детей самостоятельные, в контейнере узла их нет: в нём стоит один родитель, и,
   * переставляя узел (строку массива), Angular двигает его элемент целиком, а детей внутри не
   * трогает. Якоря детей переносятся к родителю пустыми, до первой отрисовки: дальше каждый
   * ребёнок вставляет своё содержимое рядом со своим якорем.
   *
   * @returns Снятие детей.
   */
  private renderChildrenInside(
    children: readonly CompiledChild[],
    injector: Injector,
    placeholder: Comment,
    fieldWrapper: Type<unknown> | undefined,
    owner?: Type<unknown>
  ): () => void {
    if (placeholder.parentNode === null) {
      // Компонент не спроецировал содержимое при создании: `<ng-content />` в нём нет либо он
      // стоит под условием. Детям узла негде встать.
      if (owner && isDevMode() && !warnedProjection.has(owner)) {
        warnedProjection.add(owner);
        console.warn(
          `[RenderSchema] Компонент "${owner.name}" не вывел содержимое при создании — дети узла ` +
            'не отрисованы. Нужен `<ng-content />` вне условий либо статика `__selfManagedChildren`.'
        );
      }
      return () => {};
    }

    const stops: Array<() => void> = [];
    const views: EmbeddedViewRef<unknown>[] = [];
    for (const child of children) {
      let view: EmbeddedViewRef<unknown>;
      if (child.kind === 'text') {
        const textView = this.templates.text.createEmbeddedView({ $implicit: '' });
        stops.push(this.watchText(child, textView));
        view = textView;
      } else {
        view = this.templates.node.createEmbeddedView({ $implicit: child, fieldWrapper }, injector);
      }
      this.appRef.attachView(view);
      views.push(view);
    }
    placeholder.replaceWith(...views.flatMap((view) => view.rootNodes as Node[]));
    for (const view of views) view.detectChanges();

    return () => {
      for (const stop of stops) stop();
      for (const view of views) view.destroy();
    };
  }

  // -------------------------------------------------------------------------
  // Поле
  // -------------------------------------------------------------------------

  /**
   * Поле: значение и `disabled` из сигналов ноды, пропсы — схема, поверх реактивные пропсы ноды,
   * поверх переопределение поведения. Контрол лежит в обёртке поля, а без неё — в `div` либо в
   * теге или компоненте `wrapper` из пропсов поля.
   */
  private mountField(node: CompiledFieldNode, fieldWrapper: Type<unknown> | undefined): Content {
    const fieldNode = this.nodeOf(node.handle) as FormControl<unknown> | undefined;
    if (!fieldNode) {
      const path = node.handle.__path;
      console.warn(
        `[RenderSchema] No form node for signal${path ? ` "${path}"` : ''} — render ` +
          'value-leaf after createForm.'
      );
      return NO_CONTENT;
    }
    const component = node.component as Type<unknown> | undefined;
    if (!component) {
      console.warn('[RenderSchema] Model field has no component — nothing to render.');
      return NO_CONTENT;
    }

    const { selector } = node;
    const maps = this.maps;
    const anchor = this.anchor;
    const adapter =
      this.settings?.resolveFieldAdapter?.(component) ??
      getFieldAdapter(component) ??
      VALUE_CHANGE_ADAPTER;
    const io = componentIoOf(component);
    const valueKey = adapter.valueProp ?? 'value';
    const changeKey = adapter.changeProp ?? 'onChange';
    const passControl = needsControl(adapter, component);

    const onChange = (value: unknown): void => fieldNode.setValue(value as never);
    const onBlur = (): void => fieldNode.markAsTouched();

    // Ref листа: явный `selector` в приоритете, иначе — путь модели (`phones.0.number`).
    // Селектор ищется в своей области, а путь абсолютный — от корня сборки.
    const nodeRef = selector ? maps?.refRegistry.get(selector) : undefined;
    const pathRefs = selector ? undefined : (this.controllerContext?.rootMaps ?? maps)?.refRegistry;

    let shell: FieldShell | undefined;
    let target: NodeRef | undefined;

    const stop = effect(() => {
      const value = fieldNode.value.value;
      const disabled = fieldNode.disabled.value;
      const componentProps = fieldNode.componentProps.value;
      // Путь поля строки массива меняется с индексом строки: из него выводятся testId и ref.
      const path = fieldNode.path.value;
      const override = propsOverrideOf(maps, selector);

      untrackedCore(() => {
        const own = splitFieldProps(
          resolveLocalized(mergeNodeProps(node.props, componentProps, override), this.i18n)
        );
        const testId = fieldTestId(own.testId, path);

        // Подпись, описание и `required` рисует обёртка поля — контролу они не уходят. Контрол с
        // inline-подписью получает `label` и `required`: для этого привязке нужен сам компонент.
        const inputProps = bindControlledFieldProps(
          adapter,
          { value, onChange, onBlur },
          own.rest,
          component
        );
        if (testId && inputProps['data-testid'] === undefined) {
          inputProps['data-testid'] = `input-${testId}`;
        }
        const controlProps: Record<string, unknown> = {
          ...withComponentEvents(
            inputProps,
            selector ? maps?.callbackRegistry.get(selector) : undefined
          ),
          disabled,
          ...(passControl ? { control: fieldNode } : {}),
        };
        // Значение и его обработчик — только каналом самого контрола: на хост-элементе значение
        // стало бы атрибутом, а обработчик — слушателем события DOM с чужим аргументом.
        if (!io.inputs.has(valueKey)) delete controlProps[valueKey];
        if (!acceptsProp(io, changeKey, controlProps[changeKey])) delete controlProps[changeKey];

        const wrapper = (own.fieldWrapper ?? fieldWrapper) as Type<unknown> | undefined;
        const shellType: unknown = wrapper ?? own.wrapper ?? 'div';
        const shellProps: Props = wrapper
          ? { className: own.className, control: fieldNode, testId }
          : { className: own.className };
        if (shell === undefined || shell.type !== shellType) {
          shell?.destroy();
          anchor.clear();
          shell = this.createFieldShell(shellType, component, shellProps, controlProps);
        } else {
          shell.apply(shellProps);
          shell.controlBinding.apply(controlProps);
        }

        const instance: unknown = shell.control.instance;
        const next = nodeRef ?? (path ? pathRefs?.get(path) : undefined);
        if (target && target !== next && target.current === instance) target.current = null;
        target = next;
        if (target) target.current = instance;
      });
    });

    return {
      destroy: (detach) => {
        stop();
        if (shell && target && target.current === shell.control.instance) target.current = null;
        shell?.destroy();
        shell = undefined;
        if (detach) anchor.clear();
      },
    };
  }

  /**
   * Оболочка поля с контролом внутри: обёртка поля, компонент `wrapper` либо тег. Оболочка
   * создаётся первой, контрол — с её инжектором: так контролу видны провайдеры обёртки.
   *
   * Контрол — самостоятельное представление, в контейнере узла его нет: в нём стоит одна оболочка,
   * и, переставляя поле, Angular двигает её элемент вместе с контролом внутри.
   */
  private createFieldShell(
    shellType: unknown,
    component: Type<unknown>,
    shellProps: Props,
    controlProps: Props
  ): FieldShell {
    const placeholder = this.document.createComment('');
    let shellRef: ComponentRef<unknown>;
    let apply: (props: Props) => void;
    let destroyShell: () => void;
    let injector = this.injector;

    if (typeof shellType === 'string') {
      shellRef = createHtmlElement({
        tag: shellType,
        document: this.document,
        environmentInjector: this.environmentInjector,
        elementInjector: this.injector,
        children: [placeholder],
      });
      this.anchor.insert(shellRef.hostView);
      const binding = new ElementBinding(shellRef.location.nativeElement as HTMLElement);
      apply = (props) => binding.apply(props);
      destroyShell = () => binding.destroy();
    } else {
      const type = shellType as Type<unknown>;
      shellRef = this.anchor.createComponent(type, {
        injector: this.injector,
        projectableNodes: [[placeholder]],
      });
      const binding = new ComponentBinding(shellRef, type);
      // Ноду поля и `testId` получает только обёртка, объявившая такие входы: на хост-элементе
      // им делать нечего.
      apply = ({ control, testId, ...rest }) =>
        binding.apply({
          ...rest,
          ...(binding.io.inputs.has('control') ? { control } : {}),
          ...(binding.io.inputs.has('testId') ? { testId } : {}),
        });
      destroyShell = () => binding.destroy();
      injector = shellRef.injector;
    }
    apply(shellProps);
    shellRef.changeDetectorRef.detectChanges();

    const control = createComponent(component, {
      environmentInjector: this.environmentInjector,
      elementInjector: injector,
    });
    this.appRef.attachView(control.hostView);
    const controlBinding = new ComponentBinding(control, component);
    controlBinding.apply(controlProps);
    if (placeholder.parentNode !== null) {
      placeholder.replaceWith(control.location.nativeElement as Node);
    } else if (typeof shellType !== 'string' && isDevMode()) {
      // Обёртка не спроецировала содержимое при создании: контролу негде встать.
      const type = shellType as Type<unknown>;
      if (!warnedProjection.has(type)) {
        warnedProjection.add(type);
        console.warn(
          `[RenderSchema] Обёртка "${type.name}" не вывела содержимое при создании — контрол ` +
            'поля не отрисован. Нужен `<ng-content />` вне условий.'
        );
      }
    }
    control.changeDetectorRef.detectChanges();

    return {
      type: shellType,
      control,
      controlBinding,
      apply,
      destroy: () => {
        destroyShell();
        controlBinding.destroy();
        control.destroy();
      },
    };
  }

  // -------------------------------------------------------------------------
  // Массив
  // -------------------------------------------------------------------------

  /**
   * Массив, который рисует зарегистрированный компонент. Компонент получает обычные входы —
   * `items` и колбэки `onAdd` / `onRemove` / `onMove` плюс `componentProps` узла — и не знает ни
   * про сигналы, ни про узлы схемы; строку он рисует директивой `reformerArrayItem`.
   */
  private mountArray(node: CompiledArrayNode, fieldWrapper: Type<unknown> | undefined): Content {
    const { selector } = node;
    const maps = this.maps;
    const anchor = this.anchor;
    const control = node.control as ArrayControl;
    const type = node.component as Type<unknown>;

    // Мутации — через ноду массива формы, когда она есть: запись через форму делает массив
    // `dirty`. Индексы `items` — индексы модели, нода считает по строкам формы, поэтому индекс
    // переводится. Без формы или для элемента `null` — прямо в массив модели.
    const formArray = (): FormArray<object> | undefined =>
      this.nodeOf(node.handle) as FormArray<object> | undefined;
    const onAdd = (): void => {
      const array = formArray();
      if (array) array.push();
      else control.push();
    };
    const onRemove = (index: number): void => {
      const array = formArray();
      const row = array ? formIndexOf(control, index) : undefined;
      if (array && row !== undefined) array.removeAt(row);
      else control.removeAt(index);
    };
    const onMove = (from: number, to: number): void => {
      const array = formArray();
      const fromRow = array ? formIndexOf(control, from) : undefined;
      const toRow = array ? formIndexOf(control, to) : undefined;
      if (array && fromRow !== undefined && toRow !== undefined) array.move(fromRow, toRow);
      else control.move(from, to);
    };

    const host = anchor.createComponent(type, { injector: this.injector });
    const binding = new ComponentBinding(host, type);
    const stop = effect(() => {
      // Структура массива: добавление, удаление и перестановка. Строки читаются вне подписки.
      void control.length;
      const override = propsOverrideOf(maps, selector);
      untrackedCore(() => {
        const own = resolveLocalized(mergeNodeProps(node.props, undefined, override), this.i18n);
        binding.apply(
          withComponentEvents(
            { items: arrayItems(node, control, fieldWrapper), onAdd, onRemove, onMove, ...own },
            selector ? maps?.callbackRegistry.get(selector) : undefined
          )
        );
      });
    });
    host.changeDetectorRef.detectChanges();

    return {
      destroy: (detach) => {
        stop();
        binding.destroy();
        if (detach) anchor.clear();
      },
    };
  }

  /**
   * Узел-массив без `component`: только строки — без секции и кнопок. Добавить, удалить и
   * переставить — задача компонента массива, рендерер разметку не поставляет.
   */
  private mountArrayRows(
    node: CompiledArrayNode,
    fieldWrapper: Type<unknown> | undefined
  ): Content {
    const anchor = this.anchor;
    const control = node.control as ArrayControl;
    if (!warnedArrays.has(node.control)) {
      warnedArrays.add(node.control);
      const path = control.__path;
      console.warn(
        `[RenderSchema] Array node${path ? ` "${path}"` : ''} has no \`component\` — items are ` +
          'rendered without add/remove/reorder UI. Set an array component on the node.'
      );
    }

    const rows = new Map<number, EmbeddedViewRef<ItemTemplateContext>>();
    const stop = effect(() => {
      void control.length;
      untrackedCore(() => {
        const items = arrayItems(node, control, fieldWrapper);
        const alive = new Set(items.map((item) => item.key));
        for (const [key, view] of rows) {
          if (alive.has(key)) continue;
          view.destroy();
          rows.delete(key);
        }
        items.forEach((item, position) => {
          const existing = rows.get(item.key);
          if (existing) {
            existing.context.$implicit = item;
            if (anchor.indexOf(existing) !== position) anchor.move(existing, position);
            existing.markForCheck();
            return;
          }
          const view = anchor.createEmbeddedView(
            this.templates.item,
            { $implicit: item },
            { index: position, injector: this.injector }
          );
          rows.set(item.key, view);
          view.detectChanges();
        });
      });
    });

    return {
      destroy: (detach) => {
        stop();
        rows.clear();
        if (detach) anchor.clear();
      },
    };
  }

  // -------------------------------------------------------------------------
  // Подформа
  // -------------------------------------------------------------------------

  /** Подформа: содержимое части в её области схемы. Своего компонента у неё нет. */
  private mountPart(node: CompiledPartNode, fieldWrapper: Type<unknown> | undefined): Content {
    const { selector } = node;
    const maps = this.maps;
    const anchor = this.anchor;

    // Подмене пропсов и событиям на подформе некуда прийти.
    let stopWarning = (): void => {};
    if (maps && selector !== undefined && isDevMode()) {
      stopWarning = effect(() => {
        const override = propsOverrideOf(maps, selector);
        const events = maps.callbackRegistry.get(selector);
        if ((override == null && (events?.size ?? 0) === 0) || warnedParts.has(selector)) return;
        warnedParts.add(selector);
        console.warn(
          `[RenderSchema] Подформа "${selector}" не рисует свой компонент: patchProps и ` +
            'onComponentEvent на ней ничего не сделают. Адресуйте узел внутри части.'
        );
      });
    }

    const scope = createScopeBoundary(this.injector, node.content);
    const view = anchor.createEmbeddedView(
      this.templates.node,
      { $implicit: node.content.root, fieldWrapper },
      { injector: scope.injector }
    );
    view.detectChanges();
    scope.start();

    return {
      destroy: (detach) => {
        stopWarning();
        scope.stop();
        if (detach) anchor.clear();
      },
    };
  }
}

/** Оболочка поля с контролом внутри. */
interface FieldShell {
  /** Тег или компонент оболочки: смена пересоздаёт поле. */
  readonly type: unknown;
  readonly control: ComponentRef<unknown>;
  readonly controlBinding: ComponentBinding;
  /** Пропсы оболочки. */
  apply(props: Props): void;
  /** Снять привязки и контрол; саму оболочку убирает контейнер узла. */
  destroy(): void;
}

/**
 * Строка массива в разметке компонента массива: поддерево строки в её области схемы.
 *
 * Строку узнают по содержимому, а не по объекту `item`: рендерер пересобирает список при каждой
 * смене массива, и строка, которая осталась на месте или переехала, не перерисовывается.
 *
 * @example
 * ```html
 * @for (item of items(); track item.key) {
 *   <li><ng-container [reformerArrayItem]="item" /></li>
 * }
 * ```
 */
@Directive({ selector: '[reformerArrayItem]' })
export class ReformerArrayItem implements OnChanges, OnDestroy {
  /** Строка из входа `items` компонента массива. */
  readonly reformerArrayItem = input.required<ArrayItemSlot>();

  private readonly anchor = inject(ViewContainerRef);
  private readonly injector = inject(Injector);
  private readonly templates = inject(RenderTemplates);

  private content: ArrayItemContent | undefined;
  private scope: ScopeBoundary | undefined;

  ngOnChanges(): void {
    untracked(() => {
      const content = this.reformerArrayItem().content;
      const current = this.content;
      if (
        current &&
        current.schema === content.schema &&
        current.node === content.node &&
        current.fieldWrapper === content.fieldWrapper
      ) {
        return;
      }
      this.release(true);
      this.content = content;

      const scope = content.schema ? createScopeBoundary(this.injector, content.schema) : undefined;
      const view = this.anchor.createEmbeddedView(
        this.templates.node,
        { $implicit: content.node, fieldWrapper: content.fieldWrapper },
        { injector: scope?.injector ?? this.injector }
      );
      view.detectChanges();
      scope?.start();
      this.scope = scope;
    });
  }

  ngOnDestroy(): void {
    this.release(false);
  }

  private release(detach: boolean): void {
    this.scope?.stop();
    this.scope = undefined;
    this.content = undefined;
    if (detach) this.anchor.clear();
  }
}

/**
 * Носитель шаблонов рендерера. Якорь узла — `<ng-container>` с директивой; создать его из кода
 * можно только как представление шаблона, поэтому шаблоны объявлены здесь, а представления из них
 * вставляются туда, где рисуется узел.
 */
@Component({
  selector: 'reformer-templates',
  imports: [ReformerNode, ReformerArrayItem],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <ng-template #node let-node let-fieldWrapper="fieldWrapper">
      <ng-container [reformerNode]="node" [reformerNodeFieldWrapper]="fieldWrapper" />
    </ng-template>
    <ng-template #text let-text>{{ text }}</ng-template>
    <ng-template #item let-item><ng-container [reformerArrayItem]="item" /></ng-template>
  `,
})
export class RenderTemplatesHolder {
  readonly node = viewChild.required<TemplateRef<NodeTemplateContext>>('node');
  readonly text = viewChild.required<TemplateRef<TextTemplateContext>>('text');
  readonly item = viewChild.required<TemplateRef<ItemTemplateContext>>('item');
}

/** Шаблоны рендерера — одни на приложение. */
@Injectable({ providedIn: 'root' })
export class RenderTemplates implements OnDestroy {
  private readonly holder = createComponent(RenderTemplatesHolder, {
    environmentInjector: inject(EnvironmentInjector),
  });

  /** Узел схемы: `<ng-container [reformerNode]>`. */
  readonly node = this.holder.instance.node();
  /** Текст контейнера: одна текстовая нода. */
  readonly text = this.holder.instance.text();
  /** Строка массива: `<ng-container [reformerArrayItem]>`. */
  readonly item = this.holder.instance.item();

  ngOnDestroy(): void {
    this.holder.destroy();
  }
}
