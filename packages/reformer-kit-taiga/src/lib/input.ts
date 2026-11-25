/** `Input` ui-kit на Taiga UI: однострочное текстовое поле; `type` — тип нативного элемента. */
import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { TuiError } from '@taiga-ui/core/components/error';
import { TuiInput } from '@taiga-ui/core/components/input';
import { KitStringField, TEXT_FIELD } from './text-field';

@Component({
  selector: 'div[kitInput]',
  imports: [TuiError, TuiInput],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'kit-field' },
  template: TEXT_FIELD,
})
export class Input extends KitStringField {
  readonly type = input('text');

  protected override inputType(): string {
    return this.type();
  }
}
