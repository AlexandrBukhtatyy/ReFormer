/**
 * `FieldArray` ui-kit на Taiga UI: строки массива под-форм с кнопками «Добавить», «Удалить» и
 * перестановкой.
 *
 * Строки и их ключи отдаёт рендерер (`items`), компонент оформляет их и зовёт `onAdd` /
 * `onRemove` / `onMove`; поддерево строки рисует директива `reformerArrayItem`. Роли — как у
 * массива ui-kit: `array-add`, `array-item-{i}`, `array-item-{i}-remove`,
 * `array-item-{i}-move-up`, `array-item-{i}-move-down`.
 *
 * Колбэки — входы, а не выходы: у `onMove` два аргумента, а выход Angular несёт одно значение.
 */
import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { ReformerArrayItem, type ArrayItemSlot } from '@reformer/renderer-angular';
import { TuiButton } from '@taiga-ui/core/components/button';

type ItemLabel = string | ((model: unknown, index: number) => string);

@Component({
  selector: 'section[kitFieldArray]',
  imports: [ReformerArrayItem, TuiButton],
  changeDetection: ChangeDetectionStrategy.OnPush,
  // `data-slot` — как у ui-kit: по корню секции массив находят, когда их на шаге несколько.
  host: { '[class]': 'classes()', 'data-slot': 'field-array' },
  template: `
    @if (title(); as text) {
      <h3 class="kit-section__title">{{ text }}</h3>
    }
    @for (item of items(); track item.key; let position = $index) {
      <div [class]="rowClasses()" [attr.data-testid]="'array-item-' + item.index">
        @if (showLabel() || showRemove() || reorderable()) {
          <div class="kit-array__head">
            <span class="kit-array__label">{{ showLabel() ? labelOf(item) : '' }}</span>
            <div class="kit-actions">
              @if (reorderable() && onMove()) {
                <button
                  tuiButton
                  type="button"
                  appearance="secondary"
                  size="xs"
                  aria-label="Выше"
                  [disabled]="position === 0"
                  [attr.data-testid]="'array-item-' + item.index + '-move-up'"
                  (click)="move(item.index, -1)"
                >
                  ↑
                </button>
                <button
                  tuiButton
                  type="button"
                  appearance="secondary"
                  size="xs"
                  aria-label="Ниже"
                  [disabled]="position === items().length - 1"
                  [attr.data-testid]="'array-item-' + item.index + '-move-down'"
                  (click)="move(item.index, 1)"
                >
                  ↓
                </button>
              }
              @if (showRemove()) {
                <button
                  tuiButton
                  type="button"
                  appearance="secondary"
                  size="xs"
                  [attr.data-testid]="'array-item-' + item.index + '-remove'"
                  (click)="onRemove()(item.index)"
                >
                  {{ removeButtonLabel() }}
                </button>
              }
            </div>
          </div>
        }
        <ng-container [reformerArrayItem]="item" />
      </div>
    }
    @if (items().length === 0 && emptyMessage()) {
      <p class="kit-array__empty">
        {{ emptyMessage() }}
        @if (emptyMessageHint(); as hint) {
          <small>{{ hint }}</small>
        }
      </p>
    }
    @if (!atMax()) {
      <button
        tuiButton
        type="button"
        appearance="secondary"
        size="s"
        class="kit-array__add"
        data-testid="array-add"
        (click)="onAdd()()"
      >
        {{ addButtonLabel() }}
      </button>
    }
  `,
})
export class FieldArray {
  readonly items = input<readonly ArrayItemSlot[]>([]);
  readonly onAdd = input.required<() => void>();
  readonly onRemove = input.required<(index: number) => void>();
  readonly onMove = input<(from: number, to: number) => void>();
  readonly title = input<string>();
  /** Подпись строки: «{itemLabel} #{номер}»; функция получает модель строки и индекс. */
  readonly itemLabel = input<ItemLabel>();
  readonly addButtonLabel = input('Добавить');
  readonly removeButtonLabel = input('Удалить');
  readonly emptyMessage = input<string>();
  readonly emptyMessageHint = input<string>();
  readonly reorderable = input(false);
  readonly showRemoveOnSingle = input(false);
  readonly minItems = input<number>();
  readonly maxItems = input<number>();
  readonly className = input<string>();
  readonly cardClassName = input<string>();

  protected readonly classes = computed(() =>
    ['kit-array', 'kit-stack', this.className()].join(' ').trim()
  );
  protected readonly rowClasses = computed(() =>
    ['kit-array__row', 'kit-stack', this.cardClassName()].join(' ').trim()
  );
  protected readonly atMax = computed(() => {
    const max = this.maxItems();
    return max != null && this.items().length >= max;
  });
  protected readonly showRemove = computed(() => {
    const min = this.minItems();
    const length = this.items().length;
    return min != null ? length > min : this.showRemoveOnSingle() || length > 1;
  });
  protected readonly showLabel = computed(() => Boolean(this.title() || this.itemLabel()));

  protected labelOf(item: ArrayItemSlot): string {
    const label = this.itemLabel();
    if (typeof label === 'function') return label(item.model, item.index);
    return `${label ?? this.title() ?? 'Элемент'} #${item.index + 1}`;
  }

  protected move(index: number, shift: number): void {
    this.onMove()?.(index, index + shift);
  }
}
