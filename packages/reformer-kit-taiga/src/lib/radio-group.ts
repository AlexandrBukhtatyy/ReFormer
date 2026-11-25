/**
 * `RadioGroup` ui-kit на Taiga UI: группа радиокнопок по `options` на зеркале поля. Каждая кнопка —
 * нативный `<input type="radio">` с ролью `input-{id}-{значение}`; `input-{id}` — на элементе
 * группы.
 */
import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { ReactiveFormsModule } from '@angular/forms';
import { TuiError } from '@taiga-ui/core/components/error';
import { TuiLabel } from '@taiga-ui/core/components/label';
import { TuiRadio } from '@taiga-ui/core/components/radio';
import { KitMirrorField, type Option } from './field';

@Component({
  selector: 'div[kitRadioGroup]',
  imports: [ReactiveFormsModule, TuiError, TuiLabel, TuiRadio],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'kit-field' },
  template: `
    <div
      role="radiogroup"
      class="kit-radio-group"
      [class.kit-radio-group--horizontal]="orientation() === 'horizontal'"
      [attr.aria-labelledby]="labelId()"
      [attr.data-testid]="testIdOf('input')"
      (focusout)="leave($event)"
    >
      <span class="kit-radio-group__label" [id]="labelId()" [attr.data-testid]="testIdOf('label')">
        {{ labelText() }}
      </span>
      @for (option of options(); track option.value) {
        <label tuiLabel>
          <input
            type="radio"
            tuiRadio
            [name]="groupName()"
            [attr.name]="groupName()"
            [value]="option.value"
            [attr.data-testid]="testIdOf('input', option.value)"
            [formControl]="mirror"
          />
          {{ option.label }}
        </label>
      }
    </div>
    @if (error(); as text) {
      <tui-error [attr.data-testid]="testIdOf('error')" [error]="escape(text)" />
    }
  `,
})
export class RadioGroup extends KitMirrorField<unknown> {
  /** Имя группы из схемы; без него — идентификатор поля. */
  readonly name = input<string>();
  readonly options = input<readonly Option[]>([]);
  readonly orientation = input<'horizontal' | 'vertical'>('vertical');

  protected readonly groupName = computed(() => this.name() ?? this.id() ?? 'radio-group');
  protected readonly labelId = computed(() => `radio-label-${this.groupName()}`);

  /** Уход фокуса из группы: событие `blur` кнопок не всплывает, переход между ними — не уход. */
  protected leave(event: FocusEvent): void {
    const group = event.currentTarget as HTMLElement;
    if (!group.contains(event.relatedTarget as Node | null)) this.blur.emit();
  }
}
