Ты мигрируешь форму с прямого React-рендеринга (`@reformer/core` + ручной JSX) на декларативный TS RenderSchema через `@reformer/renderer-react`.

## Текущий код (direct rendering)
```typescript
{{code}}
```

## @reformer/renderer-react — Quick Start

{{quickStart}}

## RenderSchema формат (RenderSchemaFn, RenderNode, field vs container)

{{renderSchema}}

## Behavior helpers (hideWhen, renderEffect, onComponentEvent, lifecycle)

{{renderBehavior}}

## Cookbook (custom fieldWrapper, programmatic node manipulation)

{{cookbookBlock}}

---

## Задание

1. **Не трогай FormSchema** — `createForm` остаётся как был. Меняется только то, как форма рисуется в JSX.
2. **Опиши layout как RenderSchemaFn**:
   - Сигнатура: `(path: FieldPath<MyForm>) => RenderNode<MyForm>`.
   - Field-узел: `{ component: path.<field>, componentProps: { ... } }`.
   - Container-узел: `{ component: Box, componentProps: { className: '...', children: [ ...nodes ] } }` (children в `componentProps`, как в текущем API).
   - Контейнеры из `@reformer/ui-kit`: `Box`, `Section`, `Collapsible`, `AsyncBoundary`.
3. **Используй `createRenderSchema(fn)`** если планируешь применять behavior (`hideWhen`, `patchProps`, lifecycle). Без behavior можно передать `fn` напрямую в `<FormRenderer render={fn} />`.
4. **`fieldWrapper`** — передай `FormField` из `@reformer/ui-kit` через `settings`:
   ```tsx
   {{{{raw}}}}<FormRenderer render={schema} form={form} settings={{ fieldWrapper: FormField }} />{{{{/raw}}}}
   ```
   Это автоматически обернёт каждое поле в label/error/hint — больше не нужно делать вручную для каждого `useFormControl`.
5. **Selector'ы** — добавь `selector: 'unique-name'` тем узлам, к которым потом потребуется обращаться через `proxy.node('selector').setHidden(...)` / `patchProps(...)`.
6. **Конвертация условной видимости** — JSX `{condition && <X/>}` → `hideWhen(proxy.node('x'), () => !condition)`. Помни: `hideWhen` только скрывает; узел всё равно монтируется.
7. **Сохрани мемоизацию**: `const schema = useMemo(() => createRenderSchema(...), [])`. Иначе на каждый ререндер создаётся новый proxy и теряются behavior-эффекты.
8. **Не используй RenderSchema для одноразовых форм** — для < 5 полей прямой JSX чище.

В конце — короткий чек-лист «schema function / fieldWrapper / behavior / selector'ы / risks» и diff-сравнение «до → после» по структуре.