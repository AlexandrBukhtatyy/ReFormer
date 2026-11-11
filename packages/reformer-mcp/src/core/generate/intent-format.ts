/**
 * Запись `form.intent.json` на диск: так, как его удобно править агенту.
 *
 * Черновик `plan_form` агент дальше правит своим Edit, а Edit ищет фрагмент по точному совпадению.
 * `JSON.stringify(intent, null, 2)` раскладывает каждую запись поля на десяток строк, и правка одной
 * записи превращается в многострочный фрагмент с отступами. Здесь записи списков — по одной на
 * строку (так же грамматика просит писать intent), а раскладка — по узлу на строку, пока узел не
 * помещается в строку целиком.
 *
 * @module reformer-mcp/core/generate/intent-format
 */

/** Ключи верхнего уровня, у которых каждая запись списка — одна строка. */
const RECORD_LISTS = new Set([
  'fields',
  'arrays',
  'validation',
  'behavior',
  'visibility',
  'dataSources',
  'steps',
]);

/** Ширина, до которой вложенный объект печатается одной строкой. */
const WIDTH = 100;

function nested(value: unknown, indent: string): string {
  const flat = JSON.stringify(value);
  if (value === null || typeof value !== 'object' || flat.length + indent.length <= WIDTH) {
    return flat;
  }
  const inner = `${indent}  `;
  if (Array.isArray(value)) {
    if (value.length === 0) return '[]';
    return `[\n${value.map((item) => inner + nested(item, inner)).join(',\n')}\n${indent}]`;
  }
  const entries = Object.entries(value as Record<string, unknown>);
  if (entries.length === 0) return '{}';
  return `{\n${entries
    .map(([key, item]) => `${inner}${JSON.stringify(key)}: ${nested(item, inner)}`)
    .join(',\n')}\n${indent}}`;
}

/**
 * Intent текстом файла: ключ верхнего уровня на строку, запись списка на строку, раскладка по узлам.
 * Результат — обычный JSON: `JSON.parse` возвращает тот же объект.
 */
export function formatIntentJson(intent: Readonly<Record<string, unknown>>): string {
  const lines = Object.entries(intent)
    .filter(([, value]) => value !== undefined)
    .map(([key, value]) => {
      const name = JSON.stringify(key);
      if (RECORD_LISTS.has(key) && Array.isArray(value)) {
        if (value.length === 0) return `  ${name}: []`;
        return `  ${name}: [\n${value.map((item) => `    ${JSON.stringify(item)}`).join(',\n')}\n  ]`;
      }
      return `  ${name}: ${nested(value, '  ')}`;
    });
  return `{\n${lines.join(',\n')}\n}\n`;
}
