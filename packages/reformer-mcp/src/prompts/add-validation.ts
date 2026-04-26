import { getSection, getFullDocs } from '../utils/docs-parser.js';

export const addValidationPromptDefinition = {
  name: 'add-validation',
  description:
    'Добавить валидаторы (built-in или кастомные, sync/async, cross-field) к существующей форме @reformer/core. Подгружает справочник валидаторов, async-watchfield и common-mistakes.',
  arguments: [
    {
      name: 'code',
      description: 'Текущий код формы (FormSchema, createForm и т.п.).',
      required: true,
    },
    {
      name: 'requirements',
      description:
        'Какие правила нужно навесить. Пример: "email обязателен и формат email; password ≥ 8 символов с цифрой; confirmPassword == password; уникальность email через GET /api/check-email".',
      required: true,
    },
  ],
};

export function getAddValidationPrompt(args: { code: string; requirements: string }): {
  messages: Array<{ role: 'user'; content: { type: 'text'; text: string } }>;
} {
  const validators = getSection('Validation', '@reformer/core');
  const apiSignatures = getSection('API SIGNATURES', '@reformer/core');
  const asyncWatch = getSection('Async', '@reformer/core');
  const commonMistakes = getSection('Common Mistakes', '@reformer/core');

  // Cross-field живёт в multi-step и common-patterns
  const crossField = getSection('Cross', '@reformer/core');

  return {
    messages: [
      {
        role: 'user',
        content: {
          type: 'text',
          text: `Ты добавляешь валидацию к форме на \`@reformer/core\`.

## Требования к валидации
${args.requirements}

## Текущий код формы
\`\`\`typescript
${args.code}
\`\`\`

## Справочник валидаторов

${validators}

## API сигнатуры (built-in validators, validate, applyWhen)

${apiSignatures}

## Async-валидация (debounce, guard, race conditions)

${asyncWatch}

## Cross-field

${crossField}

## Типичные ошибки

${commonMistakes}

---

## Задание

1. **Подбери built-in** валидаторы для требований где можно (\`required\`, \`email\`, \`minLength\`, \`pattern\`, \`min\`, \`max\`, \`url\`, \`phone\`, \`number\`, \`isDate\`, \`minDate\`, \`maxDate\`, \`pastDate\`, \`futureDate\`, \`minAge\`, \`maxAge\`).
2. **Кастомные правила** — через \`validate(path.field, (value, ctx) => ...)\` с возвратом \`{ code, message }\` или \`null\`.
3. **Async-проверки** — через \`validateAsync\` с \`debounce\` и guard'ом по \`cancelled\` (см. секцию async выше).
4. **Cross-field** — через \`ctx.form.<other>.value\` внутри \`validate(...)\`.
5. **Условная валидация** — через \`applyWhen\`.
6. **Импорты** — \`import { required, email, validate, ... } from '@reformer/core/validators'\`. Не пиши собственных валидаторов для того, что уже есть в built-in.
7. Не меняй структуру FormSchema — только добавь \`validation\` callback.

В конце — короткий чек-лист «какие требования закрыты, что осталось».`,
        },
      },
    ],
  };
}
