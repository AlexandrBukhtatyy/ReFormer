/**
 * Формат живых форм страницы «Замеры: с MCP и без» — каталог `_generated/`, который пишет
 * стенд замеров MCP (`mcp-examples-docs.mjs`) из своих прогонов.
 */
import type { ComponentType } from 'react';

/** Файл модуля формы для вкладки «Код». */
export interface McpExampleFile {
  name: string;
  /** Язык подсветки — расширение файла: `tsx`, `ts`, `json`. */
  language: string;
  code: string;
}

/** Вызов агента к серверу: код `execute`/`search` и первая строка ответа. */
export interface McpExampleStep {
  tool: string;
  code: string;
  answer: string;
  error: boolean;
}

/** Снимок прогона: загружается отдельным чанком, когда форму открывают. */
export interface McpExampleModule {
  Form: ComponentType;
  /** Промпт, с которым запускался прогон (`prompt.md`), байт в байт. */
  prompt: string;
  /** Спецификация из рабочего каталога прогона, на которую ссылается промпт; `null` — её нет. */
  spec: string | null;
  files: McpExampleFile[];
  steps: McpExampleStep[];
}

/** Прогон снимка — для строки над формой. */
export interface McpExampleRun {
  batch: string;
  /** Каталог прогона в `.tmp/mcp-runs/<batch>/`. */
  run: string;
  model: string;
  repeat: number;
  repeats: number;
  pass: boolean;
  score: number;
  minutes: number;
  /** `null` — стоимость не считалась (локальная модель). */
  cost: number | null;
  turns: number | null;
  /** Вызовов `execute`/`search` к серверу. */
  calls: number;
}

export interface McpExampleStack {
  run: McpExampleRun;
  load: () => Promise<McpExampleModule>;
}

export type McpExampleCatalog = Record<
  string,
  { scenario: string; stacks: Record<string, McpExampleStack> }
>;
