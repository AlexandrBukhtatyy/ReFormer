/**
 * FormArraySection - Переиспользуемый компонент для управления массивами форм
 *
 * Устраняет дублирование кода при работе с ArrayNode.
 * Используется для properties, existingLoans, coBorrowers и т.д.
 *
 * Использует headless FormArray compound component для построения UI.
 *
 * @template T Тип элемента массива
 *
 * @example
 * ```tsx
 * <FormArraySection
 *   title="Имущество"
 *   control={control.properties}
 *   itemComponent={PropertyForm}
 *   itemLabel="Имущество"
 *   addButtonLabel="+ Добавить имущество"
 *   emptyMessage="Нажмите для добавления информации об имуществе"
 *   hasItems={hasProperty}
 * />
 * ```
 */

import type { FormArrayProxy, FormFields, FormProxy } from '@reformer/core';
import type { ComponentType } from 'react';
import { FormArray } from '@reformer/ui/form-array';

export interface FormArraySectionProps<T extends object> {
  /** Заголовок секции */
  title: string;

  /** ArrayNode контроллер */
  control: FormArrayProxy<FormFields> | undefined;

  /** Компонент элемента массива */
  itemComponent: ComponentType<{ control: FormProxy<T> }>;

  /** Метка для элемента */
  itemLabel: string | ((control: FormProxy<T>, index: number) => string);

  /** Текст кнопки добавления */
  addButtonLabel: string;

  /** Сообщение при пустом массиве */
  emptyMessage: string;

  /** Дополнительное сообщение под emptyMessage (опционально) */
  emptyMessageHint?: string;

  /** Условие видимости секции (если false — секция скрыта) */
  hasItems?: boolean;
}

export function FormArraySection<T extends object>({
  title,
  control,
  itemComponent: ItemComponent,
  itemLabel,
  addButtonLabel,
  emptyMessage,
  emptyMessageHint,
  hasItems,
}: FormArraySectionProps<T>) {
  if (hasItems === false) return null;
  const getItemLabel = (control: FormProxy<T>, index: number) => {
    return typeof itemLabel === 'function'
      ? itemLabel(control, index)
      : `${itemLabel} #${index + 1}`;
  };

  return (
    <FormArray.Root control={control}>
      <div className="p-4 bg-gray-50 rounded-lg border border-gray-200">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-semibold">{title}</h3>
          <FormArray.AddButton className="inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 bg-primary text-primary-foreground shadow hover:bg-primary/90 h-9 px-4 py-2">
            {addButtonLabel}
          </FormArray.AddButton>
        </div>

        <FormArray.List>
          {({ control: itemControl, index }) => (
            <div className="mb-4 p-4 bg-white rounded border">
              <div className="flex justify-between items-center mb-3">
                <h4 className="font-medium">{getItemLabel(itemControl, index)}</h4>
                <FormArray.RemoveButton className="inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 bg-primary text-primary-foreground shadow hover:bg-primary/90 h-9 px-4 py-2">
                  Удалить
                </FormArray.RemoveButton>
              </div>
              <ItemComponent control={itemControl as FormProxy<T>} />
            </div>
          )}
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
