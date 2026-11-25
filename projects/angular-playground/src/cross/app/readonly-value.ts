/**
 * Вычисляемое значение — компонент приложения, а не кита: подпись и `<output>`, контрола нет.
 * Роль DOM-контракта — `computed-{path}`.
 */
import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

@Component({
  selector: 'div[appReadonlyValue]',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'cross-readonly' },
  template: `
    <span class="cross-readonly__label" [id]="labelId()">{{ label() }}</span>
    <output [attr.aria-labelledby]="labelId()" [attr.data-testid]="'computed-' + path()">{{
      text()
    }}</output>
  `,
})
export class ReadonlyValue {
  /** Путь DOM-контракта: `computed-{path}`. */
  readonly path = input.required<string>();
  readonly label = input.required<string>();
  /** Уже вычисленное значение; числа выводятся без разделителей разрядов. */
  readonly value = input<string | number | null | undefined>();

  protected readonly labelId = computed(() => `computed-label-${this.path()}`);
  protected readonly text = computed(() => {
    const value = this.value();
    return value == null ? '' : String(value);
  });
}
