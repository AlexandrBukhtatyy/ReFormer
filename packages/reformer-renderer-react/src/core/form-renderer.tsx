/**
 * FormRenderer - компонент для декларативного рендеринга формы
 *
 * @module reformer/renderer-react/form-renderer
 */

import { useMemo, type ComponentType, type ReactNode } from 'react';
import {
  compileSchema,
  type FormBundle,
  type FormRender,
  type FormSchemaNode,
} from '@reformer/core';
import { FormBundleContext } from '@reformer/core/react';
import type {
  FieldWrapperProps,
  FormRendererProps,
  RenderSchemaFn,
  RendererSettings,
} from './types';
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
 * Сборка уровня формы прежнего пути (`createReactForm`, `createJsonForm`): форма, модель и
 * методы уровня формы — то, что визард читает из контекста (`form`, `flow`, `submit`).
 */
const isFormLevel = (value: unknown): boolean =>
  value != null &&
  typeof value === 'object' &&
  'form' in value &&
  'model' in value &&
  typeof (value as { submit?: unknown }).submit === 'function';

// Функция-схема прежнего бандла → сам бандл: `<FormRenderer render={bundle.render} />` тоже
// ставит контекст сборки, хотя бандл пропом не передан.
const levelOfRender = new WeakMap<object, object>();

/**
 * Связать функцию-схему прежнего бандла с ним самим — чтобы `FormRenderer` с одним `render`
 * поставил контекст сборки (визард берёт из него форму, поток и отправку).
 *
 * @internal
 */
export function attachFormLevel(render: object, level: object): void {
  levelOfRender.set(render, level);
}

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
            <RenderNodeComponent node={tree.root} />
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
 * import { createForm } from '@reformer/core';
 * import { useFormBundle } from '@reformer/core/react';
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
  const content = <SchemaFnRenderer schemaFn={schemaFn} settings={settings} />;
  // Прежний бандл несёт уровень формы — он идёт в контекст, как у бандла `createForm`: без него
  // визард в схеме не видит потока и отправляет без проверки.
  const level = isFormLevel(form) ? form : levelOfRender.get(schemaFn);
  return level ? (
    <FormBundleContext.Provider value={level as unknown as FormBundle<T>}>
      {content}
    </FormBundleContext.Provider>
  ) : (
    content
  );
}

/**
 * Рендер по функции-схеме: дерево строится и компилируется при первом рендере и дальше берётся из
 * памяти — до смены самой функции.
 */
function SchemaFnRenderer<T>({
  schemaFn,
  settings,
}: {
  schemaFn: RenderSchemaFn<T>;
  settings: RendererSettings | undefined;
}): ReactNode {
  const compiled = useMemo(() => compileSchema(schemaFn() as FormSchemaNode), [schemaFn]);

  const inner: ReactNode = (
    <RenderContextProvider value={{ settings }}>
      {isRenderSchemaProxy(schemaFn) && schemaFn.__overrideMaps.effectRegistry.length > 0 && (
        <RenderBehaviorEffects effectRegistry={schemaFn.__overrideMaps.effectRegistry} />
      )}
      <RenderNodeComponent node={compiled.root} />
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
