/**
 * FormArraySection — переиспользуемый wrapper для FormArray управления.
 *
 * Унифицированный API для TS-flow и renderer-flow:
 * - `control` принимает `FormArrayProxy<T>`, уже-резолвленный `ArrayNode<T>`,
 *   ИЛИ `FieldPathNode` (резолвится через `FieldPathNavigator + extractPath`
 *   когда компонент используется внутри RenderSchema).
 * - `itemComponent` — единственный shape: `ComponentType<{ control: FormProxy<T> }>`.
 *   Никаких node-factory `(itemPath) => RenderNode<T>`.
 *
 * Для renderer-json consumer-ов: `itemComponent: "PropertyForm"` строкой
 * резолвится через registry, `itemComponent: { $template: ... }` оборачивается
 * в FC конвертером — оба варианта на выходе единый FC-shape.
 *
 * Маркер `__selfManagedChildren = true` гарантирует автоинъекцию `form` +
 * `fieldWrapper` от родителя-renderer'а.
 */

/* eslint-disable @typescript-eslint/no-explicit-any */
import { type ComponentType, type ReactNode } from 'react';
import {
  FieldPathNavigator,
  extractPath,
  useFormControl,
  type ArrayNode,
  type FieldPathNode,
  type FormArrayProxy,
  type FormFields,
  type FormProxy,
} from '@reformer/core';
import { FormArray } from '@reformer/cdk/form-array';
import type { FieldWrapperProps } from '@reformer/renderer-react';

export interface FormArraySectionProps<T extends FormFields> {
  /**
   * Резолвится автоматически: уже-резолвленный ArrayNode/FormArrayProxy ИЛИ
   * FieldPathNode (path.<arrayField>) — в этом случае через `form` + navigator.
   */
  control: FormArrayProxy<T> | ArrayNode<T> | FieldPathNode<unknown, unknown> | undefined;

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

const navigator = new FieldPathNavigator();

function resolveArrayNode<T extends FormFields>(
  control: FormArraySectionProps<T>['control'],
  form: FormProxy<unknown> | undefined
): ArrayNode<T> | null {
  if (!control) return null;
  // Already an ArrayNode / FormArrayProxy
  if (
    typeof control === 'object' &&
    typeof (control as ArrayNode<T>).push === 'function' &&
    typeof (control as ArrayNode<T>).removeAt === 'function'
  ) {
    return control as ArrayNode<T>;
  }
  // FieldPathNode → resolve via navigator
  if (!form) {
    if (typeof console !== 'undefined') {
      console.warn(
        '[FormArraySection] control is a FieldPath but no `form` prop available. ' +
          'Ensure this component is rendered inside FormRenderer with form available, ' +
          'or pass form explicitly.'
      );
    }
    return null;
  }
  try {
    const pathStr = extractPath(control as FieldPathNode<unknown, unknown>);
    const node = navigator.getNodeByPath(form, pathStr);
    if (!node) {
      if (typeof console !== 'undefined') {
        console.warn(`[FormArraySection] No ArrayNode at path "${pathStr}".`);
      }
      return null;
    }
    return node as unknown as ArrayNode<T>;
  } catch (err) {
    if (typeof console !== 'undefined') {
      console.warn('[FormArraySection] Failed to resolve control:', err);
    }
    return null;
  }
}

export function FormArraySection<T extends FormFields>({
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
  form,
}: FormArraySectionProps<T>): ReactNode {
  const arrayNode = resolveArrayNode<T>(control, form);

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
