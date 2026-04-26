import { getSection, getFullDocs } from '../utils/docs-parser.js';

export const toRendererJsonPromptDefinition = {
  name: 'to-renderer-json',
  description:
    'Мигрировать TS RenderSchema (@reformer/renderer-react) в JSON-схему + Registry для @reformer/renderer-json. Подгружает migration cookbook, JsonFormSchema формат, registry rules.',
  arguments: [
    {
      name: 'code',
      description: 'Текущий код TS RenderSchema (RenderSchemaFn) и/или Form.',
      required: true,
    },
  ],
};

export function getToRendererJsonPrompt(args: { code: string }): {
  messages: Array<{ role: 'user'; content: { type: 'text'; text: string } }>;
} {
  const jsonSchemaFormat = getSection('JSON Schema', '@reformer/renderer-json');
  const registry = getSection('Component Registry', '@reformer/renderer-json');
  const cookbook = getFullDocs('@reformer/renderer-json'); // целиком — там есть Migration cookbook
  // Уберём верхушку (TOC) и оставим Cookbook + Recipes секции через простой slice по «Migration» секции:
  const migrationIdx = cookbook.indexOf('Migration');
  const migrationBlock =
    migrationIdx >= 0 ? cookbook.slice(migrationIdx, migrationIdx + 3000) : '';

  return {
    messages: [
      {
        role: 'user',
        content: {
          type: 'text',
          text: `Ты мигрируешь форму с \`@reformer/renderer-react\` (TS RenderSchema) на \`@reformer/renderer-json\` (JSON-схема + Registry).

## Текущий TS-код
\`\`\`typescript
${args.code}
\`\`\`

## Формат JsonFormSchema / JsonNode

${jsonSchemaFormat}

## Registry (defineRegistry, FIELD_WRAPPER, source values)

${registry}

## Migration cookbook (TS RenderSchema → JSON)

${migrationBlock}

---

## Задание

1. **Преврати TS RenderSchema в JsonFormSchema:**
   - \`{ component: path.email }\` → \`{ model: 'email', component: 'Input' }\`
   - \`{ component: Box, componentProps: { children: [...] } }\` → \`{ component: 'Box', children: [...] }\` (children вне componentProps)
   - \`{ component: Section, componentProps: { title: '...', children: [...] } }\` → \`{ component: 'Section', componentProps: { title: '...' }, children: [...] }\`
2. **Заполни Registry** через \`defineRegistry\`:
   - все используемые UI-компоненты как \`reg.field('Input', Input)\` / \`reg.container('Box', Box)\`
   - \`FIELD_WRAPPER\` — обязательно
   - константы options (LOAN_TYPES, GENDERS) — как \`reg.source('LOAN_TYPES', LOAN_TYPES)\`, в схеме ссылка строкой \`{ options: 'LOAN_TYPES' }\`
   - функции-итем-лейблы — как source-функции
3. **Массивы — через \`$template\`**: \`{ component: 'PropertyArray', componentProps: { itemComponent: { $template: { ... } } } }\`. Внутри template selector — без префикса родителя.
4. **Behavior НЕ переезжает в JSON** — оно остаётся TS-функцией \`RenderBehaviorFn<T>\` и применяется к финальной \`RenderSchemaProxy\`:
   \`\`\`tsx
   const fn = createRenderSchemaFromJson<T>(jsonSchema, registry);
   const proxy = createRenderSchema<T>(fn);
   myBehavior(proxy);  // hideWhen, patchProps, lifecycle
   <FormRenderer render={proxy} />
   \`\`\`
5. **Control-пропсы** (\`{ control: 'fieldName' }\`) — для передачи FieldPathNode в компоненты типа \`RendererFormArraySection\`. Ограничение: индексы массива в control нельзя.
6. **Versioning** — \`version: '1.0'\` обязательно.

В конце — короткий чек-лист «schema / registry / behavior / risks» и список компонентов, которые надо зарегистрировать.`,
        },
      },
    ],
  };
}
