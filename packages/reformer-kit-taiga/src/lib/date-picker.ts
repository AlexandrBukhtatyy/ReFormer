/**
 * `DatePicker` ui-kit на Taiga UI: нативный `type="date"` в поле Taiga. Значение остаётся строкой
 * `YYYY-MM-DD` — как у поля даты в модели формы.
 */
import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { TuiError } from '@taiga-ui/core/components/error';
import { TuiInput } from '@taiga-ui/core/components/input';
import { KitStringField, TEXT_FIELD } from './text-field';

@Component({
  selector: 'div[kitDatePicker]',
  imports: [TuiError, TuiInput],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'kit-field' },
  template: TEXT_FIELD,
})
export class DatePicker extends KitStringField {
  /** Формат показа даты ui-kit; нативное поле показывает дату по локали браузера. */
  readonly dateFormat = input<string>();

  protected override inputType(): string {
    return 'date';
  }
}
