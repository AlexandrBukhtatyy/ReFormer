/** `Textarea` ui-kit на Taiga UI: многострочное поле. */
import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { TuiError } from '@taiga-ui/core/components/error';
import { TuiTextarea } from '@taiga-ui/kit/components/textarea';
import { KitStringField } from './text-field';

@Component({
  selector: 'div[kitTextarea]',
  imports: [TuiError, TuiTextarea],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'kit-field' },
  template: `
    <tui-textfield
      tuiTextfieldSize="m"
      [invalid]="error() !== undefined"
      [tuiTextfieldCleaner]="false"
    >
      <label tuiLabel [attr.data-testid]="testIdOf('label')">{{ labelText() }}</label>
      <textarea
        tuiTextarea
        [minRows]="rows()"
        [attr.data-testid]="testIdOf('input')"
        [attr.placeholder]="placeholder() ?? null"
        [attr.maxlength]="maxLength() ?? null"
        [value]="text()"
        [disabled]="disabled()"
        [readonly]="readOnly()"
        (input)="write($event)"
        (blur)="blur.emit()"
      ></textarea>
    </tui-textfield>
    @if (error(); as text) {
      <tui-error [attr.data-testid]="testIdOf('error')" [error]="escape(text)" />
    }
  `,
})
export class Textarea extends KitStringField {
  readonly rows = input(3);
  readonly maxLength = input<number>();
}
