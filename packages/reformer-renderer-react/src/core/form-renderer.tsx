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
 * Рендеринг формы по {@link RenderSchemaFn} или {@link RenderSchemaProxy}.
 *
 * Принимает `render` — функцию-схему (или обёртку из {@link createRenderSchema})
 * и опциональные `settings` (например, глобальный `fieldWrapper`). Разворачивает
 * корневой узел и рекурсивно рендерит дерево через {@link RenderNodeComponent}.
 * Если `render` — прокси, дополнительно монтирует реактивные эффекты (`renderEffect`)
 * и прокидывает карты переопределений (`setHidden`/`patchProps`/`hideWhen`) через контекст.
 *
 * Форму (для wizard-узла) прокидывают через `componentProps` соответствующего узла
 * схемы, а не отдельным пропом `FormRenderer`.
 *
 * @typeParam T - Тип значения формы
 * @param props - {@link FormRendererProps}: `render` (схема) и опц. `settings`
 * @returns React-дерево формы
 *
 * @example Схема + поведение + рендер
 * ```tsx
 * import { createForm } from '@reformer/core';
 * import { FormRenderer, createRenderSchema } from '@reformer/renderer-react';
 * import { FormField } from '@reformer/ui-kit';
 *
 * const { form, model } = useMemo(() => {
 *   const model = createMyModel();
 *   const form = createForm<MyForm>({ model, schema: buildSchema(model) });
 *   return { form, model };
 * }, []);
 *
 * // Прокси с form для wizard-узла + применённое render-поведение
 * const schema = useMemo(() => {
 *   const s = createRenderSchema<MyForm>(() => buildSchema(model, form));
 *   myBehavior(form)(s);
 *   return s;
 * }, [form, model]);
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
