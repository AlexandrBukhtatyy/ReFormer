import { useMemo, type ComponentType, type ReactNode } from 'react';
import type { FormProxy } from '@reformer/core';
import {
  FormRenderer,
  RenderNodeComponent,
  createRenderSchema,
  type RenderNode,
  type FieldWrapperProps,
} from '@reformer/renderer-react';
import {
  defineRegistry,
  createRenderSchemaFromJson,
  type JsonFormSchema,
  type RegistryBuilder,
} from '@reformer/renderer-json';

// FormRoot — accepts form via componentProps (closure injected by createMyFormSchema)
// and forwards to children via RenderNodeComponent.
function FormRoot<T>({
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
// Marker telling the converter not to recursively wrap children — FormRoot manages them.
(FormRoot as unknown as { __selfManagedChildren: boolean }).__selfManagedChildren = true;

interface JsonFormAppProps<T> {
  schema: JsonFormSchema;
  form: FormProxy<T>;
  /** Callback for registering field/container/source components. FormRoot is added automatically. */
  buildRegistry: (reg: RegistryBuilder) => void;
  fieldWrapper?: ComponentType<FieldWrapperProps>;
}

export function JsonFormApp<T>({
  schema,
  form,
  buildRegistry,
  fieldWrapper,
}: JsonFormAppProps<T>): ReactNode {
  const registry = useMemo(
    () =>
      defineRegistry((reg) => {
        buildRegistry(reg);
        reg.container('FormRoot', FormRoot as ComponentType<unknown>);
      }),
    [buildRegistry]
  );

  const renderSchema = useMemo(() => {
    const fn = createRenderSchemaFromJson<T>(schema, registry);
    // Wrap to inject `form` into root container componentProps.
    const wrapped = (path: Parameters<typeof fn>[0]) => {
      const rootNode = fn(path);
      return {
        ...rootNode,
        componentProps: { ...(rootNode.componentProps ?? {}), form },
      };
    };
    return createRenderSchema<T>(wrapped);
  }, [schema, registry, form]);

  return (
    <FormRenderer
      render={renderSchema}
      settings={fieldWrapper ? { fieldWrapper } : undefined}
    />
  );
}
