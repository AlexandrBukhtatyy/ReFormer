/** `InputPassword` ui-kit на Taiga UI: поле пароля. */
import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { TuiError } from '@taiga-ui/core/components/error';
import { TuiInput } from '@taiga-ui/core/components/input';
import { KitStringField, TEXT_FIELD } from './text-field';

@Component({
  selector: 'div[kitInputPassword]',
  imports: [TuiError, TuiInput],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'kit-field' },
  template: TEXT_FIELD,
})
export class InputPassword extends KitStringField {
  readonly autoComplete = input('current-password');
  /** Кнопка «показать пароль» ui-kit; поле кита всегда скрывает ввод. */
  readonly showToggle = input(false);

  protected override inputType(): string {
    return 'password';
  }

  protected override autocomplete(): string | null {
    return this.autoComplete();
  }
}
