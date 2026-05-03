import type { Server } from '@modelcontextprotocol/sdk/server/index.js';
import {
  detectProjectStack,
  renderStackDetectionBlockAsync,
  renderLayoutSkeletonBlock,
} from '../utils/project-detector.js';
import { renderPromptTemplate } from '../utils/prompt-template-loader.js';
import { inferTarget } from '../utils/sampling-helpers.js';

export const createFormPromptDefinition = {
  name: 'create-form',
  description:
    'Create a form on @reformer/* from a textual description. Slim+ prompt — points the model at MCP resources for full FormSchema/Quick-Start/imports references; only critical inline rules and the auto-detected stack block stay in the message body.',
  arguments: [
    {
      name: 'description',
      description:
        'Свободное описание формы: какие поля, типы, начальные значения, связи. Например: "Регистрация пользователя: email, password, confirmPassword (сверка), age (число 18+)".',
      required: true,
    },
    {
      name: 'target',
      description:
        'Целевой стек: "core" (только @reformer/core + ручной React), "renderer-react" (TS RenderSchema через @reformer/renderer-react), "renderer-json" (JSON-схема через @reformer/renderer-json). По умолчанию "core".',
      required: false,
    },
    {
      name: 'projectPath',
      description:
        'Абсолютный или относительный путь к каталогу проекта, чей `package.json` нужно использовать для auto-detection (UI kit + Tailwind). По умолчанию — `process.cwd()` MCP-сервера.',
      required: false,
    },
  ],
};

function targetLabelFor(target: string): string {
  if (target === 'core') return '(только @reformer/core + ручной React-рендеринг)';
  if (target === 'renderer-react') return '(@reformer/renderer-react + TS RenderSchema)';
  return '(@reformer/renderer-json + JSON-схема + Registry)';
}

function rendererPrereqsFor(target: string): string {
  if (target === 'renderer-react') {
    return [
      '- `reformer://docs/renderer-react/quick-start`',
      '- `reformer://docs/renderer-react/key-concepts`',
      '- `reformer://docs/renderer-react/components-and-exports`',
      '- `reformer://docs/renderer-react/programmatic-api`',
      '- `reformer://docs/renderer-react/anti-patterns`',
    ].join('\n');
  }
  if (target === 'renderer-json') {
    return [
      '- `reformer://docs/renderer-json/quick-start`',
      '- `reformer://docs/renderer-json/key-concepts`',
      '- `reformer://docs/renderer-json/components-and-exports`',
      '- `reformer://docs/renderer-json/builder-api`',
      '- `reformer://docs/renderer-json/template-template-arrays`',
      '- `reformer://docs/renderer-json/source`',
      '- `reformer://docs/renderer-json/control`',
      '- `reformer://docs/renderer-json/anti-patterns`',
    ].join('\n');
  }
  return '';
}

export async function getCreateFormPrompt(
  args: { description: string; target?: string; projectPath?: string },
  server?: Server
): Promise<{
  messages: Array<{ role: 'user'; content: { type: 'text'; text: string } }>;
}> {
  const stack = detectProjectStack(args.projectPath);

  // Auto-detect target via sampling only if caller didn't pin it.
  const target = args.target
    ? args.target.toLowerCase()
    : server
      ? await inferTarget(server, { description: args.description, stack })
      : 'core';

  const stackBlock = await renderStackDetectionBlockAsync(stack, server);
  const layoutBlock = renderLayoutSkeletonBlock(stack, target);
  const layoutSection = layoutBlock
    ? layoutBlock
    : '_No layout skeleton — ui-kit/Tailwind not detected. Once you confirm the styling system with the orchestrator, follow Tailwind utility classes (`grid grid-cols-2 gap-4`, `space-y-4`, `bg-white border rounded-xl shadow-sm p-6`)._';

  const text = renderPromptTemplate('create-form', {
    target,
    targetLabel: targetLabelFor(target),
    description: args.description,
    stackBlock,
    layoutSection,
    rendererPrereqs: rendererPrereqsFor(target),
  });

  return {
    messages: [{ role: 'user', content: { type: 'text', text } }],
  };
}
