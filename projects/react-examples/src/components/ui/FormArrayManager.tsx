import { useSignal } from '@preact/signals-react';
import { useSignals } from '@preact/signals-react/runtime';
import type { ComponentType } from 'react';
import { Button } from './button';

interface FormArrayManagerProps {
  // ArrayProxy (из DeepFormStore)
  control: any;
  // Компонент для рендера одного элемента массива
  component: ComponentType<{ control: any }>;
  // Название элемента для заголовка (например, "Имущество", "Кредит", "Созаемщик")
  itemLabel?: string;
  // Кастомная функция для генерации заголовка (принимает индекс)
  renderTitle?: (index: number) => string;
}

/**
 * Компонент для управления массивами форм
 *
 * Использует ArrayProxy.map() для итерации по элементам массива.
 * Работает с DeepFormStore через ArrayProxy.
 * Отвечает за отрисовку обертки с заголовком и кнопкой удаления.
 *
 * @example
 * <FormArrayManager
 *   control={form.controls.properties}
 *   component={PropertyForm}
 *   itemLabel="Имущество"
 * />
 *
 * // PropertyForm получит только пропс:
 * // - control: GroupProxy элемента массива
 */
export function FormArrayManager({
  control,
  component: ItemComponent,
  itemLabel = 'Элемент',
  renderTitle,
}: FormArrayManagerProps) {
  // ArrayProxy имеет метод map, который возвращает массив proxy элементов
  return (
    <>
      {control.map((itemControl: any, index: number) => {
        const title = renderTitle ? renderTitle(index) : `${itemLabel} #${index + 1}`;

        // Используем уникальный ID из GroupProxy как key для избежания проблем при удалении
        // const key = itemControl._id || index;

        return (
          <div key={index} className="mb-4 p-4 bg-white rounded border">
            <div className="flex justify-between items-center mb-3">
              <h4 className="font-medium">{title}</h4>
              <Button onClick={() => control.removeAt(index)}>Удалить</Button>
            </div>

            <ItemComponent control={itemControl} />
          </div>
        );
      })}
    </>
  );
}
