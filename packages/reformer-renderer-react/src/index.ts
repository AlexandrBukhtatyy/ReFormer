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
  ArrayRenderNode,
  ArrayRenderNodeProps,
  FormRendererProps,
  FieldWrapperProps,
  ContainerComponentProps,
  // Array selector types
  FormArraySelector,
  SelectorRenderNode,
} from './core/types';

// FormArray Context
export {
  FormArrayContext,
  FormArrayItemContext,
  useFormArrayContext,
  useFormArrayItemContext,
  type FormArrayContextValue,
  type FormArrayItemContextValue,
  type FormArrayItem,
} from './components/form-array-context';

// Components
export { FormRenderer } from './core/form-renderer';
export { RenderNodeComponent } from './core/render-node';

// Render Context
export { useRenderContext, type RenderContextValue } from './core/render-context';

// Container components
export { Box, type BoxProps } from './components/box';
export { Section, type SectionProps } from './components/section';
export { Collapsible, type CollapsibleProps } from './components/collapsible';
export { FormArray, type FormArrayProps } from './components/form-array';

// Utils
export { isFieldRenderNode, isArrayRenderNode, isContainerRenderNode } from './core/utils';
