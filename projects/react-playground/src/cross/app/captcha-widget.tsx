/**
 * Капча — компонент приложения, а не кита: картинка на canvas, «Обновить» и поле ввода `Input`
 * ui-kit. Код выдаёт и проверяет «сервер»; виджет рисует картинку и отдаёт введённый текст по
 * значению (`value` / `onChange(value)`). Атрибуты контрола от рендерера и обёртки поля (`id`,
 * `data-testid`, `aria-*`) ложатся на поле ввода.
 */
import { useCallback, useEffect, useRef, type ComponentProps, type ReactNode } from 'react';
import { Button, Input } from '@reformer/ui-kit';
import {
  CAPTCHA_CANVAS,
  drawCaptcha,
  getCaptcha,
} from '../../../../forms-benchmark/src/cross/page';

type InputProps = ComponentProps<typeof Input>;

type CaptchaInputAttrs = Omit<InputProps, 'value' | 'onChange' | 'onBlur'>;

export interface CaptchaWidgetProps extends CaptchaInputAttrs {
  value: string;
  onChange: (value: string) => void;
  onBlur?: () => void;
}

/** Картинка загружается один раз на монтирование; «Обновить» даёт новый код и очищает поле. */
export function CaptchaWidget({
  value,
  onChange,
  onBlur,
  ...inputAttrs
}: CaptchaWidgetProps): ReactNode {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const onChangeRef = useRef(onChange);
  useEffect(() => {
    onChangeRef.current = onChange;
  });

  const load = useCallback((clear: boolean) => {
    void getCaptcha().then((challenge) => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      drawCaptcha(canvas, challenge);
      canvas.dataset.challenge = challenge.challengeId;
      if (clear) onChangeRef.current('');
    });
  }, []);

  // Картинка загружается один раз на монтирование; обновление — только по кнопке.
  useEffect(() => {
    load(false);
  }, [load]);

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-2">
        <canvas
          ref={canvasRef}
          width={CAPTCHA_CANVAS.width}
          height={CAPTCHA_CANVAS.height}
          className="rounded-md border"
          data-testid="captcha-image"
          aria-label="Картинка капчи"
          role="img"
        />
        <Button
          type="button"
          variant="outline"
          data-testid="captcha-refresh"
          onClick={() => load(true)}
        >
          Обновить
        </Button>
      </div>
      <Input
        autoComplete="off"
        {...inputAttrs}
        value={value ?? ''}
        onChange={(event) => onChange(event.target.value)}
        onBlur={onBlur}
      />
    </div>
  );
}
