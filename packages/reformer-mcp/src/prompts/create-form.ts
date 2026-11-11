import type { Server } from '@modelcontextprotocol/sdk/server/index.js';
import {
  detectProjectStack,
  renderStackDetectionBlockAsync,
} from '../platform/cli/project-detector.js';
import { renderPromptTemplate } from '../utils/prompt-template-loader.js';
import {
  inferTarget,
  isReformerTarget,
  type ReformerTarget,
} from '../platform/cli/sampling-helpers.js';

/**
 * Промпт `create-form` — новая форма по описанию.
 *
 * С 7.0 промпт ведёт к одному пути: грамматика → `form.intent.json` → `form_build`. Прежний текст
 * учил собирать модуль вручную (модель, схема, сборка, файлы раскладки) и противоречил инструкциям
 * сервера, которые требуют `form_build` (аудит 2026-11, A1/A2). Раскладку файлов теперь держит сама
 * сборка, поэтому `REFORMER_FORM_LAYOUT` на промпт больше не влияет.
 */
export const createFormPromptDefinition = {
  name: 'create-form',
  description:
    'Create a new @reformer form from a description: get the intent grammar, write form.intent.json, build it with form_build. Includes the detected project stack.',
  arguments: [
    {
      name: 'description',
      description:
        'The form in your own words: fields, types, initial values, links. E.g. "Sign-up: email, password, confirmPassword (must match), age (number, 18+)".',
      required: true,
    },
    {
      name: 'target',
      description:
        'Stack: "core" (you write the JSX markup), "renderer-react" (FormRenderer draws a TS schema), "renderer-json" (the schema is a JSON document + registry). Default "core".',
      required: false,
    },
    {
      name: 'projectPath',
      description:
        'Project folder whose package.json is used to detect the stack (UI kit, Tailwind). Default: the server working directory.',
      required: false,
    },
  ],
};

const TARGET_LABEL: Readonly<Record<ReformerTarget, string>> = {
  core: '(you write the JSX markup; everything else is built)',
  'renderer-react': '(FormRenderer draws the schema)',
  'renderer-json': '(the schema is a JSON document with a registry)',
};

/** Что на этом стеке остаётся агенту после сборки. */
export const TARGET_NOTE: Readonly<Record<ReformerTarget, string>> = {
  core:
    'On core form_build writes everything but the markup: `index.tsx` gets a stub that renders ' +
    '`null`. Replace it with your JSX — `<FormField control={bundle.form.<field>} />` per field, ' +
    'containers for the layout (arrays and steps: `find_recipe form-array`, `find_recipe wizard`) — ' +
    'and build again: form_build type-checks your markup and never overwrites it. Visibility rules ' +
    'are not printed on core: write such conditions in JSX.',
  'renderer-react':
    'On renderer-react form_build writes the whole module, `index.tsx` with `FormRenderer` included: ' +
    'you write no code unless the grammar sends you to `operators`.',
  'renderer-json':
    'On renderer-json form_build writes the whole module: the schema as a JSON document ' +
    '(`form.schema.json` — ui-builder opens it), `registry.ts` and `index.tsx`.',
};

export function targetLabelFor(target: ReformerTarget): string {
  return TARGET_LABEL[target];
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

  const text = renderPromptTemplate('create-form', {
    target,
    targetLabel: targetLabelFor(target),
    description: args.description,
    stackBlock: await renderStackDetectionBlockAsync(stack, server),
    targetNote: TARGET_NOTE[target],
  });

  return {
    messages: [{ role: 'user', content: { type: 'text', text } }],
  };
}
