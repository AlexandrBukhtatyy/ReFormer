import { getSection } from '../utils/docs-parser.js';
import {
  detectProjectStack,
  renderStackDetectionBlock,
  renderLayoutSkeletonBlock,
} from '../utils/project-detector.js';
import { renderPromptTemplate } from '../utils/prompt-template-loader.js';

export const createFormPromptDefinition = {
  name: 'create-form',
  description:
    'Создать форму на @reformer/* по текстовому описанию полей. Подгружает quick-start, импорты и формат FormSchema из @reformer/core, а при target=renderer-react/renderer-json — соответствующий обвязочный пакет. Авто-детектит @reformer/ui-kit и Tailwind в package.json рабочего проекта и рекомендует layout-skeleton при detected стеке.',
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
        'Абсолютный или относительный путь к каталогу проекта, чей `package.json` нужно использовать для auto-detection (UI kit + Tailwind). По умолчанию — `process.cwd()` MCP-сервера. В монорепо передавай путь конкретного приложения, иначе detector найдёт корневой package.json без app-deps.',
      required: false,
    },
  ],
};

function targetLabelFor(target: string): string {
  if (target === 'core') return '(только @reformer/core + ручной React-рендеринг)';
  if (target === 'renderer-react') return '(@reformer/renderer-react + TS RenderSchema)';
  return '(@reformer/renderer-json + JSON-схема + Registry)';
}

function buildRendererBlock(target: string): string {
  if (target === 'renderer-react') {
    return `\n\n## RenderSchema (TS)\n\n${getSection('Quick Start', '@reformer/renderer-react')}\n\n${getSection('Render Schema', '@reformer/renderer-react')}`;
  }
  if (target === 'renderer-json') {
    return `\n\n## JSON Schema\n\n${getSection('Quick Start', '@reformer/renderer-json')}\n\n${getSection('JSON Schema', '@reformer/renderer-json')}\n\n## Registry\n\n${getSection('Component Registry', '@reformer/renderer-json')}`;
  }
  return '';
}

export function getCreateFormPrompt(args: {
  description: string;
  target?: string;
  projectPath?: string;
}): {
  messages: Array<{ role: 'user'; content: { type: 'text'; text: string } }>;
} {
  const target = (args.target ?? 'core').toLowerCase();

  const stack = detectProjectStack(args.projectPath);
  const stackBlock = renderStackDetectionBlock(stack);
  const layoutBlock = renderLayoutSkeletonBlock(stack, target);
  const layoutSection = layoutBlock ? `\n\n## Layout & Visual density\n\n${layoutBlock}` : '';

  const text = renderPromptTemplate('create-form', {
    target,
    targetLabel: targetLabelFor(target),
    description: args.description,
    stackBlock,
    layoutSection,
    imports: getSection('Import Patterns', '@reformer/core'),
    quickStart: getSection('Quick Start', '@reformer/core'),
    formSchema: getSection('FormSchema', '@reformer/core'),
    commonPatterns: getSection('Common Patterns', '@reformer/core'),
    rendererBlock: buildRendererBlock(target),
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
