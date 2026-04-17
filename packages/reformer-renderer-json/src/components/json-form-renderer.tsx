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

export interface JsonFormRendererProps<T> {
  schema: JsonFormSchema;
  renderBehavior?: RenderBehaviorFn<T>;
  onSchemaReady?: (schema: RenderSchemaProxy<T>) => void;
}

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
