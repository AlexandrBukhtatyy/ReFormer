import type { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { detectProjectStack, renderStackDetectionBlockAsync } from '../utils/project-detector.js';
import { renderPromptTemplate } from '../utils/prompt-template-loader.js';
import { isSamplingSupported, requestSampling } from '../utils/sampling.js';

export const discoverContextPromptDefinition = {
  name: 'discover-context',
  description:
    'Собирает контекст проекта (target stack, UI-компоненты, стили, валидация, async-паттерны) одним batched sampling-запросом к клиенту. Возвращает JSON-рекомендацию для последующих prompts (create-form / add-* / plan-form). Если клиент не поддерживает sampling — возвращает шаблон вопросов для ручного ответа пользователя.',
  arguments: [
    {
      name: 'description',
      description: 'Описание формы (что нужно построить).',
      required: true,
    },
    {
      name: 'projectPath',
      description: 'Путь к каталогу проекта для auto-detection стека.',
      required: false,
    },
  ],
};

interface ContextRecommendation {
  target: 'core' | 'renderer-react' | 'renderer-json';
  uiKit: string | null;
  styling: string | null;
  validation: string | null;
  async: string | null;
  notes?: string;
}

const VALID_TARGETS: ReadonlyArray<ContextRecommendation['target']> = [
  'core',
  'renderer-react',
  'renderer-json',
];

function deterministicRecommendation(
  stack: ReturnType<typeof detectProjectStack>
): ContextRecommendation {
  return {
    target: stack.hasRendererJson
      ? 'renderer-json'
      : stack.hasRendererReact
        ? 'renderer-react'
        : 'core',
    uiKit: stack.hasUiKit ? '@reformer/ui-kit' : null,
    styling: stack.hasTailwind ? 'tailwind' : null,
    validation: null,
    async: null,
  };
}

export async function getDiscoverContextPrompt(
  args: { description: string; projectPath?: string },
  server?: Server
): Promise<{
  messages: Array<{ role: 'user'; content: { type: 'text'; text: string } }>;
}> {
  const stack = detectProjectStack(args.projectPath);
  const stackBlock = await renderStackDetectionBlockAsync(stack, server);

  let recommendation = deterministicRecommendation(stack);
  let llmBlock = '_Sampling not supported by this client — answer manually below._';

  if (server && isSamplingSupported(server)) {
    const depList = Object.keys(stack.allDependencies).join(', ') || '(no deps detected)';
    const result = await requestSampling(server, {
      systemPrompt:
        'You analyse a form description + a list of npm dependencies, and produce ' +
        'a single JSON object with the recommended @reformer target stack and ' +
        'related preferences. Reply ONLY in JSON. No prose.',
      userPrompt:
        `Form description:\n${args.description}\n\n` +
        `Detected dependencies: ${depList}\n\n` +
        'Reply with strict JSON of shape:\n' +
        '{\n' +
        '  "target": "core" | "renderer-react" | "renderer-json",\n' +
        '  "uiKit": "<package>" | null,\n' +
        '  "styling": "tailwind" | "styled-components" | "emotion" | "css-modules" | "sass" | "vanilla-css" | null,\n' +
        '  "validation": "zod" | "yup" | "custom" | null,\n' +
        '  "async": "debounced-fetch" | "abort-controller" | "swr" | "react-query" | null,\n' +
        '  "notes": "<one-sentence rationale>"\n' +
        '}\n\n' +
        'Pick "renderer-json" if @reformer/renderer-json is in deps. ' +
        '"renderer-react" if @reformer/renderer-react is in deps (and json is not). ' +
        '"core" otherwise OR for trivial forms.\n' +
        'For uiKit, pick from deps; for styling, infer from deps + project conventions.',
      maxTokens: 512,
      intelligencePriority: 0.7,
    });

    if (result.ok) {
      try {
        const cleaned = result.text.replace(/^```(?:json)?\s*|\s*```$/g, '').trim();
        const parsed = JSON.parse(cleaned) as Partial<ContextRecommendation>;
        if (
          typeof parsed.target === 'string' &&
          (VALID_TARGETS as ReadonlyArray<string>).includes(parsed.target)
        ) {
          recommendation = {
            target: parsed.target as ContextRecommendation['target'],
            uiKit:
              typeof parsed.uiKit === 'string' && parsed.uiKit.length > 0 ? parsed.uiKit : null,
            styling:
              typeof parsed.styling === 'string' && parsed.styling.length > 0
                ? parsed.styling
                : null,
            validation:
              typeof parsed.validation === 'string' && parsed.validation.length > 0
                ? parsed.validation
                : null,
            async:
              typeof parsed.async === 'string' && parsed.async.length > 0 ? parsed.async : null,
            notes: typeof parsed.notes === 'string' ? parsed.notes : undefined,
          };
        }
        llmBlock = result.text.trim();
      } catch {
        llmBlock = `_Sampling response could not be parsed as JSON. Raw text:_\n\n${result.text.trim()}`;
      }
    } else {
      llmBlock = `_Sampling failed (${result.reason}). Falling back to deterministic detection._`;
    }
  }

  const text = renderPromptTemplate('discover-context', {
    stackBlock,
    llmBlock,
    target: recommendation.target,
    recommendationJson: JSON.stringify(recommendation, null, 2),
  });

  return {
    messages: [{ role: 'user', content: { type: 'text', text } }],
  };
}
