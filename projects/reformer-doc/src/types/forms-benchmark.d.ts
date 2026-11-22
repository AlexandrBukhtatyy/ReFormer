/**
 * Данные бенчмарка форм (их пишет projects/forms-benchmark-e2e/scripts/site-data.mjs). Сайт
 * собирается без `resolveJsonModule`, поэтому тип JSON задан здесь — по формату из
 * src/components/benchmark/types.ts.
 */
declare module '@site/src/data/forms-benchmark.json' {
  import type { BenchData } from '@site/src/components/benchmark/types';
  const data: BenchData;
  export default data;
}

declare module '@site/src/data/forms-benchmark-headline.json' {
  import type { HeadlineData } from '@site/src/components/benchmark/types';
  const data: HeadlineData;
  export default data;
}

declare module '@site/src/data/forms-benchmark-traces.json' {
  import type { TraceData } from '@site/src/components/benchmark/types';
  const data: TraceData;
  export default data;
}
