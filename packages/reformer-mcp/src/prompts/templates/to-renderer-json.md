Ты мигрируешь форму с `@reformer/renderer-react` (TS RenderSchema) на `@reformer/renderer-json` (JSON-схема + Registry).

## Текущий TS-код
```typescript
{{code}}
```

## Формат JsonFormSchema / JsonNode

{{jsonSchemaFormat}}

## Registry (defineRegistry, FIELD_WRAPPER, source values)

{{registry}}

## Migration cookbook (TS RenderSchema → JSON)

{{migrationBlock}}

---

## Задание

1. **Преврати TS RenderSchema в JsonFormSchema:**
   - `{ component: path.email }` → `{ model: 'email', component: 'Input' }`
   - `{ component: Box, componentProps: { children: [...] } }` → `{ component: 'Box', children: [...] }` (children вне componentProps)
   - `{ component: Section, componentProps: { title: '...', children: [...] } }` → `{ component: 'Section', componentProps: { title: '...' }, children: [...] }`
2. **Заполни Registry** через `defineRegistry`:
   - все используемые UI-компоненты как `reg.field('Input', Input)` / `reg.container('Box', Box)`
   - `FIELD_WRAPPER` — обязательно
   - константы options (LOAN_TYPES, GENDERS) — как `reg.source('LOAN_TYPES', LOAN_TYPES)`, в схеме ссылка строкой `{ options: 'LOAN_TYPES' }`
   - функции-итем-лейблы — как source-функции
3. **Массивы — через `$template`**: `{ component: 'PropertyArray', componentProps: { itemComponent: { $template: { ... } } } }`. Внутри template selector — без префикса родителя.
4. **Behavior НЕ переезжает в JSON** — оно остаётся TS-функцией `RenderBehaviorFn<T>` и применяется к финальной `RenderSchemaProxy`:
   ```tsx
   const fn = createRenderSchemaFromJson<T>(jsonSchema, registry);
   const proxy = createRenderSchema<T>(fn);
   myBehavior(proxy);  // hideWhen, patchProps, lifecycle
   <FormRenderer render={proxy} />
   ```
5. **Control-пропсы** (`{ control: 'fieldName' }`) — для передачи FieldPathNode в компоненты типа `RendererFormArraySection`. Ограничение: индексы массива в control нельзя.
6. **Versioning** — `version: '1.0'` обязательно.

В конце — короткий чек-лист «schema / registry / behavior / risks» и список компонентов, которые надо зарегистрировать.