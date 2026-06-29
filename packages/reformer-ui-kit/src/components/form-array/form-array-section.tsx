/**
 * FormArraySection — переиспользуемый wrapper для FormArray управления.
 *
 * `control` принимает `FormArrayProxy<T>` или уже-резолвленный `ArrayNode<T>`/`ModelArrayNode<T>`
 * (M1). `itemComponent` — единственный shape: `ComponentType<{ control: FormProxy<T> }>`.
 *
 * Маркер `__selfManagedChildren = true` гарантирует автоинъекцию `form` +
 * `fieldWrapper` от родителя-renderer'а.
 */

/* eslint-disable @typescript-eslint/no-explicit-any */
import { type ComponentType, type ReactNode } from 'react';
import {
  useFormControl,
  type ArrayNode,
  type FormArrayProxy,
  type FormProxy,
} from '@reformer/core';
import { FormArray } from '@reformer/cdk/form-array';
import type { FieldWrapperProps } from '@reformer/renderer-react';

export interface FormArraySectionProps<T extends object> {
  /** Уже-резолвленный ArrayNode/ModelArrayNode/FormArrayProxy. */
  control: FormArrayProxy<T> | ArrayNode<T> | undefined;

  /** React FC получает `control: FormProxy<T>` для каждого элемента. */
  itemComponent: ComponentType<{ control: FormProxy<T> }>;

  /** Заголовок секции (рендерится h3). */
  title?: string;

  /** Метка для каждого item — строка-префикс или функция. */
  itemLabel?: string | ((control: FormProxy<T>, index: number) => string);

  /** Текст кнопки добавления. По умолчанию `'+ Добавить'`. */
  addButtonLabel?: string;

  /** Текст кнопки удаления. По умолчанию `'Удалить'`. */
  removeButtonLabel?: string;

  /** Сообщение пустого состояния. */
  emptyMessage?: string;

  /** Подсказка под пустым состоянием. */
  emptyMessageHint?: string;

  /**
   * Условие видимости секции. Если `false` — секция полностью скрыта.
   * Удобно для toggle-чекбоксов вида «У меня есть имущество».
   */
  hasItems?: boolean;

  /**
   * Plain-leaf значения для новых items (передаётся в `FormArray.AddButton`).
   * НЕ FieldConfig — только примитивы по форме item-типа `T`.
   *
   * Тип `Partial<T>` — TS проверит, что initialValue совместим с типом элемента.
   * Передавайте generic явно для лучшей type-safety:
   * `<FormArraySection<PropertyItem> initialValue={createPropertyItem()} ...>`.
   */
  initialValue?: Partial<T>;

  /** Показывать «Удалить» когда остался один элемент. По умолчанию `false`. */
  showRemoveOnSingle?: boolean;

  /** Максимум items — AddButton отключается при достижении. */
  maxItems?: number;

  /** Внешний className секции. */
  className?: string;

  /** Класс card-обёртки каждого item. */
  cardClassName?: string;

  /**
   * FormProxy. Авто-инъектится `RenderNodeComponent` через
   * `__selfManagedChildren` маркер. Передавать вручную — только при
   * использовании вне стандартного render-tree.
   */
  form?: FormProxy<unknown>;

  /**
   * Field wrapper для дочерних полей. Авто-инъектится `RenderNodeComponent`;
   * переопределить для использования другого wrapper в этой секции.
   */
  fieldWrapper?: ComponentType<FieldWrapperProps>;
}

function resolveArrayNode<T extends object>(
  control: FormArraySectionProps<T>['control']
): ArrayNode<T> | null {
  if (!control) return null;
  // ArrayNode / ModelArrayNode / FormArrayProxy — распознаём по array-методам.
  if (
    typeof control === 'object' &&
    typeof (control as ArrayNode<T>).push === 'function' &&
    typeof (control as ArrayNode<T>).removeAt === 'function'
  ) {
    return control as ArrayNode<T>;
  }
  if (typeof console !== 'undefined') {
    console.warn('[FormArraySection] control is not an ArrayNode/FormArrayProxy.');
  }
  return null;
}

