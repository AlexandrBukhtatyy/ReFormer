/**
 * Статистика повторных прогонов. Один прогон сценария с агентом ничего не доказывает: разброс между
 * прогонами бывает больше измеряемой разницы (см. `docs/mcp-eval/builder-form-scenarios.md`).
 */

/** Биномиальный коэффициент; для n порядка десятков точности double хватает. */
export function binomial(n, k) {
  if (k < 0 || k > n) return 0;
  let result = 1;
  for (let index = 1; index <= Math.min(k, n - k); index++) {
    result = (result * (n - index + 1)) / index;
  }
  return result;
}

/** Интервал Уилсона, 95%, для доли `passed` из `total`. */
export function wilsonInterval(passed, total, z = 1.959964) {
  if (total === 0) return [0, 1];
  const rate = passed / total;
  const zSquared = z * z;
  const denominator = 1 + zSquared / total;
  const center = rate + zSquared / (2 * total);
  const margin = z * Math.sqrt((rate * (1 - rate) + zSquared / (4 * total)) / total);
  const clamp = (value) => Math.min(1, Math.max(0, value));
  return [clamp((center - margin) / denominator), clamp((center + margin) / denominator)];
}

/** Двусторонний точный тест Фишера для таблицы 2×2: прошло/упало в A и в B. */
export function fisherExact(passedA, failedA, passedB, failedB) {
  const totalA = passedA + failedA;
  const totalB = passedB + failedB;
  const passedAll = passedA + passedB;
  const total = totalA + totalB;
  if (total === 0) return 1;
  const probability = (k) =>
    (binomial(totalA, k) * binomial(totalB, passedAll - k)) / binomial(total, passedAll);
  const observed = probability(passedA);
  let sum = 0;
  for (let k = Math.max(0, passedAll - totalB); k <= Math.min(totalA, passedAll); k++) {
    const current = probability(k);
    if (current <= observed * (1 + 1e-9)) sum += current;
  }
  return Math.min(1, sum);
}

/** Несмещённый pass@k: вероятность, что среди k попыток хотя бы одна успешна. */
export function passAtK(passed, total, k) {
  if (total < k) return null;
  return 1 - binomial(total - passed, k) / binomial(total, k);
}

/** pass^k — надёжность: вероятность, что успешны все k попыток подряд. */
export function passPowerK(passed, total, k) {
  if (total < k) return null;
  return binomial(passed, k) / binomial(total, k);
}

/** Двусторонний знаковый тест для парного сравнения по сценариям. */
export function signTest(improved, regressed) {
  const total = improved + regressed;
  if (total === 0) return 1;
  let tail = 0;
  for (let k = 0; k <= Math.min(improved, regressed); k++) tail += binomial(total, k);
  return Math.min(1, (2 * tail) / 2 ** total);
}

export function median(values) {
  if (values.length === 0) return null;
  const sorted = [...values].sort((first, second) => first - second);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
}
