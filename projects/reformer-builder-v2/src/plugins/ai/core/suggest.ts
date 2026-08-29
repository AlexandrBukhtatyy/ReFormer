/**
 * Подсказка похожих имён для структурированных ошибок инструментов.
 *
 * Нужна ровно для одного: получив `UNKNOWN_COMPONENT` со списком кандидатов, модель чинится сама
 * следующим же вызовом, а не выдумывает второе несуществующее имя. Дешёвая эвристика здесь
 * оправдана — цена промаха равна одному лишнему шагу цикла.
 *
 * @module plugins/ai/core/suggest
 */

/** Расстояние Левенштейна (итеративное, одна строка состояния). */
function distance(a: string, b: string): number {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;
  let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const row = [i];
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      row[j] = Math.min(row[j - 1] + 1, prev[j] + 1, prev[j - 1] + cost);
    }
    prev = row;
  }
  return prev[b.length];
}

/**
 * Похожие имена, по убыванию близости. Подстрока (в любую сторону) считается сильным сигналом и
 * идёт раньше опечаток: `TextInput` → `Input` ловится именно так, а не по расстоянию.
 *
 * @param query - Имя, которого не нашлось.
 * @param candidates - Все допустимые имена.
 * @param limit - Сколько вернуть.
 */
export function similarNames(query: string, candidates: readonly string[], limit = 5): string[] {
  const q = query.toLowerCase();
  if (!q) return [];
  const scored = candidates.map((name) => {
    const n = name.toLowerCase();
    const contains = n.includes(q) || q.includes(n);
    return { name, contains, dist: distance(q, n) };
  });
  return scored
    .filter((s) => s.contains || s.dist <= Math.max(2, Math.ceil(q.length / 3)))
    .sort((a, b) => Number(b.contains) - Number(a.contains) || a.dist - b.dist)
    .slice(0, limit)
    .map((s) => s.name);
}
