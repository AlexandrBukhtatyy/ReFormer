/**
 * Маркер происхождения сгенерированного файла: `// @reformer-generated <хэш тела>` первой строкой.
 *
 * Из него выводится состояние файла — сгенерирован, правлен руками или написан человеком, —
 * и выводится ОДНИМ механизмом для всех источников. Отдельный флаг означал бы второй источник
 * истины и класс багов «флаг разошёлся с текстом»; кроме того, флаг не пережил бы ни
 * перезагрузку, ни `git clone`, а маркер переживает и читается человеком в `git diff`.
 *
 * Он же — предикат перезаписи при доставке: «перезаписать, если хэш сходится; иначе пропустить
 * и СКАЗАТЬ об этом» вместо молчаливого skip-if-exists.
 *
 * @module reformer-builder/lib/codegen/marker
 */

/** Префикс строки-маркера. */
export const MARKER_PREFIX = '// @reformer-generated';

/**
 * Расширения, в которых `//` — комментарий.
 *
 * Список ПОЛОЖИТЕЛЬНЫЙ, а не список исключений: неизвестный формат безопаснее оставить
 * без маркера, чем испортить. Ошибка в эту сторону стоит пометки, которой не будет;
 * в обратную — файла, который не разбирается.
 */
const COMMENTABLE = new Set(['ts', 'tsx', 'js', 'jsx', 'mjs', 'cjs', 'mts', 'cts', 'css', 'scss']);

/**
 * Допускает ли синтаксис файла строку-маркер.
 *
 * `renderer.schema.json` — тот случай, ради которого проверка и появилась: JSON комментариев
 * не знает, и маркер первой строкой делал файл неразбираемым. Ломалось от этого ВСЁ, что его
 * читает: редактор схемы в билдере отказывался брать файл (и вкладка открывалась голым
 * текстом), а сгенерированный `index.tsx` импортирует эту же схему — то есть не собрался бы
 * и модуль, отданный человеку.
 *
 * Потери от пропуска маркера нет: перезапись производных файлов маркером не управляется —
 * их доставка переписывает всегда (см. `plugins/codegen/deliver`), а спрашивают его только
 * у авторских, и все они `.ts`.
 */
export function acceptsMarker(path: string): boolean {
  const at = path.lastIndexOf('.');
  return at === -1 ? false : COMMENTABLE.has(path.slice(at + 1).toLowerCase());
}

/**
 * Хэш тела файла — 12 hex-символов FNV-1a в два прохода.
 *
 * Криптостойкость здесь не нужна и вредна: хэш считается на каждой регенерации, а задача —
 * отличить «текст тот же» от «текст правили», а не защититься от подделки.
 */
function digest(body: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < body.length; i += 1) {
    h ^= body.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  // 32 бита мало для 12 знаков — вторая свёртка с другим сидом и в обратную сторону.
  let g = 0x9dc5811c;
  for (let i = body.length - 1; i >= 0; i -= 1) {
    g ^= body.charCodeAt(i);
    g = Math.imul(g, 0x01000193) >>> 0;
  }
  return (h.toString(16).padStart(8, '0') + g.toString(16).padStart(8, '0')).slice(0, 12);
}

/** Текст без строки-маркера — то, от чего считается хэш. */
function body(text: string): string {
  return text.startsWith(MARKER_PREFIX) ? text.slice(text.indexOf('\n') + 1) : text;
}

/** Приписать маркер к сгенерированному тексту (идемпотентно). */
export function withMarker(text: string): string {
  const clean = body(text);
  return `${MARKER_PREFIX} ${digest(clean)}\n${clean}`;
}

/** Состояние файла относительно генерации. */
export type FileOrigin = 'generated' | 'edited' | 'handwritten';

/**
 * Откуда взялся файл.
 *
 * `handwritten` — маркера нет: файл написан человеком (в том числе «открыли чужой проект»).
 * `generated` — маркер есть и хэш сходится. `edited` — маркер есть, а тело изменили.
 */
export function originOf(text: string | null | undefined): FileOrigin {
  if (text === null || text === undefined || !text.startsWith(MARKER_PREFIX)) return 'handwritten';
  const line = text.slice(0, text.indexOf('\n'));
  const stamped = line.slice(MARKER_PREFIX.length).trim();
  return stamped === digest(body(text)) ? 'generated' : 'edited';
}

/** Можно ли перезаписывать файл без спроса. */
export function isGenerated(text: string | null | undefined): boolean {
  return originOf(text) === 'generated';
}
