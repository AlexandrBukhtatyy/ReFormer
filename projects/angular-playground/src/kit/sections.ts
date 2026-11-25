/**
 * Секции и массивы кита на Taiga UI: карточка секции с кнопками `tuiButton` и testid
 * DOM-контракта (`btn-add-{path}`, `btn-remove-{path}-{index}`).
 */
import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { ReformerArrayItem, type ArrayItemSlot } from '@reformer/renderer-angular';
import { TuiButton } from '@taiga-ui/core/components/button';

/** Секция шага с заголовком: вложенная группа полей или условная часть шага. */
@Component({
  selector: 'section[kitSection]',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'cross-section' },
  template: `<h3 class="cross-section__title">{{ title() }}</h3>
    <div class="cross-section__body"><ng-content /></div>`,
})
export class Section {
  readonly title = input.required<string>();
}

/**
 * Контейнер без своей разметки: корень части документа (адрес, строка массива) — поля стоят прямо
 * в секции. Хост компонента в разметке остаётся, но в раскладке не участвует.
 */
@Component({
  selector: 'kit-group',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { style: 'display: contents' },
  template: '<ng-content />',
})
export class Group {}

/**
 * Массив под-форм. Строки и их ключи отдаёт рендерер (`items`), компонент только оформляет их и
 * зовёт `onAdd` / `onRemove`; строку рисует директива `reformerArrayItem`. Путь DOM-контракта поля
 * строки (`properties-0-type`) рендерер выводит из живого пути поля в модели — он следует за
 * индексом строки.
 */
@Component({
  selector: 'section[kitArraySection]',
  imports: [ReformerArrayItem, TuiButton],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'cross-section' },
  template: `
    <h3 class="cross-section__title">{{ title() }}</h3>
    <div class="cross-section__body">
      @for (item of items(); track item.key) {
        <div class="cross-row">
          <div class="cross-row__head">
            <span class="cross-row__title">{{ rowTitle() }} {{ item.index + 1 }}</span>
            <button
              tuiButton
              type="button"
              appearance="secondary"
              size="s"
              [attr.data-testid]="'btn-remove-' + path() + '-' + item.index"
              (click)="onRemove()(item.index)"
            >
              Удалить
            </button>
          </div>
          <ng-container [reformerArrayItem]="item" />
        </div>
      }
      <button
        tuiButton
        type="button"
        appearance="secondary"
        size="m"
        class="cross-add"
        [attr.data-testid]="'btn-add-' + path()"
        (click)="onAdd()()"
      >
        {{ addLabel() }}
      </button>
    </div>
  `,
})
export class ArraySection {
  readonly items = input<readonly ArrayItemSlot[]>([]);
  readonly onAdd = input.required<() => void>();
  readonly onRemove = input.required<(index: number) => void>();
  /** Перестановки у формы нет; вход объявлен, чтобы колбэк не лёг слушателем на хост. */
  readonly onMove = input<(from: number, to: number) => void>();
  /** Путь массива DOM-контракта: `properties`. */
  readonly path = input.required<string>();
  readonly title = input.required<string>();
  /** Заголовок строки: «{rowTitle} {номер}». */
  readonly rowTitle = input.required<string>();
  readonly addLabel = input.required<string>();
}
