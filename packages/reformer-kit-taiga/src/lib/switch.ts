/** `Switch` ui-kit на Taiga UI: переключатель с подписью на зеркале поля; значение — `boolean`. */
import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { ReactiveFormsModule } from '@angular/forms';
import { TuiError } from '@taiga-ui/core/components/error';
import { TuiLabel } from '@taiga-ui/core/components/label';
import { TuiSwitch } from '@taiga-ui/kit/components/switch';
import { KitMirrorField } from './field';

@Component({
  selector: 'div[kitSwitch]',
  imports: [ReactiveFormsModule, TuiError, TuiLabel, TuiSwitch],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'kit-field' },
  template: `
    <label tuiLabel [attr.data-testid]="testIdOf('label')">
      <input
        type="checkbox"
        tuiSwitch
        [showIcons]="false"
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
export class Switch extends KitMirrorField<boolean> {
  /** Размер переключателя ui-kit; у поля кита он один. */
  readonly size = input<string>();
}
