/**
 * Гейт калибровки: метрики прогона (`metrics.json`) против `docs/mcp-eval/calibration-baseline.json`.
 *
 * Сравнивается только то, что имеет направление: дроби `x/y`, счётчики ошибок, проценты, упавшие
 * проверки smoke. Сравниваются лишь треки, которые есть в обоих наборах: прогон без `--e2e` не имеет
 * T3 и за это не наказывается.
 */

const FRACTION = /^(\d+)\/(\d+)$/;
const PERCENT = /^(\d+(?:\.\d+)?)%$/;
/** Счётчики, рост которых — ухудшение. Предупреждения и размеры сюда не входят. */
const ERROR_COUNTER = /errors?$|^fieldsExtra$|^typeMismatch$|^componentMismatch$|^withErrors$/i;

/** Списки T2 приходят массивами прогонов, а сравнивать надо по имени прогона. */
function byRun(list) {
  return Object.fromEntries(list.map((run) => [run.run, run]));
}

/**
 * Найти ухудшения.
 *
 * @returns {{ regressions: string[], improvements: string[], incomparable: string[] }}
 */
export function compareCalibration(current, baseline) {
  const regressions = [];
  const improvements = [];
  const incomparable = [];

  const walk = (now, before, at) => {
    if (now === undefined || before === undefined) return;
    if (Array.isArray(now) && Array.isArray(before)) {
      if (now.every((item) => typeof item?.run === 'string')) {
        walk(byRun(now), byRun(before), at);
        return;
      }
      if (at.endsWith('.fail') || at === 'smoke.fail') {
        const added = now.filter((item) => !before.includes(item));
        if (added.length > 0) regressions.push(`${at}: новые падения ${added.join(', ')}`);
      }
      return;
    }
    if (now !== null && typeof now === 'object' && before !== null && typeof before === 'object') {
      for (const key of Object.keys(before)) {
        walk(now[key], before[key], at ? `${at}.${key}` : key);
      }
      return;
    }
    if (typeof now === 'string' && typeof before === 'string') {
      const fractionNow = FRACTION.exec(now);
      const fractionBefore = FRACTION.exec(before);
      if (fractionNow && fractionBefore) {
        if (fractionNow[2] !== fractionBefore[2]) {
          // Другой знаменатель — другой набор проверок, например правка корпуса: числитель не
          // сравним, но молчать об этом нельзя.
          if (now !== before) incomparable.push(`${at}: ${before} → ${now}`);
        } else if (Number(fractionNow[1]) < Number(fractionBefore[1])) {
          regressions.push(`${at}: ${before} → ${now}`);
        } else if (Number(fractionNow[1]) > Number(fractionBefore[1])) {
          improvements.push(`${at}: ${before} → ${now}`);
        }
        return;
      }
      const percentNow = PERCENT.exec(now);
      const percentBefore = PERCENT.exec(before);
      if (percentNow && percentBefore && Number(percentNow[1]) < Number(percentBefore[1])) {
        regressions.push(`${at}: ${before} → ${now}`);
      }
      return;
    }
    const key = at.split('.').at(-1);
    if (typeof now === 'number' && typeof before === 'number' && ERROR_COUNTER.test(key)) {
      if (now > before) regressions.push(`${at}: ${before} → ${now}`);
      else if (now < before) improvements.push(`${at}: ${before} → ${now}`);
    }
  };

  walk(current, baseline, '');
  return { regressions, improvements, incomparable };
}
