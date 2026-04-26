import { getSection } from '../utils/docs-parser.js';

export const addFormArrayPromptDefinition = {
  name: 'add-form-array',
  description:
    'Превратить поле в массив: array(...) в FormSchema + FormArray UI из @reformer/cdk. Подгружает рецепты array-operations, array-cleanup и FormArray compound API.',
  arguments: [
    {
      name: 'code',
      description: 'Текущий код формы.',
      required: true,
    },
    {
      name: 'requirements',
      description:
        'Что должно быть массивом. Пример: "properties — массив объектов { type, address, value }; до 5 штук; первое — обязательно".',
      required: true,
    },
  ],
};

export function getAddFormArrayPrompt(args: { code: string; requirements: string }): {
  messages: Array<{ role: 'user'; content: { type: 'text'; text: string } }>;
} {
  const arrays = getSection('Arrays', '@reformer/core');
  const arrayOps = getSection('Array Operations', '@reformer/core');
  const arrayCleanup = getSection('Array Cleanup', '@reformer/core');
  const formArray = getSection('FormArray', '@reformer/cdk');
  const cdkRecipes = getSection('Nested', '@reformer/cdk');

  return {
    messages: [
      {
        role: 'user',
        content: {
          type: 'text',
          text: `Ты добавляешь динамический массив полей в форму на \`@reformer/*\`.

## Требования
${args.requirements}

## Текущий код формы
\`\`\`typescript
${args.code}
\`\`\`

## @reformer/core: Arrays — структура и операции

${arrays}

### Array Operations API (.at, .push, .removeAt, .move, .clear)

${arrayOps}

### Array Cleanup (через watchField с guard)

${arrayCleanup}

## @reformer/cdk: FormArray (UI compound)

${formArray}

### Recipes — nested arrays, custom AddButton

${cdkRecipes}

---

## Задание

1. **Расширь FormSchema** — поле становится \`array(itemSchema, { initialItems?, ... })\`. Item — отдельный \`createForm\`-подобный объект (sub-form).
2. **Доступ к элементам** — \`form.<arrayField>.at(i)\` (НЕ скобки), \`.length.value\`, \`.items.value\`.
3. **Mutations** — \`add(item?)\`, \`removeAt(i)\`, \`insert(i, item?)\`, \`move(from, to)\`, \`clear()\`. Не мутируй \`.items\` напрямую.
4. **UI** — через \`<FormArray.Root control={form.<arrayField>}>\` + \`<FormArray.List>\` + \`<FormArray.AddButton>\`. Если нужен кастомный AddButton — \`useFormArrayContext()\` хук.
5. **Validation массивов** — через \`validateItems\` в схеме item'а или общий \`validate(path.<arrayField>, ...)\` для cross-item правил.
6. **Cleanup при изменении внешнего поля** — \`watchField\` с guard'ом по длине (см. Array Cleanup секцию).
7. **Nested arrays** (массив в массиве) — отдельный \`array(...)\` внутри item-формы; в UI — \`<FormArray.Root control={itemPath.<innerArray>}>\` внутри \`<FormArray.List>\`.

В конце — короткий чек-лист «структура массива, UI, validation, cleanup».`,
        },
      },
    ],
  };
}
