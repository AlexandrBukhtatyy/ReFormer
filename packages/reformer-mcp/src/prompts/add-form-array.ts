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

## ⚠️ Критические правила (читай ПЕРЕД генерацией кода)

### Правило #1 — \`initialValue\` для AddButton/push ВСЕГДА plain leaf values

\`FormArray.AddButton initialValue\` и \`array.push(...)\` / \`array.add(...)\` ждут **plain leaf values** (\`string\`, \`number\`, \`boolean\`, \`Date\`), НЕ FieldConfig-объекты вида \`{ value, component, componentProps }\`.

Если передашь FieldConfig — runtime молча сохранит весь объект как значение поля: Textarea отрисует \`[object Object]\`, Checkbox станет \`true\`, Select останется пустым. Это silent corruption — компилятор и тесты не поймают.

\`\`\`typescript
// ❌ WRONG — silent corruption
const wrong = () => ({
  type: { value: 'apartment', component: Select, ... },
  description: { value: '', component: Textarea, ... },
});

// ✅ RIGHT
const right = () => ({
  type: 'apartment',
  description: '',
  estimatedValue: 0,
  hasEncumbrance: false,
});
\`\`\`

FieldConfig (с \`component\`/\`componentProps\`) живёт ТОЛЬКО в \`createForm({...})\` initial schema. \`initialValue\` нового item — только VALUES.

### Правило #2 — НЕ \`enableWhen({ resetOnDisable: true })\` на whole ArrayNode

Эта комбинация запускает реактивный цикл на mount → браузер виснет, страница не загружается. Для условного показа массива гейти в JSX/RenderSchema:

\`\`\`tsx
{form.hasItems.value && <ArrayUI array={form.items} />}
\`\`\`

\`enableWhen\` на отдельных полях ВНУТРИ item шаблона — нормально.

### Правило #3 — Checkbox в array item: НЕ дублируй label (renderer-react)

Если используешь \`<CdkFormField.Root + Label + Control + Error>\` для item-полей, для \`Checkbox\` НЕ оборачивай в \`CdkFormField.Label\` — \`Checkbox\` из ui-kit сам рисует label справа от контрола. Иначе label покажется дважды. Pass label напрямую через \`componentProps.label\`.

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
8. **Template-factory для добавления** — выноси template как функцию-фабрику, возвращающую **plain leaf values** (НЕ FieldConfig — см. Правило #1 в preamble). Используй один и тот же template для \`<FormArray.AddButton initialValue={template()} />\` и для \`array.push(template())\`. Для renderer-json регистрируй template-фабрику рядом со схемой и импортируй в кастомный block-компонент.

### Если target = \`renderer-react\` — резолв FieldPath → ArrayNode для custom array-блоков

⚠️ **Когда массив рендерится через self-managed компонент в RenderSchema**, который получает \`control\` как prop и оборачивает \`<FormArray.Root>\`, нужно **резолвить FieldPath → ArrayNode**. Передача сырого \`path.step5.properties\` (FieldPathNode из RenderSchema callback) напрямую в \`<FormArray.Root control={...}>\` падает в runtime: \`TypeError: r.map is not a function\` (FormArray ждёт \`ArrayNode\`, а получает Proxy без \`push/removeAt/.items\`).

\`\`\`tsx
// ❌ WRONG — runtime "r.map is not a function"
function FormArrayBlock<TItem>({ control }: { control: ArrayNode<TItem> }) {
  return <FormArray.Root control={control}>...</FormArray.Root>;
}
// в RenderSchema:
{ component: FormArrayBlock, componentProps: { control: path.step5.properties } }

// ✅ RIGHT — резолвим FieldPath → ArrayNode через FieldPathNavigator
import { FieldPathNavigator, extractPath } from '@reformer/core';
import type { FieldPathNode, ArrayNode, FormProxy, FormFields } from '@reformer/core';

const navigator = new FieldPathNavigator();

function resolveArrayControl<T extends FormFields>(
  control: ArrayNode<T> | FieldPathNode<unknown, unknown>,
  form: FormProxy<unknown> | undefined,
): ArrayNode<T> | null {
  // Уже ArrayNode? Имеет push/removeAt.
  if (control && typeof control === 'object'
      && typeof (control as ArrayNode<T>).push === 'function') {
    return control as ArrayNode<T>;
  }
  if (!form) return null;
  try {
    const pathStr = extractPath(control as FieldPathNode<unknown, unknown>);
    const node = navigator.getNodeByPath(form, pathStr);
    return (node as unknown as ArrayNode<T>) ?? null;
  } catch { return null; }
}

interface FormArrayBlockProps<TItem extends FormFields> {
  form?: FormProxy<unknown>;  // injected by RenderNodeComponent (selfManaged)
  control: ArrayNode<TItem> | FieldPathNode<unknown, unknown>;
  // ...rest
}

function FormArrayBlock<TItem extends FormFields>({ control, form, ... }: FormArrayBlockProps<TItem>) {
  const arrayNode = resolveArrayControl<TItem>(control, form);
  if (!arrayNode) return null;
  return <FormArray.Root control={arrayNode}>...</FormArray.Root>;
}
(FormArrayBlock as any).__selfManagedChildren = true;  // чтобы получить form prop
\`\`\`

Без этого паттерна любой self-managed array-обёртка ломается в runtime. Маркер \`__selfManagedChildren = true\` обязателен — без него \`RenderNodeComponent\` не пробросит \`form\` в \`componentProps\`, и резолв не сможет найти ArrayNode.

### Если target = \`renderer-json\` — ОБЯЗАТЕЛЬНО используй \`RendererFormArraySection\`

⛔ **НИКОГДА не пиши per-page \`array-blocks.tsx\`** с \`CreditFormProvider\` + кастомными React-компонентами. Это анти-паттерн: форма должна быть полностью описана в JSON-схеме, без TS-glue.

✅ **Используй абстрактный компонент** \`RendererFormArraySection\` — это **app-level компонент**, который ты создаёшь в своём проекте (НЕ импортируй из \`@reformer/renderer-react\` — его там нет!). Шаблон реализации (~150 строк) живёт в \`packages/reformer-renderer-json/docs/llms/05-cookbook.md\` секция «Реализация компонента». Скопируй в свой проект (например \`src/components/RendererFormArraySection.tsx\`) ОДИН РАЗ, потом регистрируй и пользуйся из JSON через \`$template\`:

\`\`\`tsx
// registry.tsx — РАЗ на проект
import { defineRegistry } from '@reformer/renderer-json';
// app-level компонент, не из библиотеки!
import { RendererFormArraySection } from '@/components/RendererFormArraySection';
import { Input, Select, Textarea, Checkbox, Section, Box } from '@reformer/ui-kit';

export const registry = defineRegistry((reg) => {
  reg.container('FormArraySection', RendererFormArraySection); // ← один раз
  reg.container('Section', Section);
  reg.container('Box', Box);
  reg.field('Input', Input);
  reg.field('Select', Select);
  reg.field('Textarea', Textarea);
  reg.field('Checkbox', Checkbox);

  // Plain-leaves фабрики (НЕ FieldConfig!)
  reg.source('PROPERTY_TEMPLATE', { type: 'apartment', address: '', estimatedValue: 0 });
  reg.source('PROPERTY_TYPES', [
    { value: 'apartment', label: 'Квартира' },
    { value: 'house', label: 'Дом' },
  ]);
});
\`\`\`

\`\`\`jsonc
// render-schema.json — массив описывается ПОЛНОСТЬЮ декларативно
{
  "selector": "step5.properties-section",
  "component": "FormArraySection",
  "componentProps": {
    "control": "step5.properties",          // ← FieldPath строкой
    "title": "Имущество",
    "addButtonLabel": "+ Добавить имущество",
    "removeButtonLabel": "Удалить",
    "initialValue": "PROPERTY_TEMPLATE",     // ← ссылка на source
    "itemComponent": {
      "$template": {
        "component": "Box",
        "componentProps": { "className": "grid grid-cols-2 gap-4" },
        "children": [
          { "model": "type", "component": "Select", "componentProps": { "label": "Тип", "options": "PROPERTY_TYPES" } },
          { "model": "address", "component": "Input", "componentProps": { "label": "Адрес" } },
          { "model": "estimatedValue", "component": "Input", "componentProps": { "label": "Оценочная стоимость (₽)", "type": "number" } }
        ]
      }
    }
  }
}
\`\`\`

**Правила:**
- a. \`control\` — строка-FieldPath. Конвертер renderer-json резолвит её в \`FieldPathNode\`, сам компонент — в \`ArrayNode\` через инжектированный \`form\` prop.
- b. \`itemComponent\` — \`{ "$template": {...} }\`. Конвертер превращает в \`(itemPath) => RenderNode\`. Внутри template используй \`"model": "fieldName"\` (НЕ \`step5.properties.0.fieldName\`) — относительный путь от item.
- c. \`initialValue\` — строка-source-ID. Source в registry должен возвращать **PLAIN leaves** (см. Правило #1 выше).
- d. **Toggle visibility** (\`hasProperty\` → показ массива): используй top-level \`hideWhen\` через \`RenderBehaviorFn\` ИЛИ \`useEffect + setHidden\`. НЕ оборачивай array в кастомный block с \`if (!hasToggle) return null\`.

Полный шаблон реализации компонента + примеры toggle-видимости — см. \`@reformer/renderer-json/docs/llms/05-cookbook.md\` секции «Реализация компонента» и «Toggle-видимость массива». Компонент **обязательно** должен быть с маркером \`(RendererFormArraySection as any).__selfManagedChildren = true\` — без него \`RenderNodeComponent\` не пробросит ему \`form\` prop, и резолв \`FieldPath → ArrayNode\` сломается.

## Финальный чек-лист (включи в ответ)

1. ✅ Структура массива в FormSchema (тuple-литерал \`[itemSchema]\`).
2. ✅ Template-factory возвращает PLAIN leaf values (нет \`component\`/\`componentProps\` в нём).
3. ✅ UI: \`<FormArray.Root>\` + \`<FormArray.List>\` + AddButton/Remove. Для renderer-json — app-level \`RendererFormArraySection\` (по шаблону из cookbook) в registry + JSON \`$template\`. НЕ per-page array-blocks.tsx, НЕ импорт из \`@reformer/renderer-react\`.
4. ✅ Условный показ: JSX-conditional / \`hideWhen\` / \`setHidden\` (НЕ \`enableWhen + resetOnDisable\` на ArrayNode).
5. ✅ Validation: \`validateItems\`, гейтинг через \`applyWhen\` если массив зависит от toggle.
6. ✅ Cleanup на изменении внешнего поля (если применимо).
7. ✅ (renderer-react) Checkbox в item — без \`CdkFormField.Label\` обёртки.`,
        },
      },
    ],
  };
}
