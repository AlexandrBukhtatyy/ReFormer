/**
 * `InputNumber` ui-kit на Taiga UI: нативный `type="number"` в поле Taiga. Значение формы — число
 * либо `null`. Поле числа Taiga (`tuiInputNumber`) не берётся: оно форматирует значение
 * разделителями разрядов.
 *
 * Поле держит набранный текст, пока он означает то же число, что в форме: иначе «1.50» посреди
 * ввода схлопнулось бы в «1.5». Значение, записанное в форму извне, вытесняет текст.
 */
import { ChangeDetectionStrategy, Component, computed, input, output, signal } from '@angular/core';
import { TuiError } from '@taiga-ui/core/components/error';
import { TuiInput } from '@taiga-ui/core/components/input';
import { KitTextField, TEXT_FIELD, type Limits } from './text-field';

/** Текст числового поля → число формы: пустое и нечисловое — `null`. */
function parseNumber(text: string): number | null {
  if (text.trim() === '') return null;
  const parsed = Number(text);
  return Number.isFinite(parsed) ? parsed : null;
}

@Component({
  selector: 'div[kitInputNumber]',
  imports: [TuiError, TuiInput],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'kit-field' },
  template: TEXT_FIELD,
})
export class InputNumber extends KitTextField {
  readonly value = input<number | null | undefined>(null);
  readonly valueChange = output<number | null>();
  readonly min = input<number>();
  readonly max = input<number>();
  readonly step = input<number>();

  private readonly typed = signal('');

  protected readonly text = computed(() => {
    const value = this.value() ?? null;
    const typed = this.typed();
    return parseNumber(typed) === value ? typed : String(value ?? '');
  });

  protected override inputType(): string {
    return 'number';
  }

  protected override limits(): Limits {
    return { min: this.min(), max: this.max(), step: this.step() };
  }

  protected write(event: Event): void {
    const text = (event.target as HTMLInputElement).value;
    this.typed.set(text);
    this.valueChange.emit(parseNumber(text));
  }
}
