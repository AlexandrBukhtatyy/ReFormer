import { getSection } from '../utils/docs-parser.js';
import {
  detectProjectStack,
  renderStackDetectionBlock,
  renderLayoutSkeletonBlock,
} from '../utils/project-detector.js';

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

export function getCreateFormPrompt(args: {
  description: string;
  target?: string;
  projectPath?: string;
}): {
  messages: Array<{ role: 'user'; content: { type: 'text'; text: string } }>;
} {
  const target = (args.target ?? 'core').toLowerCase();

  const quickStart = getSection('Quick Start', '@reformer/core');
  const formSchema = getSection('FormSchema', '@reformer/core');
  const imports = getSection('Import Patterns', '@reformer/core');
  const commonPatterns = getSection('Common Patterns', '@reformer/core');

  const stack = detectProjectStack(args.projectPath);
  const stackBlock = renderStackDetectionBlock(stack);
  const layoutBlock = renderLayoutSkeletonBlock(stack, target);

  const rendererBlock =
    target === 'renderer-react'
      ? `\n\n## RenderSchema (TS)\n\n${getSection('Quick Start', '@reformer/renderer-react')}\n\n${getSection('Render Schema', '@reformer/renderer-react')}`
      : target === 'renderer-json'
        ? `\n\n## JSON Schema\n\n${getSection('Quick Start', '@reformer/renderer-json')}\n\n${getSection('JSON Schema', '@reformer/renderer-json')}\n\n## Registry\n\n${getSection('Component Registry', '@reformer/renderer-json')}`
        : '';

  const layoutSection = layoutBlock ? `\n\n## Layout & Visual density\n\n${layoutBlock}` : '';

  return {
    messages: [
      {
        role: 'user',
        content: {
          type: 'text',
          text: `Ты помогаешь спроектировать и написать новую форму на \`@reformer/*\`.

## Целевой стек
\`${target}\` ${target === 'core' ? '(только @reformer/core + ручной React-рендеринг)' : target === 'renderer-react' ? '(@reformer/renderer-react + TS RenderSchema)' : '(@reformer/renderer-json + JSON-схема + Registry)'}

## Описание формы
${args.description}

## Stage 0: MCP discovery (КРИТИЧНО — выполни до генерации кода)

${stackBlock}

⚠️ **Если выше есть MCP-gap-вопрос** — НЕ продолжай. Верни оркестратору запрос на уточнение и ЖДИ ответа. Самостоятельный fallback на plain HTML / inline-style инвалидирует тест MCP.

${layoutSection}

## Контекст из документации

### Imports
${imports}

### Quick Start
${quickStart}

### FormSchema (структура полей)
${formSchema}

### Common Patterns (group, applyWhen, типы)
${commonPatterns}${rendererBlock}

---

## Задание

1. **Stage 0 (выше)** — проверь detected стек. Если MCP-gap — попроси уточнение и стоп.
2. **Спроектируй структуру формы** по описанию: какие поля, какие типы (\`string | number | boolean | Date | null\`), какие группы / массивы / nested-формы.
3. **Напиши typed interface** для формы (\`interface MyForm { ... }\`).
4. **Сгенерируй FormSchema** через \`createForm\` (а для \`renderer-react\` — ещё RenderSchemaFn; для \`renderer-json\` — JsonFormSchema + defineRegistry).
   - **Используй компоненты из detected ui-kit** (\`Input\`, \`Select\`, \`Checkbox\`, \`Textarea\` и т.д.) — НЕ plain HTML.
   - **Используй Tailwind layout** из секции «Layout skeleton» выше (Section/Box grid) — НЕ inline-style и НЕ plain \`<div>\` без классов.
5. **Не добавляй валидацию и behaviors** — это отдельные шаги (для них есть промпты \`add-validation\` и \`add-behavior\`).
6. **Используй \`useMemo\`** при создании формы в компоненте; импорты — точно как в секции «Imports» выше.
7. **Не выдумывай API** — только что есть в Quick Start, FormSchema, и detected ui-kit.

В конце — короткий чек-лист «что включено / что отложено на следующие шаги» + явное подтверждение «использовал \`@reformer/ui-kit\` + Tailwind по detected стеку» (или причину, почему нет).`,
        },
      },
    ],
  };
}
