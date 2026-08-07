/**
 * FormArray — editable-секция массива для renderer-json (`$component(FormArray)`).
 *
 * Редактируемый двойник {@link List}: элементы приходят **уже отрендеренными** в пропе `items`
 * (`{ key, index, model, children }`), а FormArray добавляет хром — заголовок, кнопку «Добавить»,
 * карточку с меткой на элемент, кнопки удаления и (опц.) перестановки ↑/↓. Мутации массива идут
 * через колбэки `onAdd`/`onRemove`/`onMove`, поэтому компонент не знает ни про модель, ни про
 * рендерер: итерация, подписка и кэш — на вызывающей стороне.
 *
 * `data-testid` (`array-add`, `array-item-N`, `-remove`, `-move-up/down`) — стабильный публичный
 * контракт: на них завязаны e2e-тесты. Отличается от `FormArraySection` тем, что рассчитан на
 * рендерер (`items` из схемы), а не на headless-контрол `@reformer/cdk/form-array`.
 */
import type { ReactNode } from 'react';
import type { ArrayComponentProps, ArrayItemSlot } from '@/lib/array-slot';

export interface FormArrayProps extends ArrayComponentProps {
  /** Отрендеренные элементы массива (инъектится рендерером). */
  items?: ArrayItemSlot[];
  /** Добавить элемент (инъектится рендерером; значение резолвится из `initialValue` узла). */
  onAdd?: () => void;
  /** Удалить элемент по индексу (инъектится рендерером). */
  onRemove?: (index: number) => void;
  /** Переместить элемент (инъектится рендерером). Нужен при `reorderable`. */
  onMove?: (from: number, to: number) => void;
  /** Заголовок секции (h3). */
  title?: string;
  /** Метка элемента — префикс-строка или функция `(model, index) => string`. */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  itemLabel?: string | ((model: any, index: number) => string);
  /** Текст кнопки добавления. По умолчанию `'+ Добавить'`. */
  addButtonLabel?: string;
  /** Текст кнопки удаления. По умолчанию `'Удалить'`. */
  removeButtonLabel?: string;
  /** Сообщение пустого состояния. */
  emptyMessage?: string;
  /** Подсказка под пустым состоянием. */
  emptyMessageHint?: string;
  /** Кнопки ↑/↓ перестановки. По умолчанию `false`. */
  reorderable?: boolean;
  /** Показывать «Удалить» когда остался один элемент. По умолчанию `false`. */
  showRemoveOnSingle?: boolean;
  /** Внешний className секции. */
  className?: string;
  /** Класс card-обёртки элемента. */
  cardClassName?: string;
}

const ADD_BTN =
  'inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 bg-primary text-primary-foreground shadow hover:bg-primary/90 h-9 px-4 py-2';
const REMOVE_BTN =
  'inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 bg-destructive text-destructive-foreground shadow hover:bg-destructive/90 h-9 px-4 py-2';
const MOVE_BTN =
  'inline-flex items-center justify-center rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-40 border border-input bg-background shadow-sm hover:bg-accent hover:text-accent-foreground h-9 w-9';

export function FormArray({
  items = [],
  onAdd,
  onRemove,
  onMove,
  title,
  itemLabel,
  addButtonLabel = '+ Добавить',
  removeButtonLabel = 'Удалить',
  emptyMessage,
  emptyMessageHint,
  reorderable = false,
  showRemoveOnSingle = false,
  className = 'space-y-3 mt-2',
  cardClassName = 'mb-4 p-4 bg-card text-card-foreground rounded border',
}: FormArrayProps): ReactNode {
  const length = items.length;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const getItemLabel = (model: any, index: number): string =>
    typeof itemLabel === 'function'
      ? itemLabel(model, index)
      : `${(itemLabel as string) ?? title ?? 'Элемент'} #${index + 1}`;

  const addBtn = (cls: string) => (
    <button type="button" data-testid="array-add" className={cls} onClick={onAdd}>
      {addButtonLabel}
    </button>
  );

  return (
    <section className={className} data-slot="form-array">
      {title ? (
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-semibold">{title}</h3>
          {addBtn(ADD_BTN)}
        </div>
      ) : null}

      {items.map((it) => {
        const showRemove = showRemoveOnSingle || length > 1;
        return (
          <div key={it.key} className={cardClassName} data-testid={`array-item-${it.index}`}>
            {title || itemLabel ? (
              <div className="flex justify-between items-center mb-3">
                <h4 className="font-medium">{getItemLabel(it.model, it.index)}</h4>
                <div className="flex items-center gap-2">
                  {reorderable ? (
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        aria-label="Переместить вверх"
                        data-testid={`array-item-${it.index}-move-up`}
                        className={MOVE_BTN}
                        disabled={it.index === 0}
                        onClick={() => onMove?.(it.index, it.index - 1)}
                      >
                        ↑
                      </button>
                      <button
                        type="button"
                        aria-label="Переместить вниз"
                        data-testid={`array-item-${it.index}-move-down`}
                        className={MOVE_BTN}
                        disabled={it.index === length - 1}
                        onClick={() => onMove?.(it.index, it.index + 1)}
                      >
                        ↓
                      </button>
                    </div>
                  ) : null}
                  {showRemove ? (
                    <button
                      type="button"
                      data-testid={`array-item-${it.index}-remove`}
                      className={REMOVE_BTN}
                      onClick={() => onRemove?.(it.index)}
                    >
                      {removeButtonLabel}
                    </button>
                  ) : null}
                </div>
              </div>
            ) : null}
            {it.children}
          </div>
        );
      })}

      {length === 0 && emptyMessage ? (
        <div className="p-4 bg-muted border rounded text-center text-muted-foreground">
          {emptyMessage}
          {emptyMessageHint ? (
            <div className="mt-2 text-xs text-muted-foreground/80">{emptyMessageHint}</div>
          ) : null}
        </div>
      ) : null}

      {!title ? (
        <div>{addBtn('text-sm text-primary hover:text-primary/80 hover:underline')}</div>
      ) : null}
    </section>
  );
}
