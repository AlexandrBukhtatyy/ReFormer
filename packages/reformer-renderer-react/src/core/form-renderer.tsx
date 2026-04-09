/**
 * FormRenderer - компонент для декларативного рендеринга формы
 *
 * @module reformer/renderer-react/form-renderer
 */

import { type ReactNode, useMemo } from 'react';
import type { FormProxy } from '@reformer/core';
import { createFieldPath } from '@reformer/core';
import type { FormRendererProps } from './types';
import { RenderNodeComponent } from './render-node';
import { RenderContextProvider } from './render-context';
import { isRenderSchemaProxy, RenderSchemaOverrideContext } from './render-schema-proxy';
import {
  buildRenderBehavior,
  RenderBehaviorContext,
  RenderBehaviorEffects,
} from './render-behavior';

/**
 * FormRenderer - рендеринг формы на основе RenderSchema
 *
 * Принимает форму и функцию рендеринга, возвращает готовый React-компонент.
 * RenderSchema определяет структуру страницы: расположение полей,
 * контейнеры, секции и условия отображения.
 *
 * @example
 * ```tsx
 * const renderSchema: RenderSchemaFn<MyForm> = (path) => ({
 *   component: Box,
 *   componentProps: {
 *     className: 'flex flex-col gap-6',
 *   },
 *   children: [
 *     {
 *       component: Section,
 *       componentProps: {
 *         title: 'Личные данные',
 *         className: 'grid grid-cols-2 gap-4',
 *       },
 *       children: [
 *         { component: path.firstName },
 *         { component: path.lastName },
 *         { component: path.email, componentProps: { className: 'col-span-2' } },
 *       ],
 *     },
 *     {
 *       component: Section,
 *       componentProps: {
 *         title: 'Адрес',
 *         hidden: (form) => !form.needsAddress.value.value,
 *       },
 *       children: [
 *         { component: path.address.city },
 *         { component: path.address.street },
 *       ],
 *     },
 *   ],
 * });
 *
 * function MyFormPage() {
 *   const form = useForm(schema);
 *
 *   return (
 *     <form onSubmit={handleSubmit}>
 *       <FormRenderer form={form} render={renderSchema} />
 *       <button type="submit">Отправить</button>
 *     </form>
 *   );
 * }
 * ```
 */
export function FormRenderer<T>({
  form,
  render,
  settings,
  renderBehavior,
}: FormRendererProps<T>): ReactNode {
  const path = createFieldPath<T>();
  const rootNode = render(path);
  // Conditions are stable — recalculate only when renderBehavior reference changes
  const behaviorResult = useMemo(() => buildRenderBehavior(renderBehavior), [renderBehavior]);

  let inner: ReactNode = (
    <RenderContextProvider value={{ form, path, settings }}>
      {behaviorResult && behaviorResult.effects.length > 0 && (
        <RenderBehaviorEffects form={form} effects={behaviorResult.effects} />
      )}
      <RenderNodeComponent node={rootNode} form={form as FormProxy<T>} path={path} />
    </RenderContextProvider>
  );

  if (behaviorResult) {
    inner = (
      <RenderBehaviorContext.Provider value={behaviorResult.conditions}>
        {inner}
      </RenderBehaviorContext.Provider>
    );
  }

  if (isRenderSchemaProxy(render)) {
    return (
      <RenderSchemaOverrideContext.Provider value={render.__overrideMaps}>
        {inner}
      </RenderSchemaOverrideContext.Provider>
    );
  }

  return inner;
}
