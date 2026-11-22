// Снимок прогона 20261121T003557Z-5d82.registration-create.core.mcp-dsl.sonnet.r1 — пишет
// стенд замеров MCP (mcp-examples-docs.mjs), руками не править.
import type { McpExampleFile } from '../../../example-types';
import file0 from './form/index.tsx?raw';
import file1 from './form/model.ts?raw';
import file2 from './form/form.schema.ts?raw';
import file3 from './form/form.validation.ts?raw';
import file4 from './form/form.behavior.ts?raw';
import file5 from './form/form.messages.ts?raw';
import file6 from './form/api.ts?raw';
import steps from './steps.json';
import prompt from './prompt.md.txt?raw';

export { FormaRegistratsiiForm as Form } from './form/index';
export { steps, prompt };
export const spec = null;

export const files: McpExampleFile[] = [
  { name: 'index.tsx', language: 'tsx', code: file0 },
  { name: 'model.ts', language: 'ts', code: file1 },
  { name: 'form.schema.ts', language: 'ts', code: file2 },
  { name: 'form.validation.ts', language: 'ts', code: file3 },
  { name: 'form.behavior.ts', language: 'ts', code: file4 },
  { name: 'form.messages.ts', language: 'ts', code: file5 },
  { name: 'api.ts', language: 'ts', code: file6 },
];
