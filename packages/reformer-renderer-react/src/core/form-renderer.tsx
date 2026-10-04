/**
 * FormRenderer - компонент для декларативного рендеринга формы
 *
 * @module reformer/renderer-react/form-renderer
 */

import { type ComponentType, type ReactNode } from 'react';
import { FormBundleContext, type FormBundle, type FormRender } from '@reformer/core';
import type { FieldWrapperProps, FormRendererProps, RenderNode, RendererSettings } from './types';
import { RenderNodeComponent } from './render-node';
import { RenderContextProvider } from './render-context';
import {
  isRenderSchemaProxy,
  RenderSchemaOverrideContext,
  SchemaControllerContext,
} from './render-schema-proxy';
import { RenderBehaviorEffects } from './render-behavior';

/** Часть `render` бандла `createForm` — готовое дерево и схема-контроллер, а не функция-схема. */
const isFormRender = (render: unknown): render is FormRender =>
  render != null && typeof render === 'object' && 'controller' in render;

/**
 * Рендер бандла `createForm`: дерево уже построено сборкой, поведение записало правила узлов в
 * схему-контроллер. Рендерер ставит контекст сборки (его читает визард), корневую область схемы и
 * исполняет правила.
 */
function BundleRenderer<T>({
  bundle,
  settings,
}: {
  bundle: FormBundle<T>;
  settings: RendererSettings | undefined;
}): ReactNode {
  const { tree, controller, fieldWrapper, errorBoundary } = bundle.render;
  if (tree === undefined) {
    throw new Error(
      'FormRenderer: в бандле нет дерева — у сборки `createForm` не задана `schema`. ' +
        'Без схемы форму рисуют сами: `<FormField control={bundle.form.поле} />`.'
    );
  }
  const rootMaps = controller.scopeOf(bundle.model as object).__overrideMaps;
  // Обёртка поля: явная настройка рендерера, иначе та, что реестр положил в бандл (JSON).
  const bundleWrapper = fieldWrapper as ComponentType<FieldWrapperProps> | undefined;
  const effectiveSettings: RendererSettings | undefined =
    settings?.fieldWrapper === undefined && bundleWrapper !== undefined
      ? { ...settings, fieldWrapper: bundleWrapper }
      : settings;
  const Boundary = errorBoundary as ComponentType<{ children: ReactNode }> | undefined;

  const content = (
    <FormBundleContext.Provider value={bundle}>
      <RenderContextProvider value={{ settings: effectiveSettings }}>
        <SchemaControllerContext.Provider value={{ controller, rootMaps }}>
          <RenderSchemaOverrideContext.Provider value={rootMaps}>
            <RenderBehaviorEffects effectRegistry={rootMaps.effectRegistry} />
            <RenderNodeComponent node={tree as RenderNode<T>} />
          </RenderSchemaOverrideContext.Provider>
        </SchemaControllerContext.Provider>
      </RenderContextProvider>
    </FormBundleContext.Provider>
  );
  return Boundary ? <Boundary>{content}</Boundary> : content;
}

/**
 * Рендеринг формы: бандл `createForm` либо, для низкоуровневого рендера, функция-схема
 * ({@link RenderSchemaFn} / {@link RenderSchemaProxy}).
 *
 * **Бандл `createForm`** (`form`) — основной путь. Дерево построено сборкой один раз; рендерер
 * ставит контекст сборки (форму и валидацию из него берёт визард), исполняет правила узлов из
 * поведения формы (`hideWhen` / `onComponentEvent` / `onMount`) и даёт строкам массивов и
 * подформам собственные области схемы. Обёртка поля — `settings.fieldWrapper`, иначе та, что
 * положил в бандл реестр (JSON).
 *
 * **Функция-схема** (`render`) — низкоуровневый путь: разворачивает корневой узел и рекурсивно
 * рендерит дерево. Если `render` — прокси из {@link createRenderSchema}, дополнительно монтирует
 * реактивные эффекты (`renderEffect`) и прокидывает карты переопределений через контекст. Так же
 * рендерится прежний бандл `createReactForm`.
 *
 * Явный проп `render` важнее бандла.
 *
 * @typeParam T - Тип значения формы
 * @param props - {@link FormRendererProps}: `form` либо `render`, плюс опц. `settings`
 * @returns React-дерево формы
 *
 * @example Сборка и рендер
 * ```tsx
 * import { createForm, useFormBundle } from '@reformer/core';
 * import { FormRenderer } from '@reformer/renderer-react';
 * import { FormField } from '@reformer/ui-kit';
 *
 * const myForm = useFormBundle(() =>
 *   createForm<MyForm>({
 *     model: createMyModel(),
 *     schema: mySchema, // (model) => RenderNode<MyForm>
 *     behavior: myBehavior,
 *     validation: myValidation,
 *   })
 * );
 *
 * <FormRenderer form={myForm} settings={{ fieldWrapper: FormField }} />
 * ```
 */
export function FormRenderer<T>({ render, form, settings }: FormRendererProps<T>): ReactNode {
  if (!render && isFormRender(form?.render)) {
    return <BundleRenderer bundle={form as unknown as FormBundle<T>} settings={settings} />;
  }

  // Явный проп важнее бандла — тем же правилом живёт JsonFormRenderer.
  const schemaFn = render ?? (form?.render as FormRendererProps<T>['render']);
  if (!schemaFn) {
    throw new Error(
      'FormRenderer: provide either `form` (a createForm bundle) or `render` (a RenderSchemaFn).'
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
