/**
 * FieldArraySection — переиспользуемый wrapper для FieldArray управления.
 *
 * `control` принимает ноду массива под-форм — `FormArray<T>` (`form.<массив>`).
 * `itemComponent` — единственный shape: `ComponentType<{ control: FormGroup<T> }>`.
 *
 * Маркер `__selfManagedChildren = true` гарантирует автоинъекцию `form` +
 * `fieldWrapper` от родителя-renderer'а.
 */

/* eslint-disable @typescript-eslint/no-explicit-any */
import { type ComponentType, type ReactNode } from 'react';
import { type FormArray, type FormGroup } from '@reformer/core';
import { useFormControl } from '@reformer/core/react';
import { FieldArray } from '@reformer/cdk/field-array';
import { useKitMessages } from '@/i18n/messages';

/**
 * Props обёртки поля. Объявлены здесь СВОИ, а не импортированы из `@reformer/renderer-react`:
 * ui-kit не зависит от рендерера. Структурно совпадает с `FieldWrapperProps` рендерера —
 * TS сматчит их по форме, когда рендерер инъектит сюда свой wrapper.
 */
export interface FieldWrapperProps {
  /** Контрол поля. */
  control: any;
  /** CSS-класс. */
  className?: string;
  /** Отрендеренный input. */
  children: ReactNode;
  /** testId для генерации `data-testid` на wrapper/label/error. */
  testId?: string;
}

/**
 * Пропсы {@link FieldArraySection}.
 *
 * @typeParam T - Тип одного элемента массива (object).
 */
export interface FieldArraySectionProps<T extends object> {
  /** Узел массива формы (`form.<массив>`). */
  control: FormArray<T> | undefined;

  /** React FC получает `control: FormGroup<T>` для каждого элемента. */
  itemComponent: ComponentType<{ control: FormGroup<T> }>;

  /** Заголовок секции (рендерится h3). */
  title?: string;

  /** Метка для каждого item — строка-префикс или функция. */
  itemLabel?: string | ((control: FormGroup<T>, index: number) => string);

  /**
   * Текст кнопки добавления. По умолчанию — из словаря локали.
   * @defaultMessage kit.fieldArray.add
   */
  addButtonLabel?: string;

  /**
   * Текст кнопки удаления. По умолчанию — из словаря локали.
   * @defaultMessage kit.fieldArray.remove
   */
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
   * Запасной шаблон нового item (передаётся в `FieldArray.AddButton`). Основной путь — шаблон
   * массива в модели, `arrayOf(blank)` из `@reformer/core`: тогда проп не нужен.
   *
   * Plain-leaf значения, НЕ FieldConfig — только примитивы по форме item-типа `T`.
   *
   * Тип `Partial<T>` — TS проверит, что initialValue совместим с типом элемента.
   * Передавайте generic явно для лучшей type-safety:
   * `<FieldArraySection<PropertyItem> initialValue={createPropertyItem()} ...>`.
   */
  initialValue?: Partial<T>;

  /** Показывать «Удалить» когда остался один элемент. По умолчанию `false`. */
  showRemoveOnSingle?: boolean;

  /**
   * Показывать кнопки ↑/↓ для перестановки элементов. По умолчанию `false`
   * (обратная совместимость — существующие массивы не меняются).
   */
  reorderable?: boolean;

  /** Максимум items — AddButton отключается при достижении. */
  maxItems?: number;

  /** Внешний className секции. */
  className?: string;

  /** Класс card-обёртки каждого item. */
  cardClassName?: string;

  /**
   * FormGroup. Авто-инъектится `RenderNodeComponent` через
   * `__selfManagedChildren` маркер. Передавать вручную — только при
   * использовании вне стандартного render-tree.
   */
  form?: FormGroup<unknown>;

  /**
   * Field wrapper для дочерних полей. Авто-инъектится `RenderNodeComponent`;
   * переопределить для использования другого wrapper в этой секции.
   */
  fieldWrapper?: ComponentType<FieldWrapperProps>;
}

