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

/**
 * Те же файлы с `?headline` — сводки для лендинга (mcp-benchmark/headline.ts). Для сборщика это
 * отдельный модуль JSON, и неиспользуемые поля (массивы прогонов) из него выбрасываются. Файла с
 * таким именем нет, поэтому TypeScript берёт тип отсюда.
 */
declare module '@site/src/data/mcp-benchmark*.json?headline' {
  import type { McpBenchData } from '@site/src/components/mcp-benchmark/types';
  const data: McpBenchData;
  export default data;
}
