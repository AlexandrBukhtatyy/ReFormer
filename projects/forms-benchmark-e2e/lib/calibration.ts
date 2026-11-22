/**
 * Калибровка скорости машины (BENCH-CONTRACT §6): одна и та же детерминированная JS-нагрузка в
 * начале и в конце каждого прогона, в той же вкладке и под тем же CDP-троттлингом, что и фазы.
 * Время нагрузки — мера скорости машины в момент прогона: частота и тепловой режим CPU, перенос
 * потока на энергоэффективные ядра меняют его так же, как метрики фаз. По нему видно дрейф внутри
 * прогона и за сессию, а `bench:compare` нормирует отчёты разных сессий.
 *
 * Не путать с `tests/calibration` — там проверка счётчика рендеров.
 *
 * Нагрузка похожа на работу формы, а не на числовой цикл, который JIT свернёт: объекты полей со
 * строками, нормализация и правила (trim, регистр, regex, маска), иммутабельные обновления
 * состояния через spread, мелкие сортировки и группировка, JSON туда и обратно. Работа зависит от
 * ГПСЧ с фиксированным сидом, результат сворачивается в контрольную сумму — она сверяется с
 * {@link CALIBRATION}.checksum, так что нагрузку нельзя ни выкинуть, ни незаметно поменять.
 */
import { median, round } from './stats';

export const CALIBRATION = {
  /** Версия нагрузки: калибровки сравнимы только при одинаковом id. Меняешь нагрузку — меняй id. */
  id: 'form-work-v1',
  /**
   * Единиц работы в одном повторе. Apple M1: ≈ 50 мс при CPU 4x и ≈ 12 мс при 1x в «быстром»
   * состоянии машины; в «медленном» (то самое расхождение в 1.6× между сессиями) — в 1.6 раза больше.
   */
  units: 150,
  /** Замеряемых повторов; в запись идёт их медиана. */
  reps: 5,
  /** Прогревочных повторов (JIT доходит до оптимизированного кода), в замер не идут. */
  warmup: 2,
  /** Ожидаемая контрольная сумма повтора (зависит от units). */
  checksum: 1718201523,
  /** Пауза после нагрузки и GC — до первой фазы ничего не досчитывается в фоне. */
  settleMs: 250,
} as const;

export interface CalibrationSample {
  /** Медиана повторов, мс. */
  ms: number;
  /** Все замеряемые повторы, мс. */
  reps: number[];
}

/** Запись калибровки прогона для runs.ndjson. */
export interface CalibrationRecord {
  startMs: number | null;
  endMs: number | null;
  /** Конец к началу − 1, %: положительный — к концу прогона машина медленнее. */
  driftPct: number | null;
  start: number[] | null;
  end: number[] | null;
}

export function calibrationRecord(
  start: CalibrationSample | null,
  end: CalibrationSample | null
): CalibrationRecord {
  return {
    startMs: start?.ms ?? null,
    endMs: end?.ms ?? null,
    driftPct: start && end ? round((end.ms / start.ms - 1) * 100, 2) : null,
    start: start?.reps ?? null,
    end: end?.reps ?? null,
  };
}

/**
 * Калибровка прогона одним числом — среднее начала и конца (что есть). По нему считаются медиана
 * сессии и нормировка в `bench:compare`; та же формула — в scripts/calibration.mjs.
 */
export function calibrationValue(c: CalibrationRecord): number | null {
  const v = [c.startMs, c.endMs].filter((x): x is number => x !== null);
  return v.length ? v.reduce((a, b) => a + b, 0) / v.length : null;
}

/** Медиана повторов (для свёртки в Node). */
export const sampleOf = (times: number[]): CalibrationSample => ({
  ms: round(median(times), 2)!,
  reps: times.map((t) => round(t, 2)!),
});

/**
 * Нагрузка в странице (`page.evaluate`): Playwright сериализует функцию в исходник, поэтому она
 * самодостаточна — без импортов и замыканий на модуль. Каждый повтор — отдельная задача
 * (`setTimeout` между повторами), время — `performance.now()` внутри страницы.
 */
