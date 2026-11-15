/**
 * Данные замеров MCP (их пишет packages/reformer-mcp/eval/scenarios/mcp-value-docs.mjs). Сайт
 * собирается без `resolveJsonModule`, поэтому тип JSON задан здесь — по формату из
 * src/components/mcp-benchmark/types.ts.
 */
declare module '@site/src/data/mcp-benchmark.json' {
  import type { McpBenchData } from '@site/src/components/mcp-benchmark/types';
  const data: McpBenchData;
  export default data;
}
