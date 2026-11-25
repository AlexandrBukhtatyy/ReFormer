/**
 * Текстовые контролы кита на Taiga UI: имена реестра формы (`TextInput`, `MaskedInput`,
 * `DateInput`, `NumberInput`, `Textarea`, `CaptchaWidget`) — тонкие адаптеры над текстовым полем
 * библиотеки, и `ReadonlyValue` — вычисляемое значение без контрола.
 *
 * Текстовое поле Taiga работает без форм Angular: значение — `[value]` и событие `input` нативного
 * элемента, вид ошибки — вход `invalid` поля. Нативный `<input>` пишет сам адаптер, поэтому
 * `input-{id}` стоит прямо на нём.
 *
 * Тот же документ формы рисуют киты на `@reformer/ui-kit` и Vuetify, поэтому значение поля у трёх
 * стеков обязано совпадать: текст остаётся строкой, пустое поле — пустой строкой; число — числом,
 * пустое числовое поле — `null`.
 */
import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  Directive,
  ElementRef,
  computed,
  inject,
  input,
  output,
  signal,
  viewChild,
  type AfterViewInit,
  type Signal,
} from '@angular/core';
import { TuiButton } from '@taiga-ui/core/components/button';
import { TuiError } from '@taiga-ui/core/components/error';
import { TuiInput } from '@taiga-ui/core/components/input';
import { TuiTextarea } from '@taiga-ui/kit/components/textarea';
import {
  CAPTCHA_CANVAS,
  applyMask,
  drawCaptcha,
  getCaptcha,
} from '../../../forms-benchmark/src/cross/page';
import { KitField } from './field';

