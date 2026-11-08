/**
 * Рендерер форм для React: рисует схему формы — единое дерево узлов (layout + поля) — по бандлу
 * сборки `createForm` из `@reformer/core`.
 *
 * Схема — функция от модели `(model) => RenderNode`: лист несёт ручку модели (`model.$.x`),
 * `component` и `componentProps`. Сборка строит по ней форму и компилирует дерево, а
 * `FormRenderer` получает бандл пропом `form`.
 *
 * @module reformer/renderer-react
 *
 * @example
 * ```tsx
 * import { createForm, type FormModel } from '@reformer/core';
 * import { useFormBundle } from '@reformer/core/react';
 * import { FormRenderer, type RenderNode } from '@reformer/renderer-react';
 * import { Box, Section, Input, FormField } from '@reformer/ui-kit';
 *
 * const mySchema = (model: FormModel<MyForm>): RenderNode<MyForm> => ({
 *   component: Box,
 *   children: [
 *     {
 *       component: Section,
 *       componentProps: { title: 'Личные данные' },
 *       children: [
 *         { model: model.$.firstName, component: Input, componentProps: { label: 'Имя' } },
 *         { model: model.$.lastName, component: Input, componentProps: { label: 'Фамилия' } },
 *       ],
 *     },
 *   ],
 * });
 *
 * function MyFormPage() {
 *   const bundle = useFormBundle(() => createForm<MyForm>({ initial, schema: mySchema }));
 *   return <FormRenderer form={bundle} settings={{ fieldWrapper: FormField }} />;
 * }
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
