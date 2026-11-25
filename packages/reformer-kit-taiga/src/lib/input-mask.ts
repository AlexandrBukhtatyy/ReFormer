/**
 * `InputMask` ui-kit на Taiga UI: поле с маской (`9` — цифра, остальное — литералы). Формат маски
 * Taiga UI (Maskito) свой, поэтому маску применяет `applyMask` к тексту в самом элементе, до того
 * как он уйдёт в форму.
 */
import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { TuiError } from '@taiga-ui/core/components/error';
import { TuiInput } from '@taiga-ui/core/components/input';
import { applyMask } from './mask';
import { KitStringField, TEXT_FIELD } from './text-field';

@Component({
  selector: 'div[kitInputMask]',
  imports: [TuiError, TuiInput],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'kit-field' },
  template: TEXT_FIELD,
})
export class InputMask extends KitStringField {
  readonly mask = input.required<string>();

  protected override readonly inputMode = 'tel';

  protected override write(event: Event): void {
    const element = event.target as HTMLInputElement;
    const masked = applyMask(element.value, this.mask());
    if (masked !== element.value) element.value = masked;
    this.valueChange.emit(masked);
  }
}
