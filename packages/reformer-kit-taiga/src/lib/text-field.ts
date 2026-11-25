/**
 * Текстовое поле Taiga UI, привязанное к полю формы: основа `Input`, `InputPassword`, `InputMask`,
 * `InputNumber` и `DatePicker`.
 *
 * Текстовое поле Taiga работает без форм Angular: значение — `[value]` и событие `input` нативного
 * элемента, вид ошибки — вход `invalid` поля. Нативный `<input>` пишет сам адаптер, поэтому
 * `input-{id}` стоит прямо на нём.
 */
import { Directive, computed, input, output, type Signal } from '@angular/core';
import { KitField } from './field';

/** Шаблон текстового поля: подпись внутри поля, ошибка под ним — только когда она есть. */
export const TEXT_FIELD = `
  <tui-textfield
    tuiTextfieldSize="m"
    [invalid]="error() !== undefined"
    [tuiTextfieldCleaner]="false"
  >
    <label tuiLabel [attr.data-testid]="testIdOf('label')">{{ labelText() }}</label>
    <input
      tuiInput
      [attr.data-testid]="testIdOf('input')"
      [type]="inputType()"
      [attr.inputmode]="inputMode"
      [attr.autocomplete]="autocomplete()"
      [attr.placeholder]="placeholder() ?? null"
      [attr.min]="limits().min"
      [attr.max]="limits().max"
      [attr.step]="limits().step"
      [value]="text()"
      [disabled]="disabled()"
      [readonly]="readOnly()"
      (input)="write($event)"
      (blur)="blur.emit()"
    />
  </tui-textfield>
  @if (error(); as text) {
    <tui-error [attr.data-testid]="testIdOf('error')" [error]="escape(text)" />
  }
`;

/** Границы числового поля; у остальных — пусто. */
export interface Limits {
  min?: number;
  max?: number;
  step?: number;
}

/** Основа текстового контрола: подсказка и «только чтение». */
@Directive()
export abstract class KitTextField extends KitField {
  readonly placeholder = input<string>();
  /** Только чтение — его ставит и схема, и поведение формы. */
  readonly readOnly = input(false);

  protected readonly inputMode: string | null = null;

  /** Текст в поле. */
  protected abstract readonly text: Signal<string>;
  /** Ввод пользователя. */
  protected abstract write(event: Event): void;

  protected inputType(): string {
    return 'text';
  }

  protected autocomplete(): string | null {
    return null;
  }

  protected limits(): Limits {
    return {};
  }
}

/** Текстовый контрол со строковым значением — диалект `[(value)]`. */
@Directive()
export abstract class KitStringField extends KitTextField {
  readonly value = input<unknown>();
  readonly valueChange = output<string>();

  protected readonly text = computed(() => {
    const value = this.value();
    return value == null ? '' : String(value);
  });

  protected write(event: Event): void {
    this.valueChange.emit((event.target as HTMLInputElement | HTMLTextAreaElement).value);
  }
}
