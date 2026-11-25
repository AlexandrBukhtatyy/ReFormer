/**
 * Картинка капчи на canvas. Слоя представления здесь нет: рисунок одинаков у виджета бенчмарка и
 * у виджетов кросс-фреймворк проверки на любом стеке.
 */
import type { CaptchaChallenge } from '../api/captcha';

/** Размер холста картинки, px. */
export const CAPTCHA_CANVAS = { width: 180, height: 56 } as const;

export function drawCaptcha(canvas: HTMLCanvasElement, c: CaptchaChallenge): void {
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
