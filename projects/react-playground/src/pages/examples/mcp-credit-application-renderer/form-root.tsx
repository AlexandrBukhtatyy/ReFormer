import { RenderNodeComponent } from '@reformer/renderer-react';
import type { RenderNode } from '@reformer/renderer-react';
import type { FormProxy } from '@reformer/core';
import type { CreditApplicationForm } from './types';

// ─── FormRoot ────────────────────────────────────────────────────────────────
// User-defined root container. Receives `form` via componentProps and forwards
// it to each child via RenderNodeComponent — this is the mandatory wiring that
// makes field-nodes visible inside FormRenderer.

export interface FormRootProps {
  form: FormProxy<CreditApplicationForm>;
  children: RenderNode<CreditApplicationForm>[];
}

export function FormRoot({ form, children }: FormRootProps) {
  return (
    <>
      {children.map((child, i) => (
        <RenderNodeComponent key={i} node={child} form={form} />
      ))}
    </>
  );
}

// MARKER: tells RenderNodeComponent to pass raw RenderNode[] children instead of
// auto-rendering them. Without this, FormRoot receives already-rendered ReactNode
// children and `children.map(child => <RenderNodeComponent node={child}/>)` blows up
// because `child` is a React element, not a RenderNode.
// See packages/reformer-renderer-react/src/core/render-node.tsx::__selfManagedChildren.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
(FormRoot as any).__selfManagedChildren = true;
