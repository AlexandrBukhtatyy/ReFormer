/**
 * JsonFormApp — компактная обёртка closure pattern (G3-iter15 cookbook recipe).
 *
 * `JsonFormRenderer` НЕ принимает form prop by-design (JSON статичен, форма runtime).
 * Эта обёртка скрывает boilerplate: FormRoot.__selfManagedChildren,
 * createRenderSchemaFromJson, createRenderSchema, FormRenderer wiring.
 *
 * **iter-16 deviation from cookbook**: cookbook recipe uses `registry.clone()` to add
 * FormRoot to a passed-in registry, but `ComponentRegistry.clone()` does NOT exist
 * in the actual API. Workaround: caller must register `FormRoot` themselves OR pass
 * an already-extended registry. Here we accept the registry as-is and rely on caller
 * having registered FormRoot. (Logged as gap g-clone-missing.)
 */
import { useMemo, type ReactNode, type ComponentType } from 'react';
import type { FormProxy } from '@reformer/core';
import {
  FormRenderer,
  RenderNodeComponent,
  createRenderSchema,
  type RenderNode,
} from '@reformer/renderer-react';
import {
  createRenderSchemaFromJson,
  type JsonFormSchema,
  type ComponentRegistry,
} from '@reformer/renderer-json';

// FormRoot принимает form через componentProps closure и пробрасывает в children.
export function FormRoot<T>({
  form,
  children,
}: {
  form: FormProxy<T>;
  children?: RenderNode<T>[];
}): ReactNode {
  return (
    <>
      {children?.map((node, i) => (
        <RenderNodeComponent key={i} node={node} form={form} />
      ))}
    </>
  );
}
// Маркер для converter — не итерировать children сам, FormRoot управляет ими.
(FormRoot as unknown as { __selfManagedChildren: boolean }).__selfManagedChildren = true;

interface JsonFormAppProps<T> {
  schema: JsonFormSchema;
  form: FormProxy<T>;
  registry: ComponentRegistry;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  fieldWrapper?: ComponentType<any>;
}

export function JsonFormApp<T>({
  schema,
  form,
  registry,
  fieldWrapper,
}: JsonFormAppProps<T>): ReactNode {
  const renderSchema = useMemo(() => {
    const baseFn = createRenderSchemaFromJson<T>(schema, registry);
    // Wrap to inject form into the FormRoot's componentProps
    const fnWithForm = (path: Parameters<typeof baseFn>[0]) => {
      const base = baseFn(path);
      return {
        ...base,
        componentProps: { ...(base.componentProps ?? {}), form },
      };
    };
    return createRenderSchema<T>(fnWithForm);
  }, [schema, registry, form]);

  return <FormRenderer render={renderSchema} settings={{ fieldWrapper }} />;
}
