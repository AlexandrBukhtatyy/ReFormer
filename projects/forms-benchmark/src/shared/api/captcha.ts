/**
 * Капча: детерминированная по сиду последовательность кодов и данные для отрисовки.
 * Код знает только «сервер»; клиент получает глифы (символ + смещение + поворот) и шум.
 */

export const CAPTCHA_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
export const CAPTCHA_LENGTH = 6;

export interface CaptchaGlyph {
  ch: string;
  x: number;
  y: number;
  rot: number;
  hue: number;
}

export interface CaptchaChallenge {
  challengeId: string;
  width: number;
  height: number;
  glyphs: CaptchaGlyph[];
  lines: Array<[number, number, number, number]>;
  dots: Array<[number, number]>;
}

/** mulberry32 — маленький детерминированный ГПСЧ. */
export function createRng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function generateChallenge(
  rng: () => number,
  index: number
): { answer: string; challenge: CaptchaChallenge } {
  const width = 180;
  const height = 56;
  let answer = '';
  const glyphs: CaptchaGlyph[] = [];
  for (let i = 0; i < CAPTCHA_LENGTH; i++) {
    const ch = CAPTCHA_ALPHABET[Math.floor(rng() * CAPTCHA_ALPHABET.length)];
    answer += ch;
    glyphs.push({
      ch,
      x: 14 + i * 27 + rng() * 6,
      y: 36 + rng() * 10,
      rot: (rng() - 0.5) * 0.7,
      hue: Math.floor(rng() * 360),
    });
  }
  const lines: Array<[number, number, number, number]> = [];
  for (let i = 0; i < 5; i++) {
    lines.push([rng() * width, rng() * height, rng() * width, rng() * height]);
  }
  const dots: Array<[number, number]> = [];
  for (let i = 0; i < 40; i++) dots.push([rng() * width, rng() * height]);
  return {
    answer,
    challenge: { challengeId: `c${index}`, width, height, glyphs, lines, dots },
  };
}
