import type { Server } from '@modelcontextprotocol/sdk/server/index.js';
import {
  detectProjectStack,
  renderStackDetectionBlockAsync,
  renderLayoutSkeletonBlock,
} from '../utils/project-detector.js';
import { renderPromptTemplate } from '../utils/prompt-template-loader.js';
import { inferTarget, isReformerTarget, type ReformerTarget } from '../utils/sampling-helpers.js';

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

function targetLabelFor(target: ReformerTarget): string {
  if (target === 'core') return '(только @reformer/core + ручной React-рендеринг)';
  if (target === 'renderer-react') return '(@reformer/renderer-react + TS RenderSchema)';
  return '(@reformer/renderer-json + JSON-схема + Registry)';
}

function rendererPrereqsFor(target: ReformerTarget): string {
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

type LayoutMode = 'minimalist' | 'folders';

/** Default form file layout the create-form prompt steers toward.
 *  Configured via `REFORMER_FORM_LAYOUT` in the MCP server registration (`.mcp.json` env),
 *  same mechanism as `REFORMER_DEBUG`. Unset / unrecognized → `minimalist`. */
function normalizeLayout(raw: string | undefined): LayoutMode {
  return (raw ?? '').trim().toLowerCase() === 'folders' ? 'folders' : 'minimalist';
}

function layoutGuidanceFor(mode: LayoutMode): string {
  if (mode === 'folders') {
    return (
      '**Default layout = `folders`** (set via `REFORMER_FORM_LAYOUT`). Use the folder module: ' +
      '`lib/` (domain) + `schema/` (model / schema / behavior / validation) + ' +
      '`components/steps/` (one component per step) + `nested-forms/` + entry + `index.ts`. ' +
      'See `find_recipe directory-layout` for the full per-target tree.'
    );
  }
  return (
    '**Default layout = `minimalist`** (flat, one file per concern). Flat form module — no ' +
    '`lib/` / `schema/` / `components/steps/` nesting: a single `index.tsx` with ALL steps inline, ' +
    'plus plain-named files `types.ts`, `model.ts`, `validation.ts`, `data-sources.ts`, `api.ts`. ' +
    'Only the two layer-variable concerns carry a dot-prefix (`form.` = M1/model layer, ' +
    '`renderer.` = render layer): **schema** — `form.schema.ts` (core) / `renderer.schema.ts` ' +
    '(renderer-react) / `renderer.schema.json` (renderer-json); **behavior** — `form.behavior.ts` ' +
    '(model behavior, all targets) + `renderer.behavior.ts` (render behavior, renderer-react & ' +
    'renderer-json). renderer-json also adds `registry.ts`. The base is identical across targets. ' +
    'Scale up to the `folders` layout only for large forms. See `find_recipe directory-layout` for ' +
    'the full per-target tree.'
  );
}

export async function getCreateFormPrompt(
  args: { description: string; target?: string; projectPath?: string },
  server?: Server
): Promise<{
  messages: Array<{ role: 'user'; content: { type: 'text'; text: string } }>;
}> {
  const stack = detectProjectStack(args.projectPath);

  // Валидируем переданный target; невалидный/пустой → авто-детект, а не молчаливый мусор.
  const pinned = args.target ? args.target.toLowerCase() : undefined;
  const target: ReformerTarget = isReformerTarget(pinned)
    ? pinned
    : server
      ? await inferTarget(server, { description: args.description, stack })
      : 'core';

  const stackBlock = await renderStackDetectionBlockAsync(stack, server);
  const layoutBlock = renderLayoutSkeletonBlock(stack, target);
  const layoutSection = layoutBlock
    ? layoutBlock
    : '_No layout skeleton — ui-kit/Tailwind not detected. Once you confirm the styling system with the orchestrator, follow Tailwind utility classes (`grid grid-cols-2 gap-4`, `space-y-4`, `bg-white border rounded-xl shadow-sm p-6`)._';

  const layoutMode = normalizeLayout(process.env.REFORMER_FORM_LAYOUT);
  const layoutGuidance = layoutGuidanceFor(layoutMode);

  const text = renderPromptTemplate('create-form', {
    target,
    targetLabel: targetLabelFor(target),
    description: args.description,
    stackBlock,
    layoutSection,
    rendererPrereqs: rendererPrereqsFor(target),
    layoutMode,
    layoutGuidance,
  });

  return {
    messages: [{ role: 'user', content: { type: 'text', text } }],
  };
}
