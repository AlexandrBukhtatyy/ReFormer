/**
 * Виджеты Taiga UI на состоянии формы ReFormer.
 *
 * Проверяет то, на чём будет стоять кит: текстовое поле без форм Angular, зеркало `FormControl`
 * для флажка, радиокнопок и списка, `tui-error` под условием, панель списка без анимаций.
 */
import { ChangeDetectionStrategy, Component, type OnDestroy } from '@angular/core';
import { ReactiveFormsModule } from '@angular/forms';
import { createForm, type FormModel } from '@reformer/core';
import { fromCoreSignal } from '@reformer/renderer-angular';
import { TuiButton } from '@taiga-ui/core/components/button';
import { TuiCheckbox } from '@taiga-ui/core/components/checkbox';
import { TuiDataList } from '@taiga-ui/core/components/data-list';
import { TuiError } from '@taiga-ui/core/components/error';
import { TuiInput } from '@taiga-ui/core/components/input';
import { TuiLabel } from '@taiga-ui/core/components/label';
import { TuiRadio } from '@taiga-ui/core/components/radio';
import { TuiSelect } from '@taiga-ui/kit/components/select';
import { TuiChevron } from '@taiga-ui/kit/directives/chevron';
import { mirrorControl } from '../kit/mirror';

/** Значения пробной формы: по одному полю на каждый вид виджета. */
export interface ProbeValues {
  name: string;
  agree: boolean;
  plan: string;
  city: string;
}

export type ProbeField = keyof ProbeValues;

interface Option {
  readonly value: string;
  readonly label: string;
}

/** Тексты ошибок; два из них проверяют, как `tui-error` выводит текст с угловой скобкой. */
const MESSAGES: Record<string, string> = {
  'probe.required': 'Поле обязательно',
  'probe.less': 'Значение < 3 символов',
  'probe.markup': 'Тег <b>жирный</b> в тексте',
};

const PLANS: readonly Option[] = [
  { value: 'base', label: 'Базовый' },
  { value: 'pro', label: 'Расширенный' },
];

const CITIES: readonly Option[] = [
  { value: '', label: 'Не выбран' },
  { value: 'msk', label: 'Москва' },
  { value: 'spb', label: 'Санкт-Петербург' },
  { value: 'kzn', label: 'Казань' },
];

/** Заглушка компонента: пробной форме нужно состояние полей, а не отрисовка схемы. */
class Stub {}

const schema = (model: FormModel<ProbeValues>) => ({
  component: Stub,
  children: [
    { model: model.$.name, component: Stub },
    { model: model.$.agree, component: Stub },
    { model: model.$.plan, component: Stub },
    { model: model.$.city, component: Stub },
  ],
});

/** Текст для `tui-error`: он выводит строку как HTML, поэтому разметка в ней экранируется. */
function escapeHtml(text: string): string {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;');
}

