/**
 * Контролы выбора кита на Taiga UI: `Checkbox`, `RadioGroup`, `Select`.
 *
 * Флажок, радиокнопка и список Taiga UI без `NgControl` не работают: флажок и радиокнопка
 * принудительно выключены, список не создаётся. Поэтому у каждого — зеркало поля, `FormControl`
 * Angular, которое повторяет ноду поля ReFormer (./mirror.ts). Значение и `disabled` контрол берёт
 * из зеркала, а не из входов: рендерер их не передаёт — у контрола нет входа `value`.
 */
import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  Directive,
  computed,
  inject,
  input,
  type OnInit,
} from '@angular/core';
import { FormControl as AngularFormControl, ReactiveFormsModule } from '@angular/forms';
import type { FormControl } from '@reformer/core';
import { fromCoreSignal } from '@reformer/renderer-angular';
import { TuiCheckbox } from '@taiga-ui/core/components/checkbox';
import { TuiDataList } from '@taiga-ui/core/components/data-list';
import { TuiError } from '@taiga-ui/core/components/error';
import { TuiInput } from '@taiga-ui/core/components/input';
import { TuiLabel } from '@taiga-ui/core/components/label';
import { TuiRadio } from '@taiga-ui/core/components/radio';
import { TuiSelect } from '@taiga-ui/kit/components/select';
import { TuiChevron } from '@taiga-ui/kit/directives/chevron';
import { KitField, type Option } from './field';
import { mirrorControl } from './mirror';

/** Контрол на зеркале поля. Нода поля у контрола одна на всё время жизни. */
@Directive()
abstract class KitMirrorField<T> extends KitField implements OnInit {
  private readonly destroyRef = inject(DestroyRef);

  /** Зеркало ноды поля: создаётся, когда пришёл вход `control`, до первой отрисовки. */
  protected mirror!: AngularFormControl<T>;

  ngOnInit(): void {
    this.mirror = mirrorControl(this.control() as FormControl<T>, this.destroyRef);
  }
}

@Component({
  selector: 'div[kitCheckbox]',
  imports: [ReactiveFormsModule, TuiCheckbox, TuiError, TuiLabel],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'kit-checkbox' },
  template: `
    <label tuiLabel [attr.data-testid]="testIdOf('label')">
      <input
        type="checkbox"
        tuiCheckbox
        [attr.data-testid]="testIdOf('input')"
        [formControl]="mirror"
        (blur)="blur.emit()"
      />
      {{ label() }}
    </label>
    @if (error(); as text) {
      <tui-error [attr.data-testid]="testIdOf('error')" [error]="escape(text)" />
    }
  `,
})
export class Checkbox extends KitMirrorField<boolean> {}

/**
 * Группа радиокнопок. Каждая кнопка — нативный `<input type="radio">` с ролью
 * `input-{id}-{значение}`; `input-{id}` — на элементе группы.
 */
@Component({
  selector: 'div[kitRadioGroup]',
  imports: [ReactiveFormsModule, TuiError, TuiLabel, TuiRadio],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'kit-radio-group' },
  template: `
    <div
      role="radiogroup"
      class="kit-radio-group__options"
      [attr.aria-labelledby]="labelId()"
      [attr.data-testid]="testIdOf('input')"
      (focusout)="leave($event)"
    >
      <span class="kit-radio-group__label" [id]="labelId()" [attr.data-testid]="testIdOf('label')">
        {{ label() }}
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
export class RadioGroup extends KitMirrorField<string> {
  /** Имя группы из документа формы; без него — идентификатор поля. */
  readonly name = input<string>();
  readonly options = input<readonly Option[]>([]);

  protected readonly groupName = computed(() => this.name() ?? this.id() ?? 'radio-group');
  protected readonly labelId = computed(() => `radio-label-${this.groupName()}`);

  /** Уход фокуса из группы: событие `blur` кнопок не всплывает, а переход между ними — не уход. */
  protected leave(event: FocusEvent): void {
    const group = event.currentTarget as HTMLElement;
    if (!group.contains(event.relatedTarget as Node | null)) this.blur.emit();
  }
}

/**
 * Список. Значение формы — строка, пустая — «не выбрано»: пустой пункт стоит первым и несёт
 * подсказку, как у нативного `<select>`.
 *
 * Нативного `<select>` у списка Taiga нет: в поле ввода — подпись выбранного пункта, пункты —
 * панель, которой нет в DOM, пока она закрыта. Сценарию кит даёт значение в `data-value` на
 * `input-{id}` и `option-{id}-{значение}` на пунктах открытой панели.
 */
@Component({
  selector: 'div[kitSelect]',
  imports: [ReactiveFormsModule, TuiChevron, TuiDataList, TuiError, TuiInput, TuiLabel, TuiSelect],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <tui-textfield
      tuiChevron
      tuiTextfieldSize="m"
      [stringify]="stringify()"
      [invalid]="error() !== undefined"
      [tuiTextfieldCleaner]="false"
    >
      <label tuiLabel [attr.data-testid]="testIdOf('label')">{{ label() }}</label>
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
export class Select extends KitMirrorField<string> {
  readonly placeholder = input('Выберите…');
  readonly options = input<readonly Option[]>([]);

  /** Пункты панели: пустой — первым. */
  protected readonly items = computed<readonly Option[]>(() => [
    { value: '', label: this.placeholder() },
    ...this.options(),
  ]);

  /**
   * Подпись выбранного значения. Функция новая на каждый набор пунктов: справочник приходит после
   * создания поля, и подпись выбранного должна смениться вместе с ним.
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