function resolveArrayNode<T extends object>(
  control: FieldArraySectionProps<T>['control'],
  hasRendererSeam = false
): FormArray<T> | null {
  if (!control) {
    // Молчать здесь дорого: без `control` секция возвращает null, и в JSON-схеме это выглядит
    // как «массив просто не отрисовался» — ни ошибки, ни предупреждения. Самая частая причина
    // ровно одна: под `$component(FieldArray)` зарегистрировали ЭТОТ компонент вместо `FieldArray`.
    // Признак — рендерер прислал свой seam (items/onAdd), а `control` не пришёл вовсе.
    if (typeof console !== 'undefined') {
      console.warn(
        hasRendererSeam
          ? '[FieldArraySection] control не передан, зато пришли items/onAdd — похоже, компонент ' +
              'зарегистрирован в JSON-реестре. Для renderer-json нужен FieldArray: ' +
              "reg.component('FieldArray', FieldArray) из @reformer/ui-kit/field-array."
          : '[FieldArraySection] control не передан — секция не отрисована.'
      );
    }
    return null;
  }
  // Узел массива распознаём по array-методам.
  if (
    typeof control === 'object' &&
    typeof control.push === 'function' &&
    typeof control.removeAt === 'function'
  ) {
    return control;
  }
  if (typeof console !== 'undefined') {
    console.warn('[FieldArraySection] control is not a FormArray.');
  }
  return null;
}

/**
 * Готовая UI-секция для динамического массива форм — стилизованная обёртка поверх
 * headless-compound `@reformer/cdk/field-array`. Рендерит заголовок, кнопку
 * «Добавить», карточку с меткой на каждый элемент (плюс опциональные кнопки
 * удаления и перестановки ↑/↓) и сообщение пустого состояния.
 *
 * `control` принимает ноду массива под-форм — `FormArray<T>`
 * (`form.<массив>`). `itemComponent` — единственная форма
 * рендера элемента: `ComponentType<{ control: FormGroup<T> }>` (тот же контракт,
 * что у шага {@link FormWizardStep}). Внутри `RenderNodeComponent` проп `form`
 * инъектится автоматически (маркер `__selfManagedChildren`).
 *
 * Проп `hasItems` удобен для toggle-чекбоксов («У меня есть имущество»): при
 * `false` секция скрывается целиком.
 *
 * **Не для renderer-json.** Там массив описывается array-нодой, а компонент получает от
 * рендерера seam `items`/`onAdd`/`onRemove`/`onMove` — под `$component(FieldArray)` нужен
 * {@link FieldArray}. Если зарегистрировать сюда `FieldArraySection`, `control` не придёт
 * и секция вернёт `null` (в dev это теперь сопровождается предупреждением в консоли).
 *
 * @typeParam T - Тип одного элемента массива (object).
 *
 * @example Массив «Имущество» под чекбоксом-переключателем
 * ```tsx
 * import { FieldArraySection } from '@reformer/ui-kit/field-array';
 *
 * function AdditionalInfo({ control }: { control: FormGroup<CreditApplication> }) {
 *   const hasProperty = useFormControlValue(control.hasProperty) as boolean;
 *   return (
 *     <FieldArraySection
 *       title="Имущество"
 *       control={control.properties}
 *       itemComponent={PropertyForm}
 *       itemLabel="Имущество"
 *       addButtonLabel="+ Добавить имущество"
 *       emptyMessage='Нажмите "Добавить имущество" для добавления информации'
 *       hasItems={hasProperty}
 *       reorderable
 *     />
 *   );
 * }
 * ```
 */
