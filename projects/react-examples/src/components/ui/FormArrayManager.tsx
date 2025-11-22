import type { ComponentType } from 'react';
import { Button } from './button';
import type { ArrayNode, FormFields, GroupNodeWithControls } from 'reformer';

interface FormArrayManagerProps {
  // ArrayProxy (из DeepFormStore)
  control: ArrayNode<FormFields>;
  // Компонент для рендера одного элемента массива
  component: ComponentType<{ control: unknown }>;
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
 */
export function FormArrayManager({
  control,
  component: ItemComponent,
  itemLabel = 'Элемент',
  renderTitle,
}: FormArrayManagerProps) {
  // Читаем сигнал length напрямую для триггера ре-рендера при изменении массива
  // Это необходимо для @preact/signals-react - сигнал должен читаться в теле компонента
  const _length = control.length.value;
  void _length; // Подавляем предупреждение о неиспользуемой переменной

  return (
    <>
      {control.map((itemControl: GroupNodeWithControls<FormFields>, index: number) => {
        const title = renderTitle ? renderTitle(index) : `${itemLabel} #${index + 1}`;

        // Используем уникальный id из GroupProxy как key для избежания проблем при удалении
        const key = itemControl.id || index;

        return (
          <div key={key} className="mb-4 p-4 bg-white rounded border">
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
