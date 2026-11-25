/** `Checkbox` ui-kit на Taiga UI: флажок с подписью на зеркале поля; значение формы — `boolean`. */
import { ChangeDetectionStrategy, Component } from '@angular/core';
import { ReactiveFormsModule } from '@angular/forms';
import { TuiCheckbox } from '@taiga-ui/core/components/checkbox';
import { TuiError } from '@taiga-ui/core/components/error';
import { TuiLabel } from '@taiga-ui/core/components/label';
import { KitMirrorField } from './field';

@Component({
  selector: 'div[kitCheckbox]',
  imports: [ReactiveFormsModule, TuiCheckbox, TuiError, TuiLabel],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'kit-field' },
  template: `
    <label tuiLabel [attr.data-testid]="testIdOf('label')">
      <input
        type="checkbox"
        tuiCheckbox
        [attr.data-testid]="testIdOf('input')"
        [formControl]="mirror"
        (blur)="blur.emit()"
      />
      {{ labelText() }}
    </label>
    @if (error(); as text) {
      <tui-error [attr.data-testid]="testIdOf('error')" [error]="escape(text)" />
    }
  `,
})
export class Checkbox extends KitMirrorField<boolean> {}
