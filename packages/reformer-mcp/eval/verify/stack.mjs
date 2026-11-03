/**
 * Стек формы по её импортам. Задание называет стек прямо, поэтому форма на чужом стеке — провал, даже
 * если поведение совпало с контрактом: контракт судит только поведение, и агент однажды незаметно
 * заменил `core` на `renderer-react` в 7 прогонах из 9.
 */

const RENDERER_IMPORT =
  /(?:\bfrom\s+|\bimport\s+|\bimport\s*\(\s*)['"]@reformer\/(renderer-react|renderer-json)(?:\/[^'"]*)?['"]/g;

/**
 * @param {string} target - стек из задания: `core`, `renderer-react`, `renderer-json`
 * @param {string[]} sources - тексты файлов модуля
 * @returns {string | null} что не так; `null` — стек совпадает
 */
export function stackProblem(target, sources) {
  const used = new Set(
    sources.flatMap((code) => [...code.matchAll(RENDERER_IMPORT)].map((m) => m[1]))
  );
  if (target === 'core') {
    return used.size > 0 ? `на core импортируется ${[...used].join(', ')}` : null;
  }
  if (!used.has(target)) return `нет импорта @reformer/${target}`;
  // renderer-json рисуется компонентом из renderer-react, обратное значит другой стек.
  if (target === 'renderer-react' && used.has('renderer-json')) {
    return 'на renderer-react импортируется renderer-json';
  }
  return null;
}
