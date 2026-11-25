/**
 * Главные числа замеров MCP для лендинга: секция «ИИ-ассистент с MCP-сервером и без него»
 * (LandingMcp.tsx) и карточка «С ИИ-ассистентом» (WhyReformer.tsx). Считаются из тех же данных и
 * теми же формулами (format.ts), что плитки «Итога» отчёта /benchmark/mcp, поэтому числа на лендинге
 * и в отчёте совпадают и обновляются вместе с данными.
 *
 * Из файлов данных берутся только сводки и мета, без массивов прогонов (это 90% файла). Импорт с
 * `?headline` для сборщика — отдельный модуль JSON, которым пользуется только этот файл; к нему
 * обращаются по полям, а не присваивают объект целиком, поэтому неиспользуемые поля выбрасываются из
 * бандла лендинга. Без query модуль общий с отчётом (models.ts берёт файл целиком), и в лендинг
 * уехали бы все прогоны. Тип таких импортов — src/types/mcp-benchmark.d.ts.
 *
 * Основной замер — Claude Sonnet (оба плеча, все сценарии); Claude Opus — для сравнения «сильная
 * модель без сервера против Sonnet с сервером».
 */
import opusJson from '@site/src/data/mcp-benchmark-opus.json?headline';
import sonnetJson from '@site/src/data/mcp-benchmark.json?headline';
import { fmtRatio, passRate, timesLabel } from './format';
import type { ArmTotals } from './types';

const NONE = sonnetJson.summary['no-mcp'];
const DSL = sonnetJson.summary['mcp-dsl'];
const OPUS_NONE = opusJson.summary['no-mcp'];

/** Пройдено и всего прогонов правки и удаления готовой формы — вместе. */
const changes = (arm: ArmTotals) => ({
  passes: arm.operations.edit.passes + arm.operations.delete.passes,
  runs: arm.operations.edit.runs + arm.operations.delete.runs,
});

export const MCP_HEADLINE = {
  /** Дата прогона, YYYY-MM-DD. */
  date: sonnetJson.date,
  // От массива сценариев сборщику нужна только длина — сами результаты в бандл не попадают.
  scenarios: sonnetJson.scenarios.length,
  targets: sonnetJson.targets.length,
  repeats: sonnetJson.repeats,
  /** Прогонов на одно плечо. */
  runs: DSL.runs,
  none: NONE,
  dsl: DSL,
  quality: { none: passRate(NONE), dsl: passRate(DSL) },
  speed: timesLabel(NONE.minutesTotal, DSL.minutesTotal),
  cost: timesLabel(NONE.costTotal, DSL.costTotal),
  /** Кратность стоимости числом — для текста «в 4.3 раза». */
  costRatio: NONE.costTotal && DSL.costTotal ? fmtRatio(NONE.costTotal / DSL.costTotal) : '—',
  tokens: timesLabel(NONE.outputMedian, DSL.outputMedian),
  create: { none: NONE.operations.create, dsl: DSL.operations.create },
  changes: { none: changes(NONE), dsl: changes(DSL) },
  /** Claude Opus без MCP против Claude Sonnet с MCP на той же матрице задач. */
  opus: {
    quality: passRate(OPUS_NONE),
    costTotal: OPUS_NONE.costTotal,
    /** Во сколько раз Opus без MCP дороже Sonnet с MCP. */
    costRatio:
      OPUS_NONE.costTotal && DSL.costTotal ? fmtRatio(OPUS_NONE.costTotal / DSL.costTotal) : '—',
  },
};
