import type { ReactNode } from 'react';
import type { ArrayNode, FieldPath, FormProxy } from '@reformer/core';
import { extractPath, createFieldPath, FieldPathNavigator } from '@reformer/core';
import { FormArray } from '@reformer/cdk/form-array';
import { RenderNodeComponent, useRenderContext } from '@reformer/renderer-react';
import type { RenderNode } from '@reformer/renderer-react';

const navigator = new FieldPathNavigator();

export interface RendererFormArraySectionProps<T extends object> {
  title: string;
  /** FieldPath к полю массива (path.properties, path.existingLoans и т.д.) */
  array: unknown;
  itemLabel: string | ((control: FormProxy<T>, index: number) => string);
  addButtonLabel: string;
  emptyMessage: string;
  emptyMessageHint?: string;
  /** Функция, возвращающая RenderNode для элемента массива */
  itemComponent: (itemPath: FieldPath<T>) => RenderNode<T>;
}

export function RendererFormArraySection<T extends object>({
  title,
  array,
  itemLabel,
  addButtonLabel,
  emptyMessage,
  emptyMessageHint,
  itemComponent,
}: RendererFormArraySectionProps<T>): ReactNode {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { form, settings } = useRenderContext<any>();
  const fieldWrapper = settings?.fieldWrapper;

  const arrayPath = extractPath(array);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const arrayNode = navigator.getNodeByPath(form, arrayPath) as ArrayNode<any> | null;

  if (!arrayNode || !arrayNode.map) {
    console.warn(`[RendererFormArraySection] Array node not found at path: "${arrayPath}"`);
    return null;
  }

  const getItemLabel = (control: FormProxy<T>, index: number): string =>
    typeof itemLabel === 'function' ? itemLabel(control, index) : `${itemLabel} #${index + 1}`;

  return (
    <FormArray.Root control={arrayNode}>
      <div className="p-4 bg-gray-50 rounded-lg border border-gray-200">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-semibold">{title}</h3>
          <FormArray.AddButton className="inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 bg-primary text-primary-foreground shadow hover:bg-primary/90 h-9 px-4 py-2">
            {addButtonLabel}
          </FormArray.AddButton>
        </div>

        <FormArray.List>
          {({ control: itemControl, index }) => {
            const itemPath = createFieldPath<T>();
            const itemNode = itemComponent(itemPath);
            return (
              <div className="mb-4 p-4 bg-white rounded border">
                <div className="flex justify-between items-center mb-3">
                  <h4 className="font-medium">
                    {getItemLabel(itemControl as FormProxy<T>, index)}
                  </h4>
                  <FormArray.RemoveButton className="inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 bg-primary text-primary-foreground shadow hover:bg-primary/90 h-9 px-4 py-2">
                    Удалить
                  </FormArray.RemoveButton>
                </div>
                <RenderNodeComponent
                  node={itemNode}
                  form={itemControl as FormProxy<T>}
                  path={itemPath}
                  fieldWrapper={fieldWrapper}
                />
              </div>
            );
          }}
        </FormArray.List>

        <FormArray.Empty>
          <div className="p-4 bg-gray-100 border border-gray-300 rounded text-center text-gray-600">
            {emptyMessage}
            {emptyMessageHint && (
              <div className="mt-2 text-xs text-gray-500">{emptyMessageHint}</div>
            )}
          </div>
        </FormArray.Empty>
      </div>
    </FormArray.Root>
  );
}