export function FormArraySection<T extends object>({
  control,
  itemComponent: ItemComponent,
  title,
  itemLabel,
  addButtonLabel = '+ Добавить',
  removeButtonLabel = 'Удалить',
  emptyMessage,
  emptyMessageHint,
  hasItems,
  initialValue,
  showRemoveOnSingle = false,
  maxItems,
  className = 'space-y-3 mt-2',
  cardClassName = 'mb-4 p-4 bg-white rounded border',
}: FormArraySectionProps<T>): ReactNode {
  const arrayNode = resolveArrayNode<T>(control);

  // Subscribe to length so add/remove triggers re-render of empty/full state.
  // Hook is called unconditionally; for missing arrayNode we pass a no-op
  // signal-like sentinel and ignore the result.
  const lengthCtrl = useFormControl(
    (arrayNode ?? undefined) as unknown as Parameters<typeof useFormControl>[0]
  );

  if (hasItems === false) return null;
  if (!arrayNode) return null;

  const length = (lengthCtrl as unknown as { length?: number } | undefined)?.length ?? 0;
  const atMaxItems = maxItems != null && length >= maxItems;

  const getItemLabel = (control: FormProxy<T>, index: number): string =>
    typeof itemLabel === 'function'
      ? itemLabel(control, index)
      : `${itemLabel ?? title ?? 'Элемент'} #${index + 1}`;

  return (
    <FormArray.Root control={arrayNode}>
      <section className={className}>
        {title ? (
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-lg font-semibold">{title}</h3>
            {atMaxItems ? null : (
              <FormArray.AddButton
                initialValue={initialValue}
                data-testid="array-add"
                className="inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 bg-primary text-primary-foreground shadow hover:bg-primary/90 h-9 px-4 py-2"
              >
                {addButtonLabel}
              </FormArray.AddButton>
            )}
          </div>
        ) : null}

        <FormArray.List className="space-y-3">
          {({ control: itemForm, index, remove }) => {
            const showRemove = showRemoveOnSingle || length > 1;
            return (
              <div className={cardClassName} data-testid={`array-item-${index}`}>
                {title || itemLabel ? (
                  <div className="flex justify-between items-center mb-3">
                    <h4 className="font-medium">
                      {getItemLabel(itemForm as unknown as FormProxy<T>, index)}
                    </h4>
                    {showRemove ? (
                      <button
                        type="button"
                        onClick={remove}
                        data-testid={`array-item-${index}-remove`}
                        className="inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 bg-destructive text-destructive-foreground shadow hover:bg-destructive/90 h-9 px-4 py-2"
                      >
                        {removeButtonLabel}
                      </button>
                    ) : null}
                  </div>
                ) : null}
                <ItemComponent control={itemForm as unknown as FormProxy<T>} />
              </div>
            );
          }}
        </FormArray.List>

        {length === 0 && emptyMessage ? (
          <FormArray.Empty>
            <div className="p-4 bg-gray-100 border border-gray-300 rounded text-center text-gray-600">
              {emptyMessage}
              {emptyMessageHint && (
                <div className="mt-2 text-xs text-gray-500">{emptyMessageHint}</div>
              )}
            </div>
          </FormArray.Empty>
        ) : null}

        {/* If no title is provided, render the AddButton as a footer. */}
        {!title && !atMaxItems ? (
          <div>
            <FormArray.AddButton
              initialValue={initialValue}
              data-testid="array-add"
              className="text-sm text-blue-600 hover:text-blue-700 hover:underline"
            >
              {addButtonLabel}
            </FormArray.AddButton>
          </div>
        ) : null}
      </section>
    </FormArray.Root>
  );
}

// Маркер для интеграции с RenderNodeComponent — компонент сам управляет
// рендером своих children (items), родитель только пробрасывает `form`.
(FormArraySection as any).__selfManagedChildren = true;
