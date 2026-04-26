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
import { createRenderSchemaFromJson } from '../converter/json-to-render-schema';

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
 * import { getReformerForm } from '@reformer/core';
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
 * const registry = defineRegistry((reg) => {
 *   reg.field('Input', Input);
 *   reg.container('Box', ({ children }) => <div>{children}</div>);
 *   reg.container(FIELD_WRAPPER, FormField);
 * });
 *
 * function MyForm() {
 *   const form = useMemo(() => getReformerForm({ email: '' }), []);
 *   return (
 *     <JsonRendererProvider settings={{ registry }}>
 *       <JsonFormRenderer schema={schema} form={form} />
 *     </JsonRendererProvider>
 *   );
 * }
 * ```
 *
 * @see [docs/llms/01-overview.md](../../docs/llms/01-overview.md)
 */
export function JsonFormRenderer<T>({
  schema,
  renderBehavior,
  onSchemaReady,
}: JsonFormRendererProps<T>): ReactNode {
  const { registry, ...rendererSettings } = useJsonRendererSettings();

  const schemaProxy = useMemo(() => {
    const fn = createRenderSchemaFromJson<T>(schema, registry!);
    const proxy = createRenderSchema<T>(fn);
    if (renderBehavior) {
      renderBehavior(proxy);
    }
    return proxy;
  }, [schema, registry, renderBehavior]);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useMemo(() => {
    if (onSchemaReady) onSchemaReady(schemaProxy);
  }, [schemaProxy]);

  return <FormRenderer render={schemaProxy} settings={rendererSettings} />;
}