@Component({
  selector: 'spike-taiga-probe',
  imports: [
    ReactiveFormsModule,
    TuiButton,
    TuiCheckbox,
    TuiChevron,
    TuiDataList,
    TuiError,
    TuiInput,
    TuiLabel,
    TuiRadio,
    TuiSelect,
  ],
  template: `
    <section class="probe" data-testid="taiga-probe">
      <h2>Taiga UI на состоянии формы</h2>

      <div class="probe-field" data-testid="field-name">
        <tui-textfield [invalid]="nameError() !== null" [tuiTextfieldCleaner]="false">
          <label tuiLabel data-testid="label-name">Имя</label>
          <input
            tuiInput
            data-testid="input-name"
            [value]="name()"
            [disabled]="nameDisabled()"
            (input)="writeName($event)"
            (blur)="form.name.markAsTouched()"
          />
        </tui-textfield>
        @if (nameError(); as text) {
          <tui-error data-testid="error-name" [error]="raw() ? text : escape(text)" />
        }
      </div>

      <div class="probe-field" data-testid="field-agree">
        <label tuiLabel data-testid="label-agree">
          <input
            type="checkbox"
            tuiCheckbox
            data-testid="input-agree"
            [formControl]="agree"
            [tuiAppearanceMode]="agreeError() === null ? null : 'invalid'"
          />
          Согласен с условиями
        </label>
        @if (agreeError(); as text) {
          <tui-error data-testid="error-agree" [error]="escape(text)" />
        }
      </div>

      <div class="probe-field probe-radio" data-testid="field-plan" role="radiogroup">
        @for (option of plans; track option.value) {
          <label tuiLabel>
            <input
              type="radio"
              tuiRadio
              name="plan"
              [value]="option.value"
              [attr.data-testid]="'input-plan-' + option.value"
              [formControl]="plan"
            />
            {{ option.label }}
          </label>
        }
      </div>

      <div class="probe-field" data-testid="field-city">
        <tui-textfield
          tuiChevron
          [stringify]="cityLabel"
          [invalid]="cityError() !== null"
          [tuiTextfieldCleaner]="false"
        >
          <label tuiLabel data-testid="label-city">Город</label>
          <input
            tuiSelect
            data-testid="input-city"
            [attr.data-value]="cityValue()"
            [formControl]="city"
          />
          <tui-data-list *tuiDropdown>
            @for (option of cities; track option.value) {
              <button
                tuiOption
                type="button"
                [value]="option.value"
                [attr.data-testid]="'option-city-' + option.value"
              >
                {{ option.label }}
              </button>
            }
          </tui-data-list>
        </tui-textfield>
        @if (cityError(); as text) {
          <tui-error data-testid="error-city" [error]="escape(text)" />
        }
      </div>

      <button tuiButton type="button" size="m" data-testid="btn-submit">Отправить</button>
      <output data-testid="probe-values">{{ values() }}</output>
    </section>
  `,
  styles: `
    .probe {
      display: grid;
      gap: 1rem;
      max-inline-size: 28rem;
    }

    .probe-radio {
      display: flex;
      gap: 1.5rem;
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TaigaProbe implements OnDestroy {
  private readonly bundle = createForm<ProbeValues>({
    initial: { name: '', agree: false, plan: 'base', city: '' },
    schema,
  });

  protected readonly form = this.bundle.form;
  protected readonly plans = PLANS;
  protected readonly cities = CITIES;
  protected readonly escape = escapeHtml;

  // Текстовое поле: значение и состояние читаются из сигналов ядра, формы Angular не участвуют.
  protected readonly name = fromCoreSignal(() => this.form.name.value.value);
  protected readonly nameDisabled = fromCoreSignal(() => this.form.name.disabled.value);
  protected readonly nameError = this.errorOf('name');

  // Флажок, радиокнопки и список: Taiga UI требует `NgControl` — его даёт зеркало поля.
  protected readonly agree = mirrorControl(this.form.agree);
  protected readonly agreeError = this.errorOf('agree');
  protected readonly plan = mirrorControl(this.form.plan);
  protected readonly city = mirrorControl(this.form.city);
  protected readonly cityValue = fromCoreSignal(() => this.form.city.value.value);
  protected readonly cityError = this.errorOf('city');

  /** Отдавать ли `tui-error` текст как есть — чтобы увидеть, что он делает с разметкой. */
  protected readonly raw = fromCoreSignal(() => this.form.name.value.value === 'raw');

  protected readonly values = fromCoreSignal(() =>
    JSON.stringify({
      name: this.form.name.value.value,
      agree: this.form.agree.value.value,
      plan: this.form.plan.value.value,
      city: this.form.city.value.value,
    })
  );

  protected readonly cityLabel = (value: unknown): string =>
    CITIES.find((option) => option.value === value)?.label ?? '';

  protected writeName(event: Event): void {
    this.form.name.setValue((event.target as HTMLInputElement).value);
  }

  /** Запись в поле мимо Angular — как её делает сценарий или поведение формы. */
  set<K extends ProbeField>(field: K, value: ProbeValues[K]): void {
    (this.form[field] as { setValue(next: ProbeValues[K]): void }).setValue(value);
  }

  disable(field: ProbeField, disabled: boolean): void {
    if (disabled) this.form[field].disable();
    else this.form[field].enable();
  }

  /** Ставит полю замечание с кодом и показывает его; `null` снимает замечание. */
  fail(field: ProbeField, code: string | null): void {
    this.form[field].setIssues(code === null ? [] : [{ code }]);
    if (code !== null) this.form[field].markAsTouched();
  }

  touched(field: ProbeField): boolean {
    return this.form[field].touched.peek();
  }

  ngOnDestroy(): void {
    this.bundle.dispose();
  }

  private errorOf(field: ProbeField) {
    const control = this.form[field];
    return fromCoreSignal(() => {
      if (!control.shouldShowError.value) return null;
      const code = control.issues.value[0]?.code;
      return code === undefined ? null : (MESSAGES[code] ?? code);
    });
  }
}
