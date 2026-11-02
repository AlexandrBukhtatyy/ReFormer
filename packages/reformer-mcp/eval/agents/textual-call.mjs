/**
 * Вызов инструмента, написанный текстом ответа, а не сделанный: у локальных моделей это обычный
 * исход (см. `textual-call.ts` плагина форм конструктора — оттуда обёртки вызова). Импортировать тот
 * файл нельзя: это TS другого рабочего пространства, а стенд запускается обычным `node`.
 */

const WRAPPERS = [
  /\bcall:([A-Za-z_][\w-]*)\s*\{/g,
  /"name"\s*:\s*"([A-Za-z_][\w-]*)"/g,
  /\b([A-Za-z_][\w-]*)\s*\(\s*(?:\{|[A-Za-z_]\w*\s*=)/g,
];

/** Имя известного инструмента, вызов которого написан в тексте, — или `null`. */
export function findTextualCall(text, toolNames) {
  const known = new Set(toolNames);
  for (const wrapper of WRAPPERS) {
    for (const match of String(text).matchAll(wrapper)) {
      if (known.has(match[1])) return match[1];
    }
  }
  return null;
}
