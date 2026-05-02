/**
 * Compatibility shim for iter-7 v7 pages.
 *
 * Real implementation lives in `@reformer/ui-kit/form-array` as
 * `FormArraySection` (Path C unified API — single FC `itemComponent` prop).
 *
 * v7 consumers were written before Path C and pass an `itemComponent` of shape
 * `(itemPath: FieldPath<T>) => RenderNode<T>` (node-factory). This shim
 * adapts that shape to the new `ComponentType<{ control: FormProxy<T> }>` API
 * by:
 *   1. Calling the factory once with a synthetic `itemPath` to get the
 *      RenderNode subtree.
 *   2. Wrapping that subtree in an FC that renders via `RenderNodeComponent`
 *      with `form={control}`.
 *
 * After v7 pages are rewritten to the new FC-shape (separate iteration), this
 * shim can be deleted.
 */

import { type ComponentType, type ReactNode } from 'react';
import { createFieldPath, type FieldPath, type FormFields, type FormProxy } from '@reformer/core';
import { RenderNodeComponent, type RenderNode } from '@reformer/renderer-react';
import {
  FormArraySection,
  type FormArraySectionProps as UiKitProps,
} from '@reformer/ui-kit/form-array';

type LegacyItemFactory<T> = (itemPath: FieldPath<T>) => RenderNode<T>;

export interface RendererFormArraySectionProps<T extends FormFields> extends Omit<
  UiKitProps<T>,
  'itemComponent'
> {
  /**
   * Legacy node-factory API. Path C ui-kit consumers should pass FC directly
   * via `FormArraySection.itemComponent` from `@reformer/ui-kit/form-array`.
   */
  itemComponent: LegacyItemFactory<T>;
}

export function RendererFormArraySection<T extends FormFields>(
  props: RendererFormArraySectionProps<T>
): ReactNode {
  const { itemComponent: legacyFactory, ...rest } = props;

  // Pre-call the factory once with a synthetic itemPath; the resulting
  // RenderNode tree is rendered against each item's FormProxy via
  // RenderNodeComponent. The FC identity is stable, preventing re-renders.
  const itemPath = createFieldPath<T>();
  const itemRenderNode = legacyFactory(itemPath);

  const ItemFC: ComponentType<{ control: FormProxy<T> }> = Object.assign(
    ({ control }: { control: FormProxy<T> }) => (
      <RenderNodeComponent node={itemRenderNode} form={control} />
    ),
    { displayName: 'LegacyItemFC' }
  );

  return <FormArraySection<T> {...rest} itemComponent={ItemFC} />;
}

// Forward the self-managed marker so the renderer keeps injecting form/fieldWrapper.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
(RendererFormArraySection as any).__selfManagedChildren = true;
