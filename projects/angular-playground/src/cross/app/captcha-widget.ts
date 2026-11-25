/**
 * Капча — компонент приложения, а не кита: картинка на canvas, «Обновить» и поле ввода — `Input`
 * кита. Поле кита самодостаточное (подпись, ошибка, роли `field-`, `label-`, `input-`,
 * `error-{id}`), поэтому капча объявляет те же статики ReFormer и входы и отдаёт ему подпись, ноду
 * поля и `data-testid` от рендерера как есть.
 *
 * Код выдаёт и проверяет «сервер»; картинка загружается один раз на монтирование, обновление —
 * только по кнопке: прежний код после него недействителен, и поле очищается.
 */
import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  inject,
  input,
  output,
  viewChild,
  type AfterViewInit,
} from '@angular/core';
import type { FormControl } from '@reformer/core';
import { Input } from '@reformer/kit-taiga';
import { TuiButton } from '@taiga-ui/core/components/button';
import {
  CAPTCHA_CANVAS,
  drawCaptcha,
  getCaptcha,
} from '../../../../forms-benchmark/src/cross/page';

@Component({
  selector: 'div[appCaptchaWidget]',
  imports: [Input, TuiButton],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'cross-captcha' },
  template: `
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
    <div
      kitInput
      [value]="value()"
      [control]="control()"
      [label]="label()"
      [required]="required()"
      [disabled]="disabled()"
      [placeholder]="placeholder()"
      [data-testid]="testId()"
      (valueChange)="valueChange.emit($event)"
      (blur)="blur.emit()"
    ></div>
  `,
})
export class CaptchaWidget implements AfterViewInit {
  /** Подпись — капче, как полю кита: она отдаёт её вложенному `Input`. */
  static readonly reformerLayout = 'inline-label';
  /** Нода поля — источник текста ошибки вложенного `Input`. */
  static readonly reformerNeedsControl = true;

  readonly value = input<unknown>();
  readonly valueChange = output<string>();
  readonly control = input.required<FormControl<unknown>>();
  readonly label = input<string>();
  readonly required = input(false);
  readonly disabled = input(false);
  readonly placeholder = input<string>();
  /** `input-{id}` от рендерера — его ролями размечает себя вложенное поле. */
  readonly testId = input<string | undefined>(undefined, { alias: 'data-testid' });
  readonly blur = output<void>();

  protected readonly canvasSize = CAPTCHA_CANVAS;

  private readonly canvas = viewChild.required<ElementRef<HTMLCanvasElement>>('canvas');
  private destroyed = false;

  constructor() {
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
