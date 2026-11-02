/**
 * Маркер файла, записанного `form_build`: первая строка `// @reformer-form-build <хэш тела> …`.
 *
 * Из него выводится, чей файл: нетронутый вывод сборки перезаписывается, правленный руками остаётся
 * за человеком. Отдельный реестр разошёлся бы с текстом и не пережил бы `git clone`.
 *
 * Отличие от `@reformer-generated` в `@reformer/builder-toolkit`: там хэш посимвольный, а этот
 * считается после нормализации. Файлы формы лежат в проекте потребителя, и его `prettier` с
 * `eslint --fix` меняют пробелы, кавычки, висячие запятые и скобки. От посимвольного хэша такой файл
 * выглядел бы правленным и перестал бы собираться. Префикс другой, чтобы билдер не читал чужой хэш.
 *
 * @module reformer-mcp/core/generate/generated-marker
 */

const MARKER_PREFIX = '// @reformer-form-build';
const MARKER_NOTE = 'собран из form.intent.json; правка руками отсоединит файл от сборки';

/** Чей файл: нетронутый вывод сборки, правленный руками или написанный человеком. */
export type GeneratedOrigin = 'generated' | 'edited' | 'handwritten';

function digest(text: string): string {
  // То, что меняют форматтеры, в хэш не входит. Правка только кавычек или скобок правкой не считается.
  const normalized = text.replace(/[\s,;()'"`]/g, '');
  let first = 0x811c9dc5;
  let second = 0x9dc5811c;
  for (let index = 0; index < normalized.length; index += 1) {
    first = Math.imul(first ^ normalized.charCodeAt(index), 0x01000193) >>> 0;
    second =
      Math.imul(second ^ normalized.charCodeAt(normalized.length - 1 - index), 0x01000193) >>> 0;
  }
  return first.toString(16).padStart(8, '0') + second.toString(16).padStart(8, '0');
}

function bodyOf(text: string): string {
  return text.startsWith(MARKER_PREFIX) ? text.slice(text.indexOf('\n') + 1) : text;
}

/** Приписать маркер к тексту файла. */
export function withMarker(text: string): string {
  return `${MARKER_PREFIX} ${digest(text)} ${MARKER_NOTE}\n${text}`;
}

/** Откуда файл: см. {@link GeneratedOrigin}. */
export function originOf(text: string): GeneratedOrigin {
  if (!text.startsWith(MARKER_PREFIX)) return 'handwritten';
  const stamped = text.slice(MARKER_PREFIX.length).trim().split(/\s/)[0];
  return stamped === digest(bodyOf(text)) ? 'generated' : 'edited';
}
