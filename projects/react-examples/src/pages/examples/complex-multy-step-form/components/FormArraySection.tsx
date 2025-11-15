/**
 * FormArraySection - Переиспользуемый компонент для управления массивами форм
 *
 * Устраняет дублирование кода при работе с ArrayNode.
 * Используется для properties, existingLoans, coBorrowers и т.д.
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

import type { ArrayNodeWithControls, GroupNodeWithControls } from 'reformer';
import type { ComponentType } from 'react';
import { FormArrayManager } from '@/components/ui/FormArrayManager';
import { Button } from '@/components/ui/button';

interface FormArraySectionProps<T extends object> {
  /** Заголовок секции */
  title: string;

  /** ArrayNode контроллер */
  control: ArrayNodeWithControls<T> | undefined;

  /** Компонент элемента массива */
  itemComponent: ComponentType<{ control: GroupNodeWithControls<T> }>;

  /** Метка для элемента (используется в FormArrayManager) */
  itemLabel: string;

  /** Текст кнопки добавления */
  addButtonLabel: string;

  /** Сообщение при пустом массиве */
  emptyMessage: string;

  /** Флаг отображения секции */
  hasItems: boolean;

  /** Дополнительное сообщение под emptyMessage (опционально) */
  emptyMessageHint?: string;
}

export function FormArraySection<T extends object>({
  title,
  control,
  itemComponent,
  itemLabel,
  addButtonLabel,
  emptyMessage,
  hasItems,
  emptyMessageHint,
}: FormArraySectionProps<T>) {
  // Не показываем секцию, если hasItems === false
  if (!hasItems || !control) {
    return null;
  }

  const isEmpty = control.length.value === 0;

  return (
    <div className="p-4 bg-gray-50 rounded-lg border border-gray-200">
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-lg font-semibold">{title}</h3>
        <Button onClick={() => control.push()}>{addButtonLabel}</Button>
      </div>

      <FormArrayManager control={control} component={itemComponent} itemLabel={itemLabel} />

      {isEmpty && (
        <div className="p-4 bg-gray-100 border border-gray-300 rounded text-center text-gray-600">
          {emptyMessage}
          {emptyMessageHint && <div className="mt-2 text-xs text-gray-500">{emptyMessageHint}</div>}
        </div>
      )}
    </div>
  );
}
