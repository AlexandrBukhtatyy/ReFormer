/**
 * Данные замеров MCP (их пишет стенд замеров, `mcp-value-docs.mjs`), файл на
 * модель: `mcp-benchmark.json`, `mcp-benchmark-<модель>.json`. Формат — McpBenchData из
 * src/components/mcp-benchmark/types.ts. При `moduleResolution: bundler` TypeScript выводит тип
 * JSON из самого файла, и это объявление его не перекрывает: к формату данные приводит
 * src/components/mcp-benchmark/models.ts.
 */
declare module '@site/src/data/mcp-benchmark*.json' {
  import type { McpBenchData } from '@site/src/components/mcp-benchmark/types';
  const data: McpBenchData;
  export default data;
}