/** Текстовое поле Taiga: подпись внутри поля, ошибка под ним — только когда она есть. */
const TEXT_FIELD = `
  <tui-textfield
    tuiTextfieldSize="m"
    [invalid]="error() !== undefined"
    [tuiTextfieldCleaner]="false"
  >
    <label tuiLabel [attr.data-testid]="testIdOf('label')">{{ label() }}</label>
    <input
      tuiInput
      [attr.data-testid]="testIdOf('input')"
      [type]="inputType()"
      [attr.inputmode]="inputMode"
      [attr.autocomplete]="autocomplete"
      [attr.placeholder]="placeholder() ?? null"
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

/** Основа текстового контрола: подсказка, тип и «только чтение». */
@Directive()
abstract class KitTextField extends KitField {
  readonly placeholder = input<string>();
  readonly type = input('text');
  /** Только чтение — имя пропа общее для трёх китов: его ставит поведение формы. */
  readonly readOnly = input(false);

  protected readonly inputMode: string | null = null;
  protected readonly autocomplete: string | null = null;

  /** Текст в поле. */
  protected abstract readonly text: Signal<string>;
  /** Ввод пользователя. */
  protected abstract write(event: Event): void;

  protected inputType(): string {
    return this.type();
  }
}

/** Текстовый контрол со строковым значением — диалект `[(value)]`. */
@Directive()
abstract class KitStringField extends KitTextField {
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

@Component({
  selector: 'div[kitTextInput]',
  imports: [TuiError, TuiInput],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: TEXT_FIELD,
})
export class TextInput extends KitStringField {}

/**
 * Поле с маской. Формат маски у Taiga UI (Maskito) свой, как и у остальных библиотек, — поэтому у
 * трёх стеков одна функция `applyMask`: она правит текст в самом элементе, до того как он уйдёт в
 * форму.
 */
@Component({
  selector: 'div[kitMaskedInput]',
  imports: [TuiError, TuiInput],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: TEXT_FIELD,
})
export class MaskedInput extends KitStringField {
  readonly mask = input.required<string>();

  protected override readonly inputMode = 'tel';

  protected override write(event: Event): void {
    const element = event.target as HTMLInputElement;
    const masked = applyMask(element.value, this.mask());
    if (masked !== element.value) element.value = masked;
    this.valueChange.emit(masked);
  }
}

/** Дата — нативный `type="date"` в поле Taiga: значение остаётся строкой `YYYY-MM-DD`. */
@Component({
  selector: 'div[kitDateInput]',
  imports: [TuiError, TuiInput],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: TEXT_FIELD,
})
export class DateInput extends KitStringField {
  protected override inputType(): string {
    return 'date';
  }
}

/** Текст числового поля → число формы: пустое и нечисловое — `null`. */
function parseNumber(text: string): number | null {
  if (text.trim() === '') return null;
  const parsed = Number(text);
  return Number.isFinite(parsed) ? parsed : null;
}

/**
 * Число — нативный `type="number"` в поле Taiga: значение формы — число либо `null`. Поле числа
 * Taiga (`tuiInputNumber`) не берётся: оно форматирует значение разделителями разрядов, и сценарий
 * прочитал бы другой текст.
 *
 * Поле держит набранный текст, пока он означает то же число, что в форме: иначе «1.50» посреди
 * ввода схлопнулось бы в «1.5». Значение, записанное в форму извне, вытесняет текст.
 */
@Component({
  selector: 'div[kitNumberInput]',
  imports: [TuiError, TuiInput],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: TEXT_FIELD,
})
export class NumberInput extends KitTextField {
  readonly value = input<number | null | undefined>(null);
  readonly valueChange = output<number | null>();

  private readonly typed = signal('');

  protected readonly text = computed(() => {
    const value = this.value() ?? null;
    const typed = this.typed();
    return parseNumber(typed) === value ? typed : String(value ?? '');
  });

  protected override inputType(): string {
    return 'number';
  }

  protected write(event: Event): void {
    const text = (event.target as HTMLInputElement).value;
    this.typed.set(text);
    this.valueChange.emit(parseNumber(text));
  }
}

@Component({
  selector: 'div[kitTextarea]',
  imports: [TuiError, TuiTextarea],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <tui-textfield
      tuiTextfieldSize="m"
      [invalid]="error() !== undefined"
      [tuiTextfieldCleaner]="false"
    >
      <label tuiLabel [attr.data-testid]="testIdOf('label')">{{ label() }}</label>
      <textarea
        tuiTextarea
        [attr.data-testid]="testIdOf('input')"
        [attr.placeholder]="placeholder() ?? null"
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
export class Textarea extends KitStringField {}

/**
 * Капча: картинка на canvas, «Обновить», поле ввода. Код выдаёт и проверяет «сервер»; виджет
 * рисует картинку и отдаёт введённый текст. Картинка загружается один раз на создание, обновление —
 * только по кнопке: прежний код после него недействителен, и поле очищается.
 */
@Component({
  selector: 'div[kitCaptchaWidget]',
  imports: [TuiButton, TuiError, TuiInput],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'cross-captcha' },
  template:
    `
    <div class="cross-captcha__row">
      <canvas
        #canvas
        [width]="canvasSize.width"
        [height]="canvasSize.height"
        data-testid="captcha-image"
        aria-label="Картинка капчи"
        role="img"
      ></canvas>
      <button
        tuiButton
        type="button"
        appearance="secondary"
        size="m"
        data-testid="captcha-refresh"
        (click)="load(true)"
      >
        Обновить
      </button>
    </div>
  ` + TEXT_FIELD,
})
export class CaptchaWidget extends KitStringField implements AfterViewInit {
  protected override readonly autocomplete = 'off';
  protected readonly canvasSize = CAPTCHA_CANVAS;

  private readonly canvas = viewChild.required<ElementRef<HTMLCanvasElement>>('canvas');
  private destroyed = false;

  constructor() {
    super();
    inject(DestroyRef).onDestroy(() => {
      this.destroyed = true;
    });
  }

  ngAfterViewInit(): void {
    this.load(false);
  }

  protected load(clear: boolean): void {
    void getCaptcha().then((challenge) => {
      if (this.destroyed) return;
      const target = this.canvas().nativeElement;
      drawCaptcha(target, challenge);
      target.dataset['challenge'] = challenge.challengeId;
      if (clear) this.valueChange.emit('');
    });
  }
}

/** Вычисляемое значение: подпись и `<output>`, контрола нет. */
@Component({
  selector: 'div[kitReadonlyValue]',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'cross-readonly' },
  template: `
    <span class="cross-readonly__label" [id]="labelId()">{{ label() }}</span>
    <output [attr.aria-labelledby]="labelId()" [attr.data-testid]="'computed-' + path()">{{
      text()
    }}</output>
  `,
})
export class ReadonlyValue {
  /** Путь DOM-контракта: `computed-{path}`. */
  readonly path = input.required<string>();
  readonly label = input.required<string>();
  /** Уже вычисленное значение; числа выводятся без разделителей разрядов. */
  readonly value = input<string | number | null | undefined>();

  protected readonly labelId = computed(() => `computed-label-${this.path()}`);
  protected readonly text = computed(() => {
    const value = this.value();
    return value == null ? '' : String(value);
  });
}
