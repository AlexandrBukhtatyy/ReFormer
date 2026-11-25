/**
 * Виджет капчи (спека регистрации, раздел «Капча»): картинка на canvas, «Обновить», поле ввода.
 * Код получает и проверяет «сервер»; виджет только рисует и отдаёт введённый текст.
 *
 * API по значению (`value`/`onChange(value)`), как у типичного стороннего виджета: библиотеки
 * подключают его своим штатным способом для кастомных компонентов. Остальные пропсы (id, testid,
 * aria из `controlAttrs`) ложатся на поле ввода — как у любого другого контрола.
 */
import { useEffect, useRef, type InputHTMLAttributes, type Ref } from 'react';
import { api } from '../api/client';
import { CAPTCHA_CANVAS, drawCaptcha } from './captcha-draw';
import { countRender, registerPrimitives } from './instrument';

type InputAttrs = Omit<InputHTMLAttributes<HTMLInputElement>, 'value' | 'onChange' | 'onBlur'>;

export interface CaptchaWidgetProps extends InputAttrs {
  value: string;
  onChange: (value: string) => void;
  onBlur?: () => void;
  inputRef?: Ref<HTMLInputElement>;
}

export function CaptchaWidget({
  value,
  onChange,
  onBlur,
  inputRef,
  ...inputAttrs
}: CaptchaWidgetProps) {
  countRender('CaptchaWidget');
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const onChangeRef = useRef(onChange);
  useEffect(() => {
    onChangeRef.current = onChange;
  });

  const load = (clear: boolean) => {
    void api.getCaptcha().then((challenge) => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      drawCaptcha(canvas, challenge);
      canvas.dataset.challenge = challenge.challengeId;
      if (clear) onChangeRef.current('');
    });
  };

  useEffect(() => {
    load(false);
    // Картинка загружается один раз на монтирование; обновление — только по кнопке.
  }, []);

  return (
    <div className="b-captcha">
      <div className="b-captcha__row">
        <canvas
          ref={canvasRef}
          width={CAPTCHA_CANVAS.width}
          height={CAPTCHA_CANVAS.height}
          className="b-captcha__image"
          data-testid="captcha-image"
          aria-label="Картинка капчи"
          role="img"
        />
        <button
          type="button"
          className="b-button b-button--ghost"
          data-testid="captcha-refresh"
          onClick={() => load(true)}
        >
          Обновить
        </button>
      </div>
      <input
        className="b-input"
        autoComplete="off"
        {...inputAttrs}
        ref={inputRef}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onBlur={onBlur}
      />
    </div>
  );
}

registerPrimitives({ CaptchaWidget });
