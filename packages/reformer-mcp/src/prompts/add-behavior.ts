import { getSection } from '../utils/docs-parser.js';

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

## ⛔ Перед началом — CYCLE PREVENTION (читай ОБЯЗАТЕЛЬНО)

Behavior через \`watchField\` + \`computeFrom\` + \`copyFrom\` + \`revalidateWhen\` легко завязывается в реактивный цикл, который вешает страницу при mount (DOMContentLoaded не наступает, browser приходится перезапускать). Полная секция «Cycle Detection Prevention Checklist» — ниже, но базовые правила здесь:

1. **Сначала — только декларативные:** \`enableWhen\` / \`disableWhen\` / \`copyFrom\`. Ни одного \`watchField\`/\`computeFrom\` на первой итерации. Прогони \`tsc\` и визуальный smoke-test, убедись что страница монтируется. **Только потом** добавляй computed-поля.
2. **Каждый \`watchField\` — с \`{ immediate: false }\`.** Без исключений.
3. **\`watchField\` принимает ОДНО поле.** Сигнатура: \`watchField(path: FieldPathNode<TForm, TField>, callback, options)\`. Массив \`watchField([pathA, pathB], …)\` **не поддерживается** — runtime сломается (\`Cannot read properties of undefined (reading 'startsWith')\` в \`getFieldByPath\`), даже если TS пропустит через \`as any\`. Для нескольких триггеров — несколько \`watchField\` на разные trigger-paths, **все вызывают общую compute-функцию**:

\`\`\`typescript
const recomputeMonthlyPayment = (ctx) => {
  const amount = ctx.form.step1.loanAmount.value.value;
  const term = ctx.form.step1.loanTerm.value.value;
  const rate = ctx.form.interestRate.value.value;
  // ... compute + guard + ctx.form.monthlyPayment.setValue(...)
};

watchField(path.step1.loanAmount, (_, ctx) => recomputeMonthlyPayment(ctx), { immediate: false });
watchField(path.step1.loanTerm,   (_, ctx) => recomputeMonthlyPayment(ctx), { immediate: false });
\`\`\`

Правило «один watcher на trigger» означает: **не регистрируй два watchField на одну и ту же path** (это источник цикла). Несколько watchField на **разные** trigger-paths — норма.
4. **Guard каждый \`setValue\`:** проверь, что новое значение реально отличается от текущего (для массивов — сравни \`length\`, ссылки всегда разные).
5. **Guard \`enable\`/\`disable\`:** проверь \`field.disabled.value\` перед вызовом — повторный \`disable()\` на уже disabled поле триггерит signal на пустом месте.
6. **Не используй \`revalidateWhen\` без необходимости.** Если уже есть \`copyFrom\` + валидаторы на target — обычно \`revalidateWhen\` не нужен.
7. **\`computeFrom\` — только same-level**, для cross-level используй \`watchField\` (таблица «compute vs watch» ниже).
8. **НЕ используй \`enableWhen\` на FormArray/ArrayNode** (целиком на массив). \`enableWhen(path.someArray, …, { resetOnDisable: true })\` создаёт цикл и вешает браузер на mount (verified emprически в credit-application-form). Условную видимость массива делай в JSX-рендере (\`{form.flag.value && <ArrayUI/>}\`), а не через behavior.

Если требований много — реализуй их **двумя итерациями**: сначала минимальный набор enableWhen + copyFrom, протестируй, и только потом computed/watchField. Лучше отчитаться о двух коротких итерациях, чем о провале с зависанием браузера.

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
