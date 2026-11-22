/**
 * Чтение tar: ровно столько формата, сколько кладёт в архив npm.
 *
 * ## Почему свой, а не библиотека
 *
 * Разбор идёт в браузере над чужим архивом, и вопрос тут не в удобстве, а в том, что именно
 * мы согласны из него достать. Готовый распаковщик отвечает «вот файлы», включая симлинки,
 * пути с `..` и запись на 400 МБ, — а нам нужно обратное: закрытый список того, что бывает
 * в плагине, и отказ данными на всём остальном. Формат при этом мал: заголовок 512 байт,
 * поля октальными строками, два нулевых блока в конце.
 *
 * ## Что принимается и что отвергается
 *
 * - **Обычные файлы** (`0`, `\0`) и **каталоги** (`5`) — каталоги пропускаются: в наборе
 *   файлов они не нужны, путь несёт его сам.
 * - **PAX-заголовок** (`x`) — им `npm pack` передаёт длинные пути и размеры; читается `path`
 *   и применяется к СЛЕДУЮЩЕЙ записи. Глобальный (`g`) игнорируется: он про весь архив,
 *   и ничего, что нам нужно, в нём не бывает.
 * - **Симлинки и жёсткие ссылки** (`1`, `2`) — ОТКАЗ. Ссылка из архива — это способ вынести
 *   чтение за пределы распакованного набора, и «поддержать» её значит согласиться на это.
 * - **Путь за пределы архива** (`..`, абсолютный, с двоеточием диска) — отказ. Проверяется
 *   ДО записи куда бы то ни было: распаковка в чужое место — это не ошибка чтения, а взлом.
 * - **Пределы** ({@link TarLimits}) — число записей и суммарный размер. Архив, не влезающий
 *   в них, отвергается целиком, а не усекается: недочитанный плагин ломался бы «необъяснимо».
 *
 * @module shell/platform/plugin/npm/tar
 */

/** Блок tar. Размер заголовка и выравнивание данных — он же. */
const BLOCK = 512;

/** Что достали из архива: путь внутри архива → содержимое. */
export interface TarEntry {
  /** Путь как он записан в архиве, с разделителем `/`. */
  readonly path: string;
  readonly bytes: Uint8Array;
}

export interface TarLimits {
  /** Потолок числа файлов. Больше — это не плагин, а чужое дерево. */
  readonly entries: number;
  /** Потолок суммарного РАСПАКОВАННОГО размера, байт. */
  readonly bytes: number;
}

/** Умолчания: плагин, не влезающий в них, почти наверняка не плагин. */
export const TAR_LIMITS: TarLimits = Object.freeze({ entries: 500, bytes: 8 * 1024 * 1024 });

export type TarReadResult =
  | { readonly ok: true; readonly entries: readonly TarEntry[] }
  | { readonly ok: false; readonly reason: string };

const decoder = new TextDecoder();

const fail = (reason: string): TarReadResult => ({ ok: false, reason });

/** Строка заголовка: ASCII до первого нуля. */
function readString(block: Uint8Array, offset: number, length: number): string {
  const raw = block.subarray(offset, offset + length);
  const end = raw.indexOf(0);
  return decoder.decode(end === -1 ? raw : raw.subarray(0, end)).trim();
}

/**
 * Числовое поле: ОКТАЛЬНАЯ строка.
 *
 * Расширение base-256 (старший бит первого байта) не поддерживается сознательно: им
 * записывают размеры больше 8 ГБ и идентификаторы пользователей, и для плагина ни то,
 * ни другое не бывает законным.
 */
function readOctal(block: Uint8Array, offset: number, length: number): number | undefined {
  if ((block[offset] ?? 0) & 0x80) return undefined;
  const text = readString(block, offset, length).replace(/\0+$/, '').trim();
  if (text === '') return 0;
  if (!/^[0-7]+$/.test(text)) return undefined;
  return Number.parseInt(text, 8);
}

/** Пустой ли блок целиком: два таких подряд — конец архива. */
function isZeroBlock(block: Uint8Array): boolean {
  return block.every((byte) => byte === 0);
}

/**
 * Путь, который не выходит за пределы архива.
 *
 * Обратные слэши приводятся к прямым: архив мог быть собран на Windows, и `dist\main.js`
 * там значит то же самое. `.` выбрасывается, `..` отвергается — не схлопывается: путь
 * с `..` внутри архива законным не бывает, и молча «исправить» его значило бы распаковать
 * не то, что в нём написано.
 */
function safePath(raw: string): string | undefined {
  const path = raw.replace(/\\/g, '/');
  if (path === '' || path.startsWith('/') || /^[a-zA-Z]:/.test(path)) return undefined;
  const parts: string[] = [];
  for (const part of path.split('/')) {
    if (part === '' || part === '.') continue;
    if (part === '..') return undefined;
    parts.push(part);
  }
  return parts.length === 0 ? undefined : parts.join('/');
}

/** Читает PAX-запись `path`: формат «длина ключ=значение\n». */
function paxPath(bytes: Uint8Array): string | undefined {
  const text = decoder.decode(bytes);
  for (const match of text.matchAll(/(\d+) ([^=]+)=([^\n]*)\n/g)) {
    if (match[2] === 'path') return match[3];
  }
  return undefined;
}

/** Разбирает tar. Ничего не бросает: испорченный архив — данные отказа. */
export function readTar(data: Uint8Array, limits: TarLimits = TAR_LIMITS): TarReadResult {
  const entries: TarEntry[] = [];
  let total = 0;
  let offset = 0;
  /** Путь из PAX-заголовка, относящийся к следующей записи. */
  let override: string | undefined;

  while (offset + BLOCK <= data.length) {
    const header = data.subarray(offset, offset + BLOCK);
    if (isZeroBlock(header)) {
      // Конец архива. Хвост после него не читаем: там либо второй нулевой блок, либо набивка.
      break;
    }
    offset += BLOCK;

    const size = readOctal(header, 124, 12);
    if (size === undefined) return fail('размер записи не читается как восьмеричное число');
    const type = readString(header, 156, 1);
    const body = data.subarray(offset, offset + size);
    offset += Math.ceil(size / BLOCK) * BLOCK;

    if (type === '1' || type === '2') {
      return fail(
        `архив содержит ссылку «${readString(header, 0, 100)}»: ссылка выносит чтение ` +
          'за пределы распакованного набора, и такой плагин не устанавливается'
      );
    }
    if (type === 'x') {
      override = paxPath(body);
      continue;
    }
    if (type === 'g') continue;
    if (type === '5') {
      override = undefined;
      continue;
    }
    if (type !== '' && type !== '0') {
      return fail(`запись типа «${type}» в архиве плагина недопустима`);
    }

    const prefix = readString(header, 345, 155);
    const name = readString(header, 0, 100);
    const raw = override ?? (prefix === '' ? name : `${prefix}/${name}`);
    override = undefined;

    const path = safePath(raw);
    if (path === undefined) return fail(`путь «${raw}» выходит за пределы архива`);

    total += size;
    if (entries.length >= limits.entries) {
      return fail(`в архиве больше ${String(limits.entries)} файлов — это не плагин`);
    }
    if (total > limits.bytes) {
      return fail(`архив распаковывается в больше чем ${String(limits.bytes)} байт`);
    }

    // Копия, а не вид: `subarray` держит ссылку на ВЕСЬ архив, и набор файлов не давал бы
    // освободить скачанные мегабайты, пока жив хоть один файл.
    entries.push({ path, bytes: new Uint8Array(body) });
  }

  return { ok: true, entries };
}
