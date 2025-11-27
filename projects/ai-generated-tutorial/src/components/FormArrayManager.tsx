import type { ComponentType } from 'react';
import { useFormControl, type ArrayNode, type FormFields, type GroupNodeWithControls } from 'reformer';
import { Button } from '@/components/ui/button';

interface FormArrayManagerProps {
  control: ArrayNode<FormFields>;
  component: ComponentType<{ control: GroupNodeWithControls<FormFields> }>;
  itemLabel?: string;
  addButtonLabel?: string;
  emptyMessage?: string;
}

export function FormArrayManager({
  control,
  component: ItemComponent,
  itemLabel = 'Item',
  addButtonLabel = '+ Add',
  emptyMessage = 'No items yet. Click the button above to add one.',
}: FormArrayManagerProps) {
  const { length } = useFormControl(control);

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <span className="text-sm text-muted-foreground">
          {length} {itemLabel}(s)
        </span>
        <Button type="button" variant="outline" size="sm" onClick={() => control.push()}>
          {addButtonLabel}
        </Button>
      </div>

      {control.map((itemControl: GroupNodeWithControls<FormFields>, index: number) => {
        const key = itemControl.id || index;

        return (
          <div key={key} className="p-4 bg-white rounded-lg border border-gray-200 shadow-sm">
            <div className="flex justify-between items-center mb-4">
              <h4 className="font-medium text-gray-900">
                {itemLabel} #{index + 1}
              </h4>
              <Button
                type="button"
                variant="destructive"
                size="sm"
                onClick={() => control.removeAt(index)}
              >
                Remove
              </Button>
            </div>

            <ItemComponent control={itemControl} />
          </div>
        );
      })}

      {length === 0 && (
        <div className="p-6 bg-gray-50 border border-dashed border-gray-300 rounded-lg text-center text-gray-500">
          {emptyMessage}
        </div>
      )}
    </div>
  );
}
