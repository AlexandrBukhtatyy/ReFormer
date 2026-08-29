/**
 * Ближайшее по написанию имя — то, из чего получается быстрое исправление.
 *
 * Диагностика «компонента `Inpit` в каталоге нет» сообщает о поломке, но не о выходе из неё:
 * человек лезет в палитру, ассистент — гадает. `Input` в том же сообщении превращает обе
 * ситуации в одно нажатие (и один вызов команды).
 *
 * **Порог, а не «самое близкое из имеющихся».** Без порога ответ есть ВСЕГДА: для `Foo`
 * ближайшим окажется какой-нибудь `Box`, и предложение «заменить Foo на Box» будет
 * не подсказкой, а шумом — хуже, чем её отсутствие, потому что ассистент послушно применит.
 * Порог растёт с длиной имени: в `Inpt` (4 символа) две ошибки — это уже другое слово,
 * а в `TypographyMuted` (15) — всё ещё опечатка.
 *
 * **Регистр отдельно.** `input` → `Input` — расстояние 5 по буквам, но это ровно то же имя,
 * набранное иначе, и самая частая опечатка в JSON, написанном руками. Поэтому совпадение
 * без учёта регистра проверяется первым и порогу не подчиняется.
 *
 * @module plugins/validator-schema/nearest
 */

/**
 * Порог по длине искомого имени: сколько правок ещё считается опечаткой.
 *
 * Границы подобраны по составу каталога (имена от `Box` до `TypographyBlockquote`), а не
 * формулой: короткое имя не переживает и двух правок, длинное переживает три.
 */
function thresholdFor(length: number): number {
  if (length <= 4) return 1;
  if (length <= 8) return 2;
  return 3;
}

/**
 * Расстояние Дамерау — Левенштейна (ограниченное) с ранним выходом.
 *
 * **Перестановка соседних букв стоит ОДНУ правку, а не две.** `Bxo` вместо `Box` — самая частая
 * опечатка при наборе, и по обычному Левенштейну она стоит столько же, сколько два разных
 * промаха; на трёхбуквенном имени это ровно разница между «подсказали» и «промолчали».
 *
 * Три строки динамики вместо матрицы: словарь каталога — сотни имён, и полная матрица считалась
 * бы на каждое из них при каждой правке буфера. `limit` обрывает счёт, как только вся строка
 * вышла за порог: дальше расстояние только растёт.
 */
export function editDistance(a: string, b: string, limit: number): number {
  if (a === b) return 0;
  if (Math.abs(a.length - b.length) > limit) return limit + 1;

  let beforePrevious = new Array<number>(b.length + 1);
  let previous = Array.from({ length: b.length + 1 }, (_, i) => i);
  let current = new Array<number>(b.length + 1);

  for (let i = 1; i <= a.length; i += 1) {
    current[0] = i;
    let best = current[0];
    for (let j = 1; j <= b.length; j += 1) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      let distance = Math.min(current[j - 1] + 1, previous[j] + 1, previous[j - 1] + cost);
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) {
        distance = Math.min(distance, beforePrevious[j - 2] + 1);
      }
      current[j] = distance;
      if (distance < best) best = distance;
    }
    if (best > limit) return limit + 1;
    const spare = beforePrevious;
    beforePrevious = previous;
    previous = current;
    current = spare;
  }
  return previous[b.length];
}

/**
 * Ближайший кандидат к `name` или `undefined`, если ничего достаточно близкого нет.
 *
 * Совпадение без учёта регистра выигрывает у любого другого. При равном расстоянии
 * выигрывает тот, кто раньше в списке: порядок каталога курируемый, и «первый из равных»
 * там осмысленнее, чем алфавитный.
 */
export function nearestName(candidates: Iterable<string>, name: string): string | undefined {
  const lower = name.toLowerCase();
  const limit = thresholdFor(name.length);
  let best: string | undefined;
  let bestDistance = limit + 1;

  for (const candidate of candidates) {
    if (candidate === name) return undefined; // Имя известно — исправлять нечего.
    if (candidate.toLowerCase() === lower) return candidate;
    const distance = editDistance(name, candidate, limit);
    if (distance <= limit && distance < bestDistance) {
      best = candidate;
      bestDistance = distance;
    }
  }
  return best;
}
