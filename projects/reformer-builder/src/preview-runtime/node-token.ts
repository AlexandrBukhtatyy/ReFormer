/**
 * Кодек «путь узла ⇄ CSS-класс» для runtime-превью. Путь узла (`['root','children',0]`) кодируется
 * в класс-токен (`rbnode-root__children__0`), который {@link annotateSchema} дописывает в
 * `componentProps.className` эфемерной копии схемы. Токен доезжает до DOM (рендерер отдаёт
 * `className` корню компонента / блоку поля), поэтому по нему работают хит-тест и CSS-подсветка —
 * отдельная карта «id → путь» не нужна.
 *
 * Токен обязан быть валидным CSS-ident: начинается с буквы, дальше только `[A-Za-z0-9_-]`. Сегменты
 * разделяются `__`; символы вне `[A-Za-z0-9]` экранируются как `-<hex>-` (`$template` → `-24-template`).
 * Числовой сегмент (индекс) пишется цифрами; строковый, состоящий из одних цифр, экранирует первый
 * символ — чтобы не спутаться с индексом.
 *
 * @module reformer-builder/preview-runtime/node-token
 */

import type { JsonPath } from '../model';

/** Префикс класса-маркера (он же селектор хит-теста: `[class*="rbnode-"]`). */
export const NODE_CLASS_PREFIX = 'rbnode-';

/**
 * Класс контейнера без детей: в превью ему нужна минимальная высота, иначе он недостижим курсором.
 * Намеренно вне префикса маркера, чтобы не попадать в хит-тест.
 */
export const EMPTY_CLASS = 'rb-empty';

const SEP = '__';

/** Токен в строке классов (границы — пробел/начало/конец). */
const TOKEN_RE = new RegExp(`(?:^|\\s)(${NODE_CLASS_PREFIX}[A-Za-z0-9_-]+)(?:\\s|$)`);

const hex = (ch: string): string => `-${ch.codePointAt(0)!.toString(16)}-`;

function encodeSegment(seg: string | number): string {
  if (typeof seg === 'number') return String(seg);
  let out = '';
  for (const ch of seg) out += /[A-Za-z0-9]/.test(ch) ? ch : hex(ch);
  // Строка из одних цифр декодировалась бы как индекс — экранируем первый символ.
  return /^\d+$/.test(out) ? hex(seg[0]) + out.slice(1) : out;
}

function decodeSegment(seg: string): string | number {
  if (/^\d+$/.test(seg)) return Number(seg);
  return seg.replace(/-([0-9a-f]+)-/g, (_, code: string) =>
    String.fromCodePoint(parseInt(code, 16))
  );
}

/** Путь узла → класс-токен. */
export function encodeNodeToken(path: JsonPath): string {
  return NODE_CLASS_PREFIX + path.map(encodeSegment).join(SEP);
}

/** Класс-токен → путь узла; `null`, если строка не является токеном. */
export function decodeNodeToken(token: string): JsonPath | null {
  if (!token.startsWith(NODE_CLASS_PREFIX)) return null;
  const body = token.slice(NODE_CLASS_PREFIX.length);
  if (!body) return null;
  const segs = body.split(SEP);
  if (segs.some((s) => s === '')) return null;
  return segs.map(decodeSegment);
}

/** Первый токен-маркер в строке классов элемента, либо `null`. */
export function tokenFromClassName(className: string): string | null {
  const m = TOKEN_RE.exec(className);
  return m ? m[1] : null;
}
