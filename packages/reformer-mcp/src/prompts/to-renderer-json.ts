import { getSection, getFullDocs } from '../utils/docs-parser.js';
import { renderPromptTemplate } from '../utils/prompt-template-loader.js';

export const toRendererJsonPromptDefinition = {
  name: 'to-renderer-json',
  description:
    'Мигрировать TS RenderSchema (@reformer/renderer-react) в JSON-схему + Registry для @reformer/renderer-json. Подгружает migration cookbook, JsonFormSchema формат, registry rules.',
  arguments: [
    {
      name: 'code',
      description: 'Текущий код TS RenderSchema (RenderSchemaFn) и/или Form.',
      required: true,
    },
  ],
};

export function getToRendererJsonPrompt(args: { code: string }): {
  messages: Array<{ role: 'user'; content: { type: 'text'; text: string } }>;
} {
  const cookbook = getFullDocs('@reformer/renderer-json');
  const migrationIdx = cookbook.indexOf('Migration');
  const migrationBlock = migrationIdx >= 0 ? cookbook.slice(migrationIdx, migrationIdx + 3000) : '';

  const text = renderPromptTemplate('to-renderer-json', {
    code: args.code,
    jsonSchemaFormat: getSection('JSON Schema', '@reformer/renderer-json'),
    registry: getSection('Component Registry', '@reformer/renderer-json'),
    migrationBlock,
  });

  return {
    messages: [
      {
        role: 'user',
        content: { type: 'text', text },
      },
    ],
  };
}
