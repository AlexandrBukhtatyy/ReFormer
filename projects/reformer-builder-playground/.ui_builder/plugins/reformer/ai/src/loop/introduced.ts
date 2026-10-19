/**
 * «Не обязана лечить, но обязана не ухудшать»: сравнение находок проверки с находками базы.
 *
 * Политика общая для обоих режимов записи. Гейт структурных инструментов (`./gate`) сравнивает
 * черновик хода со схемой на начало хода, гейт файлового режима (`../files/gate`) — файл после
 * правки с тем же файлом до неё. Сравнение одно и то же, поэтому живёт отдельно, а не копией
 * в каждом гейте: расхождение в нормализации означало бы, что один режим вменяет модели чужую
 * ошибку, а другой — нет.
 *
 * @module plugins/reformer/ai/loop/introduced
 */

/**
 * Сколько замечаний дописывать к успешной правке. Замечание — не отказ, а подсказка вдогонку, и
 * длинный список превратил бы ответ инструмента в отчёт валидатора.
 */
const MAX_WARNINGS = 2;

/**
 * Ошибка без индексов пути: `root.children[0].componentProps …` → `root.children[#].componentProps …`.
 *
 * Сравнивать ошибки дословно нельзя: вставка узла ПЕРЕД уже битым соседом сдвигает его индекс, та
 * же самая ошибка выглядит новой, и правка отвергается — с сообщением про ЧУЖОЙ узел, которого
 * модель не трогала. Политика «не обязана лечить, но обязана не ухудшать» на сдвиге индексов
 * не работала.
 */
export function normalizeError(message: string): string {
  return message.replace(/\[\d+\]/g, '[#]');
}

/**
 * Находки как мультимножество нормализованных сообщений.
 *
 * Именно счётчики, а не множество: с одними лишь ключами форма, где уже есть одна такая ошибка,
 * молча принимала бы вторую такую же — «не ухудшать» превратилось бы в «не ухудшать заметно».
 *
 * @param normalize - Как привести находку к ключу сравнения; по умолчанию {@link normalizeError}.
 */
export function countErrors(
  errors: readonly string[],
  normalize: (message: string) => string = normalizeError
): Map<string, number> {
  const counts = new Map<string, number>();
  for (const e of errors) {
    const key = normalize(e);
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return counts;
}

/**
 * То, чего в базе не было (или стало больше), в исходных формулировках.
 *
 * @param base - Находки базы, посчитанные {@link countErrors} той же нормализацией.
 * @param normalize - Та же нормализация, что у базы.
 */
export function introduced(
  base: ReadonlyMap<string, number>,
  errors: readonly string[],
  normalize: (message: string) => string = normalizeError
): string[] {
  const seen = new Map<string, number>();
  const out: string[] = [];
  for (const e of errors) {
    const key = normalize(e);
    const used = (seen.get(key) ?? 0) + 1;
    seen.set(key, used);
    if (used > (base.get(key) ?? 0)) out.push(e);
  }
  return out;
}

/**
 * Замечания, которые правка ПРИНЕСЛА, — строкой вдогонку к успеху.
 *
 * Замечания на валидность не влияют, поэтому гейт их не отвергает. Но и молчать о них нельзя:
 * сказанное сразу после правки адреснее отдельной проверки в конце хода — модель ещё помнит,
 * что делала, и это не стоит лишнего обхода «модель → инструмент → модель».
 */
export function warningLine(fresh: readonly string[]): string {
  if (!fresh.length) return '';
  const shown = fresh.slice(0, MAX_WARNINGS).join('; ');
  const rest = fresh.length - Math.min(fresh.length, MAX_WARNINGS);
  return `\nHeads up: ${shown}${rest > 0 ? ` (and ${rest} more)` : ''}.`;
}
