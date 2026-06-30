/**
 * FormRenderer - компонент для декларативного рендеринга формы
 *
 * @module reformer/renderer-react/form-renderer
 */

import { type ReactNode } from 'react';
import type { FormRendererProps } from './types';
import { RenderNodeComponent } from './render-node';
import { RenderContextProvider } from './render-context';
import { isRenderSchemaProxy, RenderSchemaOverrideContext } from './render-schema-proxy';
import { RenderBehaviorEffects } from './render-behavior';

/**
 * FormRenderer - рендеринг формы на основе RenderSchema
 *
 * Принимает RenderSchemaProxy (из createRenderSchema) и опциональные настройки.
 * Форма передаётся через componentProps wizard-компонента, а не напрямую в FormRenderer.
 *
 * @example
 * ```tsx
 * // render-schema.ts
 * export function createMyFormSchema(form: FormProxy<MyForm>) {
 *   const schema = createRenderSchema<MyForm>((path) => ({
 *     selector: 'wizard',
 *     component: RendererFormWizard,
 *     componentProps: { form, steps: [...] },
 *   }));
 *   myBehavior(schema);
 *   return schema;
 * }
 *
 * // MyFormPage.tsx
 * const form = useMemo(() => createMyForm(), []);
 * const schema = useMemo(() => createMyFormSchema(form), [form]);
 *
 * <FormRenderer render={schema} settings={{ fieldWrapper: FormField }} />
 * ```
 */
export function FormRenderer<T>({ render, settings }: FormRendererProps<T>): ReactNode {
  const rootNode = render();

  const inner: ReactNode = (
    <RenderContextProvider value={{ settings }}>
      {isRenderSchemaProxy(render) && render.__overrideMaps.effectRegistry.length > 0 && (
        <RenderBehaviorEffects effectRegistry={render.__overrideMaps.effectRegistry} />
      )}
      <RenderNodeComponent node={rootNode} />
    </RenderContextProvider>
  );

  if (isRenderSchemaProxy(render)) {
    return (
      <RenderSchemaOverrideContext.Provider value={render.__overrideMaps}>
        {inner}
      </RenderSchemaOverrideContext.Provider>
    );
  }

  return inner;
}
