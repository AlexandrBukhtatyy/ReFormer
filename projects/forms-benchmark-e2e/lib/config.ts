/**
 * Параметры прогона бенча — из переменных окружения, значения по умолчанию — из контракта.
 *
 * BENCH_ITERATIONS  — замеряемых прогонов на участника и профиль CPU (10; BENCH_QUICK=1 → 3)
 * BENCH_WARMUP      — прогревочных прогонов, в статистику не идут (1)
 * BENCH_CPU         — профили троттлинга CPU через запятую (4; например "1,4")
 * BENCH_CADENCE     — интервал между клавишами при наборе, мс (80)
 * BENCH_REMOUNTS    — перемонтирований в фазе remount (20)
 * BENCH_RENDERS     — проход подсчёта рендеров (1 — да)
 * BENCH_TRACE       — трассируемый прогон на участника (1 — да)
 * BENCH_SEED        — сид перемешивания порядка участников (по умолчанию от времени запуска)
 * BENCH_LIBS        — только эти участники (через запятую)
 */
const num = (name: string, fallback: number) => {
  const raw = process.env[name];
  const n = raw === undefined || raw === '' ? NaN : Number(raw);
  return Number.isFinite(n) ? n : fallback;
};

const quick = process.env.BENCH_QUICK === '1';

export const benchConfig = {
  quick,
  iterations: num('BENCH_ITERATIONS', quick ? 3 : 10),
  warmup: num('BENCH_WARMUP', quick ? 0 : 1),
  cpuRates: (process.env.BENCH_CPU ?? '4')
    .split(',')
    .map(Number)
    .filter((n) => Number.isFinite(n) && n >= 1),
  cadenceMs: num('BENCH_CADENCE', 80),
  /**
   * Пауза пользователя перед каждой фазой (вне окна замера), мс. Больше debounce проверок (300 мс),
   * чтобы действие фазы не попадало в окно ожидания после ввода предыдущей — как у живого человека,
   * который после набора переводит взгляд и курсор.
   */
  thinkMs: num('BENCH_THINK', 400),
  remounts: num('BENCH_REMOUNTS', quick ? 10 : 20),
  renders: process.env.BENCH_RENDERS !== '0',
  trace: process.env.BENCH_TRACE !== '0',
  seed: num('BENCH_SEED', Date.now() % 2 ** 31),
};

export type BenchConfig = typeof benchConfig;

/** Детерминированное перемешивание (mulberry32 + Фишер–Йетс). */
export function createShuffler(seed: number) {
  let a = seed >>> 0;
  const rnd = () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  return <T>(items: readonly T[]): T[] => {
    const out = [...items];
    for (let i = out.length - 1; i > 0; i--) {
      const j = Math.floor(rnd() * (i + 1));
      [out[i], out[j]] = [out[j], out[i]];
    }
    return out;
  };
}
