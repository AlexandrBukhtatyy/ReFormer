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
 * Схему берёт либо из пропа `render`, либо из бандла `form` ({@link createReactForm}) — явный проп
 * важнее. Саму форму (для wizard-узла) в дерево доносит билдер схемы или render-behavior, а не
 * отдельный проп рендерера.
 *
 * @typeParam T - Тип значения формы
 * @param props - {@link FormRendererProps}: `render` либо `form`, плюс опц. `settings`
 * @returns React-дерево формы
 *
 * @example Сборка и рендер одним вызовом
 * ```tsx
 * import { FormRenderer, createReactForm, useReactForm } from '@reformer/renderer-react';
 * import { FormField } from '@reformer/ui-kit';
 *
 * const myForm = useReactForm(() =>
 *   createReactForm<MyForm>({
 *     model: createMyModel(),
 *     schema: buildSchema,          // (model, form?) => RenderNode<MyForm>
 *     behavior: myFormBehavior,
 *     validation: myValidation,
 *     renderBehavior: makeMyRenderBehavior,
 *   })
 * );
 *
 * <FormRenderer form={myForm} settings={{ fieldWrapper: FormField }} />
 * ```
 */
export function FormRenderer<T>({ render, form, settings }: FormRendererProps<T>): ReactNode {
  // Явный проп важнее бандла — тем же правилом живёт JsonFormRenderer.
  const schemaFn = render ?? form?.render;
  if (!schemaFn) {
    throw new Error(
      'FormRenderer: provide either `render` (a RenderSchemaFn) or `form` (a createReactForm bundle).'
    );
  }
  const rootNode = schemaFn();

  const inner: ReactNode = (
    <RenderContextProvider value={{ settings }}>
      {isRenderSchemaProxy(schemaFn) && schemaFn.__overrideMaps.effectRegistry.length > 0 && (
        <RenderBehaviorEffects effectRegistry={schemaFn.__overrideMaps.effectRegistry} />
      )}
      <RenderNodeComponent node={rootNode} />
    </RenderContextProvider>
  );

  if (isRenderSchemaProxy(schemaFn)) {
    return (
      <RenderSchemaOverrideContext.Provider value={schemaFn.__overrideMaps}>
        {inner}
      </RenderSchemaOverrideContext.Provider>
    );
  }

  return inner;
}
