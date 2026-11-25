/**
 * Данные отчёта «ReFormer в React, Vue и Angular» (их пишет
 * projects/forms-benchmark-e2e/scripts/site-data.mjs с `BENCH_SUITE=frameworks`). Формат — тот же,
 * что у отчёта библиотек (src/components/benchmark/types.ts): участники — стеки, без отношения к
 * лучшему и значимости.
 */
declare module '@site/src/data/frameworks-benchmark.json' {
  import type { BenchData } from '@site/src/components/benchmark/types';
  const data: BenchData;
  export default data;
}

declare module '@site/src/data/frameworks-benchmark-headline.json' {
  import type { HeadlineData } from '@site/src/components/benchmark/types';
  const data: HeadlineData;
  export default data;
}

declare module '@site/src/data/frameworks-benchmark-traces.json' {
  import type { TraceData } from '@site/src/components/benchmark/types';
  const data: TraceData;
  export default data;
}
