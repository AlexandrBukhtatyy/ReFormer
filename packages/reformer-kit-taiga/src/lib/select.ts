/**
 * `Select` ui-kit на Taiga UI: список по `options` на зеркале поля. Пустое значение — «не выбрано»:
 * пустой пункт стоит первым и несёт подсказку, как у нативного `<select>`.
 *
 * Нативного `<select>` у списка Taiga нет: в поле ввода — подпись выбранного пункта, пункты —
 * панель, которой нет в DOM, пока она закрыта. Для тестов и автоматизации кит ставит значение в
 * `data-value` на `input-{id}` и `option-{id}-{значение}` на пункты открытой панели.
 */
import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { ReactiveFormsModule } from '@angular/forms';
import { fromCoreSignal } from '@reformer/renderer-angular';
import { TuiDataList } from '@taiga-ui/core/components/data-list';
import { TuiError } from '@taiga-ui/core/components/error';
import { TuiInput } from '@taiga-ui/core/components/input';
import { TuiLabel } from '@taiga-ui/core/components/label';
import { TuiSelect } from '@taiga-ui/kit/components/select';
import { TuiChevron } from '@taiga-ui/kit/directives/chevron';
import { KitMirrorField, type Option } from './field';

@Component({
  selector: 'div[kitSelect]',
  imports: [ReactiveFormsModule, TuiChevron, TuiDataList, TuiError, TuiInput, TuiLabel, TuiSelect],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'kit-field' },
  template: `
    <tui-textfield
      tuiChevron
      tuiTextfieldSize="m"
      [stringify]="stringify()"
      [invalid]="error() !== undefined"
      [tuiTextfieldCleaner]="false"
    >
      <label tuiLabel [attr.data-testid]="testIdOf('label')">{{ labelText() }}</label>
      <input
        tuiSelect
        [attr.data-testid]="testIdOf('input')"
        [attr.data-value]="selected()"
        [attr.placeholder]="placeholder()"
        [formControl]="mirror"
        (blur)="blur.emit()"
      />
      <tui-data-list *tuiDropdown>
        @for (option of items(); track option.value) {
          <button
            tuiOption
            type="button"
            [value]="option.value"
            [disabled]="option.disabled ?? false"
            [attr.data-testid]="testIdOf('option', option.value)"
          >
            {{ option.label }}
          </button>
        }
      </tui-data-list>
    </tui-textfield>
    @if (error(); as text) {
      <tui-error [attr.data-testid]="testIdOf('error')" [error]="escape(text)" />
    }
  `,
})
export class Select extends KitMirrorField<unknown> {
  readonly placeholder = input('Выберите…');
  readonly options = input<readonly Option[]>([]);
  /** Крестик очистки ui-kit: пустой пункт списка делает то же. */
  readonly clearable = input(false);

  /** Пункты панели: пустой — первым. */
  protected readonly items = computed<readonly Option[]>(() => [
    { value: '', label: this.placeholder() },
    ...this.options(),
  ]);

  /**
   * Подпись выбранного значения. Функция новая на каждый набор пунктов: справочник может прийти
   * после создания поля, и подпись выбранного должна смениться вместе с ним.
   */
  protected readonly stringify = computed(() => {
    const items = this.items();
    return (value: unknown): string => items.find((item) => item.value === value)?.label ?? '';
  });

  protected readonly selected = fromCoreSignal(() => {
    const value = this.control().value.value;
    return value == null ? '' : String(value);
  });
}