export function FieldArraySection<T extends object>({
  control,
  itemComponent: ItemComponent,
  title,
  itemLabel,
  addButtonLabel,
  removeButtonLabel,
  emptyMessage,
  emptyMessageHint,
  hasItems,
  initialValue,
  showRemoveOnSingle = false,
  reorderable = false,
  maxItems,
  className = 'space-y-3 mt-2',
  cardClassName = 'mb-4 p-4 bg-card text-card-foreground rounded border',
  ...rest
}: FieldArraySectionProps<T>): ReactNode {
  const t = useKitMessages();
  // Seam рендерера (`items`/`onAdd`) в пропах этого компонента не объявлен: его получает
  // `FieldArray`. Пришёл — значит компонент подставлен вместо `FieldArray` в JSON-реестре.
  const hasRendererSeam = 'items' in rest || 'onAdd' in rest;
  const arrayNode = resolveArrayNode<T>(control, hasRendererSeam);

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

  const getItemLabel = (control: FormGroup<T>, index: number): string =>
    typeof itemLabel === 'function'
      ? itemLabel(control, index)
      : `${itemLabel ?? title ?? t('kit.fieldArray.item')} #${index + 1}`;

  return (
    <FieldArray.Root control={arrayNode}>
      <section className={className} data-slot="field-array-section">
        {title ? (
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-lg font-semibold">{title}</h3>
            {atMaxItems ? null : (
              <FieldArray.AddButton
                initialValue={initialValue}
                data-testid="array-add"
                className="inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 bg-primary text-primary-foreground shadow hover:bg-primary/90 h-9 px-4 py-2"
              >
                {addButtonLabel ?? t('kit.fieldArray.add')}
              </FieldArray.AddButton>
            )}
          </div>
        ) : null}

        <FieldArray.List className="space-y-3">
          {({ control: itemForm, index, remove, moveUp, moveDown, canMoveUp, canMoveDown }) => {
            const showRemove = showRemoveOnSingle || length > 1;
            return (
              <div className={cardClassName} data-testid={`array-item-${index}`}>
                {title || itemLabel ? (
                  <div className="flex justify-between items-center mb-3">
                    <h4 className="font-medium">
                      {getItemLabel(itemForm as unknown as FormGroup<T>, index)}
                    </h4>
                    <div className="flex items-center gap-2">
                      {reorderable ? (
                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            onClick={moveUp}
                            disabled={!canMoveUp}
                            aria-label={t('kit.fieldArray.moveUp')}
                            data-testid={`array-item-${index}-move-up`}
                            className="inline-flex items-center justify-center rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-40 border border-input bg-background shadow-sm hover:bg-accent hover:text-accent-foreground h-9 w-9"
                          >
                            ↑
                          </button>
                          <button
                            type="button"
                            onClick={moveDown}
                            disabled={!canMoveDown}
                            aria-label={t('kit.fieldArray.moveDown')}
                            data-testid={`array-item-${index}-move-down`}
                            className="inline-flex items-center justify-center rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-40 border border-input bg-background shadow-sm hover:bg-accent hover:text-accent-foreground h-9 w-9"
                          >
                            ↓
                          </button>
                        </div>
                      ) : null}
                      {showRemove ? (
                        <button
                          type="button"
                          onClick={remove}
                          data-testid={`array-item-${index}-remove`}
                          className="inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 bg-destructive text-destructive-foreground shadow hover:bg-destructive/90 h-9 px-4 py-2"
                        >
                          {removeButtonLabel ?? t('kit.fieldArray.remove')}
                        </button>
                      ) : null}
                    </div>
                  </div>
                ) : null}
                <ItemComponent control={itemForm as unknown as FormGroup<T>} />
              </div>
            );
          }}
        </FieldArray.List>

        {length === 0 && emptyMessage ? (
          <FieldArray.Empty>
            <div className="p-4 bg-muted border rounded text-center text-muted-foreground">
              {emptyMessage}
              {emptyMessageHint && (
                <div className="mt-2 text-xs text-muted-foreground/80">{emptyMessageHint}</div>
              )}
            </div>
          </FieldArray.Empty>
        ) : null}

        {/* If no title is provided, render the AddButton as a footer. */}
        {!title && !atMaxItems ? (
          <div>
            <FieldArray.AddButton
              initialValue={initialValue}
              data-testid="array-add"
              className="text-sm text-primary hover:text-primary/80 hover:underline"
            >
              {addButtonLabel ?? t('kit.fieldArray.add')}
            </FieldArray.AddButton>
          </div>
        ) : null}
      </section>
    </FieldArray.Root>
  );
}

// Маркер для интеграции с RenderNodeComponent — компонент сам управляет
// рендером своих children (items), родитель только пробрасывает `form`.
(FieldArraySection as any).__selfManagedChildren = true;
