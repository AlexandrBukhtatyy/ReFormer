/**
 * RenderSchema - декларативное описание структуры страницы формы
 *
 * RenderSchema отвечает за layout и условия отображения полей,
 * а ModelSchema — за конфигурацию самих полей.
 *
 * @module reformer/renderer-react
 *
 * @example
 * ```tsx
 * import { FormRenderer, Box, Section, type RenderSchemaFn } from '@reformer/renderer-react';
 *
 * const renderSchema: RenderSchemaFn<MyForm> = () => ({
 *   component: Box,
 *   children: [
 *     {
 *       component: Section,
 *       componentProps: { title: 'Личные данные' },
 *       children: [
 *         { model: model.$.firstName, component: Input },
 *         { model: model.$.lastName, component: Input },
 *       ],
 *     },
 *   ],
 * });
 *
 * <FormRenderer render={renderSchema} />
 * ```
 */

// Types
export type {
  RenderSchemaFn,
  RenderNode,
  // Член union'а `RenderNode` наравне с двумя соседними: без экспорта `get_symbol_docs`
  // отвечал «Symbol not found», хотя тип фигурирует в определении RenderNode в том же
  // API Reference — форму лист-узла приходилось восстанавливать из прозы.
  ModelFieldRenderNode,
  ContainerRenderNode,
  ContainerRenderNodeProps,
  ArrayRenderNode,
  PartRenderNode,
  RenderNodeFn,
  RenderModelArrayControl,
  ArrayItemSlot,
  ArrayComponentProps,
  RenderChild,
  RenderTextPart,
  FormRendererProps,
  RendererSettings,
  FieldAdapter,
  FieldWrapperProps,
  ContainerComponentProps,
} from './core/types';

// Components
export { FormRenderer } from './core/form-renderer';
export { RenderNodeComponent } from './core/render-node';

// Render Context
export {
  useRenderContext,
  RenderContextProvider,
  type RenderContextValue,
} from './core/render-context';

// Utils. Вид узла и привязку к модели разбирает компилятор ядра (`compileSchema`): у узла
// скомпилированной схемы есть `kind`, `handle`, `control`, `content`.
export { isHtmlTagRenderNode, VOID_HTML_TAGS } from './core/utils';

// Programmatic render schema control
export { createRenderSchema, isRenderSchemaProxy } from './core/render-schema-proxy';
export type { RenderSchemaProxy, RenderNodeControl } from './core/render-schema-proxy';

// Declarative render behavior
export {
  hideWhen,
  renderEffect,
  onComponentEvent,
  onInit,
  onMount,
  onUnmount,
} from './core/render-behavior';
export type { NodeLifecycleHooks } from './core/render-schema-proxy';
