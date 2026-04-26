import { getSection } from '../utils/docs-parser.js';

export const addWizardPromptDefinition = {
  name: 'add-wizard',
  description:
    'Превратить single-form в multi-step через FormWizard из @reformer/cdk. Подгружает multi-step стратегию из @reformer/core и FormWizard compound API + recipes.',
  arguments: [
    {
      name: 'code',
      description: 'Текущий код single-page формы.',
      required: true,
    },
    {
      name: 'steps',
      description:
        'Описание шагов. Пример: "Шаг 1 «Личные данные» (firstName, lastName, email); Шаг 2 «Адрес» (country, city, street); Шаг 3 «Подтверждение» (review + submit)".',
      required: true,
    },
  ],
};

export function getAddWizardPrompt(args: { code: string; steps: string }): {
  messages: Array<{ role: 'user'; content: { type: 'text'; text: string } }>;
} {
  const multiStep = getSection('Multi', '@reformer/core');
  const formWizard = getSection('FormWizard', '@reformer/cdk');
  const cdkRecipes = getSection('wizard', '@reformer/cdk');

  return {
    messages: [
      {
        role: 'user',
        content: {
          type: 'text',
          text: `Ты превращаешь single-form в multi-step wizard на \`@reformer/cdk\`.

## Шаги (из требований)
${args.steps}

## Текущий код формы
\`\`\`typescript
${args.code}
\`\`\`

## @reformer/core: Multi-step стратегия (STEP_VALIDATIONS, validateForm)

${multiStep}

## @reformer/cdk: FormWizard compound API

${formWizard}

### Recipes — conditional steps, externally-controlled wizard

${cdkRecipes}

---

## Задание

1. **Раздели существующие поля по шагам** согласно описанию. Не переименовывай поля — только группировка визуальная.
2. **Создай \`STEPS\` массив** с конфигурацией: \`{ name, title, icon?, component }\`. \`component\` — отдельный React-компонент с полями данного шага.
3. **STEP_VALIDATIONS map** — \`{ <stepName>: (path) => { /* validate(...) для полей этого шага */ } }\`. На \`goToNextStep()\` будет валидация только этого шага.
4. **\`fullValidation\`** — отдельная функция, которая валидирует ВСЁ (включая cross-step правила) — вызывается перед submit.
5. **Wrapping JSX**:
   \`\`\`tsx
   <FormWizard form={form} steps={STEPS} stepValidations={STEP_VALIDATIONS} fullValidation={fullValidation}>
     <FormWizard.Indicator />
     {STEPS.map(s => <FormWizard.Step key={s.name} name={s.name}><s.component /></FormWizard.Step>)}
     <FormWizard.Actions onSubmit={handleSubmit}>
       <FormWizard.Prev>Назад</FormWizard.Prev>
       <FormWizard.Next>Далее</FormWizard.Next>
       <FormWizard.Submit>Отправить</FormWizard.Submit>
     </FormWizard.Actions>
   </FormWizard>
   \`\`\`
6. **Условные шаги** — управляй через \`steps\` prop динамически (фильтрация массива) либо через \`useRef<FormWizardHandle>().goToStep(n)\` если переход не линейный.
7. **Не дублируй валидацию** — если поле есть в \`STEP_VALIDATIONS\`, не повторяй то же правило в \`fullValidation\` (используй \`apply([...])\` для повторного использования).

В конце — короткий чек-лист «STEPS / step validations / submit / условная навигация».`,
        },
      },
    ],
  };
}
