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
 * import { FormRenderer, Box, Section, type RenderSchemaFn } from '@reformer/core';
 *
 * const renderSchema: RenderSchemaFn<MyForm> = (path) => ({
 *   component: Box,
 *   componentProps: {
 *     className: 'flex flex-col gap-6',
 *     children: [
 *       {
 *         component: Section,
 *         componentProps: {
 *           title: 'Личные данные',
 *           children: [
 *             { component: path.firstName },
 *             { component: path.lastName },
 *           ],
 *         },
 *       },
 *     ],
 *   },
 * });
 *
 * <FormRenderer form={form} render={renderSchema} />
 * ```
 */

// Types
export type {
  RenderSchemaFn,
  RenderNode,
  FieldRenderNode,
  FieldRenderNodeProps,
  ContainerRenderNode,
  ContainerRenderNodeProps,
  FormRendererProps,
  RendererSettings,
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

// Utils
export { isFieldRenderNode, isContainerRenderNode } from './core/utils';

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
export type { RenderBehaviorFn } from './core/render-behavior';
export type { NodeLifecycleHooks } from './core/render-schema-proxy';