export async function calibrationWorkload(opts: {
  units: number;
  reps: number;
  warmup: number;
}): Promise<{ times: number[]; checksum: number }> {
  interface Field {
    name: string;
    path: string;
    raw: string;
    value: string;
    masked: string;
    touched: boolean;
    errors: string[];
  }
  interface State {
    values: Record<string, string>;
    errors: Record<string, string>;
    touched: Record<string, boolean>;
    submitCount: number;
  }
  const rng = (seed: number) => {
    let a = seed >>> 0;
    return () => {
      a = (a + 0x6d2b79f5) >>> 0;
      let t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  };
  const ALPHA = 'abcdefghijklmnopqrstuvwxyz0123456789 .-_@';
  const EMAIL = /^[a-z0-9._-]+@[a-z0-9-]+\.[a-z]{2,}$/;
  const FIELDS = 32;

  const unit = (rnd: () => number, u: number): number => {
    // 1. Значения полей — строки из случайных символов.
    const fields: Field[] = [];
    for (let i = 0; i < FIELDS; i++) {
      const len = 4 + ((rnd() * 14) | 0);
      let raw = '';
      for (let k = 0; k < len; k++) raw += ALPHA[(rnd() * ALPHA.length) | 0];
      fields.push({
        name: `field${i}`,
        path: `section${i % 4}.field${i}`,
        raw,
        value: '',
        masked: '',
        touched: rnd() < 0.5,
        errors: [],
      });
    }
    // 2. Нормализация и правила: trim, регистр, regex, длина, includes, маска телефона.
    for (const f of fields) {
      const v = f.raw.trim().toLowerCase().replace(/\s+/g, ' ');
      f.value = v;
      if (v.length < 6) f.errors.push(`${f.name}: минимум 6 символов`);
      if (/\d{2}/.test(v)) f.errors.push(`${f.name}: подряд две цифры`);
      if (v.includes('@') && !EMAIL.test(v)) f.errors.push(`${f.name}: неверный email`);
      if (v.startsWith('-') || v.endsWith('.')) f.errors.push(`${f.name}: неверный формат`);
      const d = v.replace(/\D/g, '').padEnd(10, '0').slice(0, 10);
      f.masked = `+7 (${d.slice(0, 3)}) ${d.slice(3, 6)}-${d.slice(6, 8)}-${d.slice(8)}`;
    }
    // 3. Иммутабельные обновления состояния (как setState/reducer): копия на каждое поле.
    let state: State = { values: {}, errors: {}, touched: {}, submitCount: u };
    for (const f of fields) {
      state = {
        ...state,
        values: { ...state.values, [f.path]: f.value },
        errors: f.errors.length ? { ...state.errors, [f.path]: f.errors[0] } : state.errors,
        touched: { ...state.touched, [f.path]: f.touched },
      };
    }
    // 4. Мелкие сортировки и группировка.
    const sorted = [...fields].sort((a, b) =>
      a.errors.length !== b.errors.length
        ? b.errors.length - a.errors.length
        : a.value < b.value
          ? -1
          : a.value > b.value
            ? 1
            : 0
    );
    const groups = new Map<string, string[]>();
    for (const f of sorted) {
      const key = f.path.split('.')[0];
      const list = groups.get(key);
      if (list) list.push(f.name);
      else groups.set(key, [f.name]);
    }
    const summary = [...groups.entries()]
      .map(([key, names]) => `${key}:${names.slice().sort().join(',')}`)
      .join('|');
    // 5. Сериализация payload и разбор обратно.
    const payload = JSON.stringify({
      values: state.values,
      errors: Object.keys(state.errors).sort(),
      masked: fields.map((f) => f.masked),
    });
    const back = JSON.parse(payload) as { values: object; errors: string[] };
    let h = payload.length ^ summary.length;
    h = Math.imul(h ^ back.errors.length, 0x9e3779b1) >>> 0;
    h = Math.imul(h ^ sorted[0].value.length, 0x85ebca6b) >>> 0;
    h = Math.imul(h ^ Object.keys(back.values).length, 0xc2b2ae35) >>> 0;
    return h;
  };

  const once = () => {
    const rnd = rng(0x5eed);
    let check = 0;
    for (let u = 0; u < opts.units; u++) check = (Math.imul(check, 31) + unit(rnd, u)) >>> 0;
    return check;
  };

  const times: number[] = [];
  let checksum: number | null = null;
  for (let r = 0; r < opts.warmup + opts.reps; r++) {
    await new Promise((resolve) => setTimeout(resolve, 0));
    const t0 = performance.now();
    const c = once();
    const dt = performance.now() - t0;
    if (checksum !== null && c !== checksum)
      throw new Error('калибровка: нагрузка недетерминирована');
    checksum = c;
    if (r >= opts.warmup) times.push(dt);
  }
  return { times, checksum: checksum ?? 0 };
}
