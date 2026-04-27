import type { FormProxy } from '@reformer/core';
import type { RenderNode } from '@reformer/renderer-react';
import { RenderNodeComponent } from '@reformer/renderer-react';

interface FormRootProps<T> {
  form: FormProxy<T>;
  children: RenderNode<T>[];
}

export function FormRoot<T>({ form, children }: FormRootProps<T>) {
  return (
    <div className="space-y-6">
      {children.map((node, i) => (
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        <RenderNodeComponent key={i} node={node as RenderNode<any>} form={form as FormProxy<any>} />
      ))}
    </div>
  );
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
(FormRoot as any).__selfManagedChildren = true;
