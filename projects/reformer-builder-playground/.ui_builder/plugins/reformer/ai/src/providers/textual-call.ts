/**
 * Вызов инструмента, написанный текстом ответа, а не сделанный.
 *
 * Исход живого канала, который снаружи выглядит законченной работой: шаг без единого вызова, в
 * тексте — вызов правки и отчёт «готово», а файлы не тронуты. Приходит двумя путями, и оба видел
 * живой прогон (gemma4:26b через Ollama, ReFormer-lhvk.8):
 *
 *  - модель выдала родной вызов, но битый — например, не закрыла строку аргумента. Парсер сервера
 *    его отверг («gemma4 tool call parsing failed» в журнале Ollama) и отдал сырой текст вызова
 *    содержимым ответа: `call:edit_file{edits:[{new_string:<|"|>…`;
 *  - модель сама написала аргументы вызова JSON-блоком в ответ, как будто этим его и сделала.
 *
 * Признаки проверяются только у ИЗВЕСТНЫХ инструментов хода: имя, которого модели не давали, —
 * просто слово в тексте, а не попытка вызова.
 *
 * @module plugins/reformer/ai/providers/textual-call
 */

import type { AiToolDef } from './types';

/** Инструмент глазами детектора: имя и схема аргументов. */
type ToolShape = Pick<AiToolDef, 'name' | 'inputSchema'>;

/**
 * Обёртки вызова, по которым имя инструмента читается прямо из текста.
 *
 * - `call:edit_file{` — родной формат Gemma 4, просочившийся мимо парсера сервера;
 * - `"name": "edit_file"` — конверт вызова JSON-ом (`<tool_call>` у Qwen и Hermes, конверт OpenAI);
 * - `edit_file(path=…` и `edit_file({…` — вызов функцией, как его пишут Python и JS. Голое
 *   `edit_file()` не считается: в объяснении модель вправе назвать инструмент по имени.
 */
const WRAPPERS: readonly RegExp[] = [
  /\bcall:([A-Za-z_][\w-]*)\s*\{/g,
  /"name"\s*:\s*"([A-Za-z_][\w-]*)"/g,
  /\b([A-Za-z_][\w-]*)\s*\(\s*(?:\{|[A-Za-z_]\w*\s*=)/g,
];

/** Обязательные аргументы инструмента по его JSON Schema. */
function requiredOf(tool: ToolShape): readonly string[] {
  const required = (tool.inputSchema as { required?: unknown }).required;
  return Array.isArray(required)
    ? required.filter((key): key is string => typeof key === 'string')
    : [];
}

/** Встречается ли в тексте ключ JSON-объекта с этим именем. Имена ключей — из наших схем. */
function hasJsonKey(text: string, key: string): boolean {
  return new RegExp(`"${key}"\\s*:`).test(text);
}

/**
 * Имя инструмента, вызов которого написан в тексте, — или `undefined`.
 *
 * Сначала обёртки: в них имя названо прямо. Затем голый объект аргументов — все обязательные
 * ключи инструмента ключами JSON. Этот признак слабее, поэтому берётся только у инструментов
 * хотя бы с двумя обязательными ключами: `{"path": …}` — ещё не вызов `read_file`, а
 * `"path"` вместе с `"edits"` — уже правка.
 *
 * @param text - Текст шага, который модель сказала пользователю; рассуждение сюда не входит.
 * @param tools - Инструменты хода.
 */
export function textualCallOf(text: string, tools: readonly ToolShape[]): string | undefined {
  if (text.trim() === '') return undefined;
  const known = new Set(tools.map((tool) => tool.name));

  for (const wrapper of WRAPPERS) {
    for (const match of text.matchAll(wrapper)) {
      if (known.has(match[1])) return match[1];
    }
  }

  for (const tool of tools) {
    const required = requiredOf(tool);
    if (required.length >= 2 && required.every((key) => hasJsonKey(text, key))) return tool.name;
  }
  return undefined;
}
