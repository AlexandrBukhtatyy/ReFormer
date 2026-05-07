/* eslint-disable @typescript-eslint/no-explicit-any */
import { type ReactNode, type ComponentType } from 'react';
import {
  FieldPathNavigator,
  createFieldPath,
  extractPath,
  useFormControl,
  type FieldPath,
  type FieldPathNode,
  type FormFields,
  type FormProxy,
  type ArrayNode,
} from '@reformer/core';
import { FormArray } from '@reformer/cdk/form-array';
import {
  RenderNodeComponent,
  type RenderNode,
  type FieldWrapperProps,
} from '@reformer/renderer-react';

export interface RendererFormArraySectionProps<T extends FormFields> {
  control: ArrayNode<T> | FieldPathNode<unknown, unknown>;
  itemComponent: (itemPath: FieldPath<T>) => RenderNode<T>;
  title?: string;
  titleAs?: 'h2' | 'h3' | 'h4';
  titleClassName?: string;
  className?: string;
  cardClassName?: string;
  addButtonLabel?: string;
  removeButtonLabel?: string;
  initialValue?: Partial<FormFields>;
  showRemoveOnSingle?: boolean;
  emptyLabel?: string;
  maxItems?: number;
  form?: FormProxy<unknown>;
  fieldWrapper?: ComponentType<FieldWrapperProps>;
}

const navigator = new FieldPathNavigator();

function resolveArrayNode<T extends FormFields>(
  control: RendererFormArraySectionProps<T>['control'],
  form: FormProxy<unknown> | undefined
): ArrayNode<T> | null {
  if (
    control &&
    typeof control === 'object' &&
    typeof (control as ArrayNode<T>).push === 'function' &&
    typeof (control as ArrayNode<T>).removeAt === 'function'
  ) {
    return control as ArrayNode<T>;
  }
  if (!form) return null;
  try {
    const pathStr = extractPath(control as FieldPathNode<unknown, unknown>);
    const node = navigator.getNodeByPath(form, pathStr);
    return (node as unknown as ArrayNode<T>) ?? null;
  } catch {
    return null;
  }
}

export function RendererFormArraySection<T extends FormFields>({
  control,
  itemComponent,
  title,
  titleAs: TitleTag = 'h3',
  titleClassName = 'text-base font-semibold mb-2',
  className = 'space-y-3 mt-2',
  cardClassName = 'rounded-md border p-4 space-y-3',
  addButtonLabel = '+ Добавить',
  removeButtonLabel = 'Удалить',
  initialValue,
  showRemoveOnSingle = false,
  emptyLabel,
  maxItems,
  form,
  fieldWrapper,
}: RendererFormArraySectionProps<T>): ReactNode {
  const arrayNode = resolveArrayNode<T>(control, form);
  const lengthCtrl = useFormControl(
    (arrayNode ?? undefined) as unknown as Parameters<typeof useFormControl>[0]
  );
  if (!arrayNode) return null;
  const length = (lengthCtrl as unknown as { length?: number } | undefined)?.length ?? 0;
  const atMaxItems = maxItems != null && length >= maxItems;
  return (
    <section className={className}>
      {title ? <TitleTag className={titleClassName}>{title}</TitleTag> : null}
      {length === 0 && emptyLabel ? <p className="text-sm italic">{emptyLabel}</p> : null}
      <FormArray.Root control={arrayNode}>
        <FormArray.List className="space-y-3">
          {({ control: itemForm, index, remove }) => {
            const renderNode = itemComponent(createFieldPath<T>());
            const showRemove = showRemoveOnSingle || length > 1;
            return (
              <div className={cardClassName} data-testid={`array-item-${index}`}>
                <RenderNodeComponent
                  node={renderNode}
                  form={itemForm as unknown as FormProxy<T>}
                  fieldWrapper={fieldWrapper}
                />
                {showRemove ? (
                  <div className="flex justify-end">
                    <button
                      type="button"
                      onClick={remove}
                      data-testid={`array-item-${index}-remove`}
                    >
                      {removeButtonLabel}
                    </button>
                  </div>
                ) : null}
              </div>
            );
          }}
        </FormArray.List>
        {atMaxItems ? null : (
          <div>
            <FormArray.AddButton initialValue={initialValue} data-testid="array-add">
              {addButtonLabel}
            </FormArray.AddButton>
          </div>
        )}
      </FormArray.Root>
    </section>
  );
}

(RendererFormArraySection as any).__selfManagedChildren = true;
