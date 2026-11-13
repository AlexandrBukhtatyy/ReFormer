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
import type { CaptchaChallenge } from '../api/captcha';
import { countRender, registerPrimitives } from './instrument';

type InputAttrs = Omit<InputHTMLAttributes<HTMLInputElement>, 'value' | 'onChange' | 'onBlur'>;

export interface CaptchaWidgetProps extends InputAttrs {
  value: string;
  onChange: (value: string) => void;
  onBlur?: () => void;
  inputRef?: Ref<HTMLInputElement>;
}

function draw(canvas: HTMLCanvasElement, c: CaptchaChallenge) {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  ctx.clearRect(0, 0, c.width, c.height);
  ctx.fillStyle = '#f3f4f6';
  ctx.fillRect(0, 0, c.width, c.height);
  ctx.lineWidth = 1.5;
  ctx.strokeStyle = '#9ca3af';
  for (const [x1, y1, x2, y2] of c.lines) {
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.stroke();
  }
  ctx.font = 'bold 28px monospace';
  for (const g of c.glyphs) {
    ctx.save();
    ctx.translate(g.x, g.y);
    ctx.rotate(g.rot);
    ctx.fillStyle = `hsl(${g.hue} 60% 35%)`;
    ctx.fillText(g.ch, 0, 0);
    ctx.restore();
  }
  ctx.fillStyle = '#6b7280';
  for (const [x, y] of c.dots) ctx.fillRect(x, y, 1.5, 1.5);
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
      draw(canvas, challenge);
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
          width={180}
          height={56}
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
