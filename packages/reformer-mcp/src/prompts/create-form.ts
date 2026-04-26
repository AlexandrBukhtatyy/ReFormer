import { getSection } from '../utils/docs-parser.js';

export const createFormPromptDefinition = {
  name: 'create-form',
  description:
    'Создать форму на @reformer/* по текстовому описанию полей. Подгружает quick-start, импорты и формат FormSchema из @reformer/core, а при target=renderer-react/renderer-json — соответствующий обвязочный пакет.',
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
  ],
};

export function getCreateFormPrompt(args: { description: string; target?: string }): {
  messages: Array<{ role: 'user'; content: { type: 'text'; text: string } }>;
} {
  const target = (args.target ?? 'core').toLowerCase();

  const quickStart = getSection('Quick Start', '@reformer/core');
  const formSchema = getSection('FormSchema', '@reformer/core');
  const imports = getSection('Import Patterns', '@reformer/core');
  const commonPatterns = getSection('Common Patterns', '@reformer/core');

  const rendererBlock =
    target === 'renderer-react'
      ? `\n\n## RenderSchema (TS)\n\n${getSection('Quick Start', '@reformer/renderer-react')}\n\n${getSection('Render Schema', '@reformer/renderer-react')}`
      : target === 'renderer-json'
        ? `\n\n## JSON Schema\n\n${getSection('Quick Start', '@reformer/renderer-json')}\n\n${getSection('JSON Schema', '@reformer/renderer-json')}\n\n## Registry\n\n${getSection('Component Registry', '@reformer/renderer-json')}`
        : '';

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

1. **Спроектируй структуру формы** по описанию: какие поля, какие типы (\`string | number | boolean | Date | null\`), какие группы / массивы / nested-формы.
2. **Напиши typed interface** для формы (\`interface MyForm { ... }\`).
3. **Сгенерируй FormSchema** через \`createForm\` (а для \`renderer-react\` — ещё RenderSchemaFn; для \`renderer-json\` — JsonFormSchema + defineRegistry).
4. **Не добавляй валидацию и behaviors** — это отдельные шаги (для них есть промпты \`add-validation\` и \`add-behavior\`).
5. **Используй \`useMemo\`** при создании формы в компоненте; импорты — точно как в секции «Imports» выше.
6. **Не выдумывай API** — только что есть в Quick Start и FormSchema.

В конце — короткий чек-лист «что включено / что отложено на следующие шаги».`,
        },
      },
    ],
  };
}
