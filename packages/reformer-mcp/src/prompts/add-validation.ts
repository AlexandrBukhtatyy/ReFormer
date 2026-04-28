import { getSection } from '../utils/docs-parser.js';

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

## ⚠️ Правило #1 — каждый валидатор с человеческим \`{ message }\`

Каждый вызов \`required\`, \`min\`, \`max\`, \`minLength\`, \`maxLength\`, \`pattern\`, \`email\` ОБЯЗАТЕЛЬНО передаёт \`{ message: '...' }\` с осмысленным русским текстом, описывающим конкретное поле.

\`\`\`typescript
// ❌ WRONG — пользователь видит "Поле обязательно для заполнения" под каждым полем,
// невозможно понять, что именно проверить
required(path.step1.loanAmount);
required(path.step2.passportData.series);

// ✅ RIGHT — конкретный текст для конкретного поля
required(path.step1.loanAmount,             { message: 'Введите сумму кредита' });
required(path.step2.passportData.series,    { message: 'Введите серию паспорта' });
required(path.step2.passportData.number,    { message: 'Введите номер паспорта' });
min(path.step1.loanAmount, 50000,           { message: 'Минимальная сумма — 50 000 ₽' });
pattern(path.step2.passportData.series, /^\\d{4}$/, { message: 'Серия паспорта — 4 цифры' });
\`\`\`

Без \`message\` каждое поле выглядит одинаково — UX-баг и ошибка валидации MCP-сценария.

## ⚠️ Правило #2 — \`applyWhen\` импортируй из \`/validators\`, не \`/behaviors\`

\`applyWhen\` существует в ОБЕИХ subpath:
- \`@reformer/core/validators\` — для условной валидации (\`applyWhen\` внутри \`validation:\`).
- \`@reformer/core/behaviors\` — для условной активации behavior (\`applyWhen\` внутри \`behavior:\`).

Если перепутаешь импорт — runtime молча зарегистрирует callback в неправильный реестр и валидация просто не сработает. Внутри \`validation: (path) => { ... }\` импортируй из \`@reformer/core/validators\`.

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
8. **Каждый \`required\`/\`min\`/\`max\`/\`minLength\`/\`pattern\`/\`email\` — с \`{ message: '...' }\`** (правило #1 в preamble). Дефолтный текст «Поле обязательно для заполнения» не приемлем.
9. **\`applyWhen\` — только из \`@reformer/core/validators\`** (не \`/behaviors\`) внутри validation callback (правило #2).
10. **\`(path: any)\` cast для deeply nested.** Если форма step-grouped с 4+ уровнями — validation callback аннотирует \`(path: any) => {...}\`, внутри \`applyWhen\` — \`(p: typeof path) => {...}\`. Без этого TS2589.
11. **\`validateItems(itemPath: any)\` cast** — внутри \`(path: any)\` обёртки item-path тоже \`any\`, иначе тип теряется.

## Финальный чек-лист (включи в ответ)

1. ✅ Каждый built-in validator с \`{ message: '...' }\` — пройдись по списку и проверь.
2. ✅ \`applyWhen\` импортирован из \`@reformer/core/validators\`.
3. ✅ Cross-field правила реализованы через \`validate(path.x, (value, ctx) => ctx.form.<other>.value...)\`.
4. ✅ Async-валидация (если требовалась) — с debounce и cancelled-guard.
5. ✅ Ни одного дефолтного «Поле обязательно для заполнения» в UI.`,
        },
      },
    ],
  };
}
