import { getSection, getFullDocs } from '../utils/docs-parser.js';

export const addBehaviorPromptDefinition = {
  name: 'add-behavior',
  description:
    'Подобрать и встроить behavior (computeFrom, enableWhen, watchField, copyFrom, syncFields, revalidateWhen, resetWhen, transformValue) к существующей форме @reformer/core. Подгружает все behavior-рецепты + cycle-detection.',
  arguments: [
    {
      name: 'code',
      description: 'Текущий код формы (FormSchema, behavior callback если есть).',
      required: true,
    },
    {
      name: 'requirements',
      description:
        'Что должно происходить с формой. Пример: "при выборе страны — загружать список городов и сбрасывать city; total = price * quantity автоматически; mortgageInterest активен только если loanType === \'mortgage\'".',
      required: true,
    },
  ],
};

export function getAddBehaviorPrompt(args: { code: string; requirements: string }): {
  messages: Array<{ role: 'user'; content: { type: 'text'; text: string } }>;
} {
  const computeVsWatch = getSection('Compute', '@reformer/core');
  const watchField = getSection('Async', '@reformer/core');
  const cycleDetection = getSection('Cycle', '@reformer/core');

  // Все индивидуальные behaviors живут в отдельных файлах 23-27 — выгребем их через getFullDocs.
  // Для краткости берём только заголовки + первые секции через getSection по имени behavior.
  const copyFrom = getSection('copyFrom', '@reformer/core');
  const syncFields = getSection('syncFields', '@reformer/core');
  const resetWhen = getSection('resetWhen', '@reformer/core');
  const transformValue = getSection('transformValue', '@reformer/core');
  const revalidateWhen = getSection('revalidateWhen', '@reformer/core');
  const commonPatterns = getSection('Common Patterns', '@reformer/core');

  return {
    messages: [
      {
        role: 'user',
        content: {
          type: 'text',
          text: `Ты добавляешь behaviors к форме на \`@reformer/core\`.

## Требования
${args.requirements}

## Текущий код формы
\`\`\`typescript
${args.code}
\`\`\`

## Палитра behaviors

### computeFrom vs watchField

${computeVsWatch}

### watchField (async, guards)

${watchField}

### copyFrom

${copyFrom}

### syncFields

${syncFields}

### resetWhen

${resetWhen}

### transformValue

${transformValue}

### revalidateWhen

${revalidateWhen}

### Cycle detection (КРИТИЧНО)

${cycleDetection}

### Common Patterns

${commonPatterns}

---

## Задание

1. **Сопоставь требования с подходящим behavior** (см. таблицу compute-vs-watch для выбора между \`computeFrom\` / \`watchField\`).
2. **Разбей по типам:**
   - вычисляемые поля (sync, на одном уровне) — \`computeFrom\`
   - вкл/выкл по условию — \`enableWhen\` / \`disableWhen\` (с \`resetOnDisable\` если нужно)
   - реакция на изменение (async, side-effects) — \`watchField\` с \`debounce\` + guard \`cancelled\`
   - копирование значений — \`copyFrom\` (со \`when\`, \`fields\`, \`transform\`)
   - sync двух полей — \`syncFields\`
   - сброс при условии — \`resetWhen\`
   - нормализация ввода — \`transformValue\`
   - повторная валидация при зависимости — \`revalidateWhen\`
3. **Обязательно используй \`apply([...paths], schema)\`** если behavior повторяется на нескольких полях/группах.
4. **Cycle detection** — пройдись по чек-листу из секции выше. Особое внимание: consolidated \`watchField\`, guard \`disable/enable/setValue\`, сравнение массивов по длине.
5. Не дублируй существующие \`watchField\` callback'и — расширяй их.
6. Не используй \`computeFrom\` через уровни иерархии (только same level).

В конце — короткий чек-лист «какие требования закрыты, какие риски циклов».`,
        },
      },
    ],
  };
}
