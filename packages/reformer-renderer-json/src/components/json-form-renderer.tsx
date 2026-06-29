/**
 * JsonFormRenderer — главный компонент для рендеринга форм из JSON-схемы
 *
 * @module reformer/renderer-json/components
 */

import { useMemo, type ReactNode } from 'react';
import {
  FormRenderer,
  createRenderSchema,
  type RenderBehaviorFn,
  type RenderSchemaProxy,
} from '@reformer/renderer-react';
import type { JsonFormSchema } from '../types/json-schema';
import { useJsonRendererSettings } from '../context/json-renderer-context';
import { createRenderSchemaFromJsonM1 } from '../converter/json-to-render-schema';

/**
 * Props of {@link JsonFormRenderer}.
 *
 * @typeParam T - Тип формы (`getReformerForm<T>()`).
 */
export interface JsonFormRendererProps<T> {
  /** JSON-схема формы. См. {@link JsonFormSchema}. */
  schema: JsonFormSchema;
  /** Опциональный behavior: hideWhen/patchProps/onComponentEvent поверх готовой схемы. */
  renderBehavior?: RenderBehaviorFn<T>;
  /** Колбэк, получающий построенный `RenderSchemaProxy` для внешних манипуляций. */
  onSchemaReady?: (schema: RenderSchemaProxy<T>) => void;
}

/**
 * Главный компонент пакета. Рендерит форму, описанную JSON-схемой.
 *
 * Должен использоваться внутри {@link JsonRendererProvider}, который снабжает рендерер
 * реестром компонентов. Без реестра компонент бросит исключение при попытке резолва.
 *
 * @typeParam T - Тип формы.
 *
 * @example
 * ```tsx
 * import { useMemo } from 'react';
 * import { createForm } from '@reformer/core';
 * import { Input, FormField } from '@reformer/ui-kit';
 * import {
 *   JsonFormRenderer,
 *   JsonRendererProvider,
 *   defineRegistry,
 *   FIELD_WRAPPER,
 *   type JsonFormSchema,
 * } from '@reformer/renderer-json';
 *
 * const schema: JsonFormSchema = {
 *   version: '1.0',
 *   root: {
 *     component: 'Box',
 *     children: [
 *       { selector: 'email', model: 'email', component: 'Input' },
 *     ],
 *   },
 * };
 *
 * type MyForm = { email: string };
 *
 * function MyFormPage() {
 *   // form живёт в page-state и передаётся в registry через closure (см. ниже)
 *   const form = useMemo(() => createForm<MyForm>({
 *     form: { email: { value: '', component: Input, componentProps: { label: 'Email' } } },
 *   }), []);
 *
 *   // registry с FormRoot-closure: компоненты, использующие форму, получают её
 *   // через componentProps closure (JsonFormRenderer НЕ имеет form-prop'а — это by-design,
 *   // т.к. JSON-схема статична, а форма runtime).
 *   const registry = useMemo(() => defineRegistry((reg) => {
 *     reg.field('Input', Input);
 *     reg.container('Box', ({ children }) => <div>{children}</div>);
 *     reg.container(FIELD_WRAPPER, FormField);
 *   }), []);
 *
 *   return (
 *     <JsonRendererProvider settings={{ registry, form }}>
 *       <JsonFormRenderer schema={schema} />
 *     </JsonRendererProvider>
 *   );
 * }
 * ```
 *
 * **Note**: `JsonFormRenderer` принимает ТОЛЬКО `{ schema, renderBehavior?, onSchemaReady? }`.
 * Под M1 модель (`FormModel`) передаётся через {@link JsonRendererProvider} settings (`model`);
 * листья JSON-схемы биндятся к её сигналам конвертером `convertJsonToM1Tree`.
 *
 * @see [docs/llms/01-overview.md](../../docs/llms/01-overview.md)
 */
export function JsonFormRenderer<T>({
  schema,
  renderBehavior,
  onSchemaReady,
}: JsonFormRendererProps<T>): ReactNode {
  const { registry, model, ...rendererSettings } = useJsonRendererSettings();

  const schemaProxy = useMemo(() => {
    // M1 (единая схема): листья биндятся к сигналам модели. Модель обязательна (legacy
    // FieldPath-конвертер удалён в Ф7) — передаётся через JsonRendererProvider settings.
    if (!model) {
      throw new Error(
        'JsonFormRenderer: settings.model is required (M1). Pass the FormModel via JsonRendererProvider.'
      );
    }
    const fn = createRenderSchemaFromJsonM1<T>(schema, registry!, model);
    const proxy = createRenderSchema<T>(fn);
    if (renderBehavior) {
      renderBehavior(proxy);
    }
    return proxy;
  }, [schema, registry, renderBehavior, model]);

  useMemo(() => {
    if (onSchemaReady) onSchemaReady(schemaProxy);
  }, [schemaProxy]);

  return <FormRenderer render={schemaProxy} settings={rendererSettings} />;
}
