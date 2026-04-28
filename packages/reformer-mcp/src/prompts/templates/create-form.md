Ты помогаешь спроектировать и написать новую форму на `@reformer/*`.

## Целевой стек
`{{target}}` {{targetLabel}}

## Описание формы
{{description}}

## Stage 0: MCP discovery (КРИТИЧНО — выполни до генерации кода)

{{stackBlock}}

⚠️ **Если выше есть MCP-gap-вопрос** — НЕ продолжай. Верни оркестратору запрос на уточнение и ЖДИ ответа. Самостоятельный fallback на plain HTML / inline-style инвалидирует тест MCP.

{{layoutSection}}

## Контекст из документации

### Imports
{{imports}}

### Quick Start
{{quickStart}}

### FormSchema (структура полей)
{{formSchema}}

### Common Patterns (group, applyWhen, типы)
{{commonPatterns}}{{rendererBlock}}

---

## Задание

1. **Stage 0 (выше)** — проверь detected стек. Если MCP-gap — попроси уточнение и стоп.
2. **Спроектируй структуру формы** по описанию: какие поля, какие типы (`string | number | boolean | Date | null`), какие группы / массивы / nested-формы.
3. **Напиши typed interface** для формы (`interface MyForm { ... }`).
4. **Сгенерируй FormSchema** через `createForm` (а для `renderer-react` — ещё RenderSchemaFn; для `renderer-json` — JsonFormSchema + defineRegistry).
   - **Используй компоненты из detected ui-kit** (`Input`, `Select`, `Checkbox`, `Textarea` и т.д.) — НЕ plain HTML.
   - **Используй Tailwind layout** из секции «Layout skeleton» выше (Section/Box grid) — НЕ inline-style и НЕ plain `<div>` без классов.
5. **Не добавляй валидацию и behaviors** — это отдельные шаги (для них есть промпты `add-validation` и `add-behavior`).
6. **Используй `useMemo`** при создании формы в компоненте; импорты — точно как в секции «Imports» выше.
7. **Не выдумывай API** — только что есть в Quick Start, FormSchema, и detected ui-kit.
8. **FormField — две версии.** В detected ui-kit есть **wrapper** `FormField` (импорт `from '@reformer/ui-kit'`, API `<FormField control={form.x} testId="x" />`); в `@reformer/cdk/form-field` есть **compound** `FormField.Root/Label/Control/Error`. Skeleton выше использует **wrapper** из ui-kit. Для disambiguation у `get_symbol_docs` передавай `package: "@reformer/ui-kit"`.
9. **Deeply nested forms.** Если форма имеет 4+ уровня (например, step-grouped как credit-application), дополни типизацию интерфейсов `extends FormFields` (или `[key: string]: FormValue` index signature) — иначе `createForm<T>` не примет такой generic. Также используй cast `createForm as (config: { form: unknown; validation: unknown; behavior: unknown }) => FormProxy<T>` чтобы избежать TS2589 на validation/behavior callbacks. Validation/behavior callback annotation: `(path: any) => {...}`. Внутри `applyWhen` — `(p: typeof path) => {...}`.
10. **FormSchema для массивов = tuple.** Поле-массив описывается как `arrField: [itemSchema]` (tuple с одним template-элементом). НЕ как `{ value: [], itemSchema: {...} }` (silent corruption).
11. **FormArray.AddButton initialValue.** Принимает PLAIN leaf values (не FieldConfig-объекты со `{ value, component }`). Иначе `description` рендерится как `[object Object]`. Template factory должна вернуть `{ type: 'apartment', estimatedValue: 0, ... }` без обёрток.
12. **Conditional поля → hide, не disable.** Поле, которое не имеет смысла для текущего контекста (mortgage-only при loanType=consumer; auto-only; business-only employment) должно **исчезать из DOM**, а не оставаться видимым серым. Используй JSX-conditional (`{loanType === 'mortgage' && <FormField .../>}`) для target=core, `hideWhen` / `schema.node().setHidden(...)` для renderer-react, `setHidden` из `useEffect` для renderer-json. `enableWhen` оставь только для прогрессивного раскрытия (`confirmPassword` после ввода `password`).
13. **Spec compliance — literal.** Используй спеку как контракт: КАЖДОЕ поле спеки = отдельное поле в FormSchema с тем же именем. НЕ объединять (`carBrand` + `carModel` ≠ одно `carModelBrand`), НЕ пропускать (`gender`, `birthPlace`, `snils` etc), НЕ переносить между шагами (`hasProperty` живёт в step5, не в step4). Если поле `parent.child` в спеке — пиши `parent: { child: {...} }` в схеме (не `parent_child`).
14. **testId convention — dotted-path.** Передавай `testId` как путь по структуре: `<FormField testId="step1.loanAmount" />`, `<FormField testId="step2.passportData.series" />`. НЕ просто leaf name (`testId="loanAmount"`) — collisions неизбежны при дублирующихся именах в разных шагах. Это критично для тестов и автоматизации.
15. **User-facing strings — из спеки, не выдумывать.** Все label, placeholder, error message бери из спеки или родного языка пользователя. НЕ оставлять дефолтные английские placeholder типа `"Select an option..."` (Radix Select default). НЕ изобретать единицы — `(₽)` для денег, `(месяцев)` (полное слово) для сроков, единый стиль на всех страницах.
16. **`required(...)` ВСЕГДА с `{ message: '...' }`.** Без message пользователь видит дефолтное `"Поле обязательно для заполнения"` — невозможно понять, какое поле где. Пиши осмысленный текст: `required(path.step1.loanAmount, { message: 'Введите сумму кредита' })`.
17. **`Select` / `RadioGroup` — `options` ОБЯЗАТЕЛЬНО на уровне `createForm` componentProps.** Без `options` runtime падает: `TypeError: t.map is not a function` (RadioGroup) или показывается пустой dropdown (Select). Это правило критично для **renderer-json**: JSON-уровень `componentProps: { options: 'LOAN_TYPES' }` НЕ пробрасывается в input (renderer берёт `state.componentProps` из FieldNode, не из JSON-ноды). Если поле — `Select`/`RadioGroup`, опции должны быть в `createForm({ ..., loanType: { value: 'consumer', component: Select, componentProps: { label: 'Тип', options: LOAN_TYPES, placeholder: 'Выберите тип' } } })`. JSON может **дублировать** `options` для документации, но source-of-truth — schema. Импортируй массивы options из `registry.tsx` или общего файла, чтобы переиспользовать без дублирования.

## Финальный чек-лист (включи в ответ ОБЯЗАТЕЛЬНО)

1. ✅ Использовал ui-kit + Tailwind (detected stack), не plain HTML.
2. ✅ Структура form: `step1, step2, ..., step6` точно по спеке (если форма step-grouped).
3. ✅ Все поля спеки включены — пройдись по списку и проверь по галочке. Если что-то пропущено — обоснуй.
4. ✅ FieldConfig полностью: `{ value, component, componentProps }` для каждого поля.
5. ✅ Conditional поля скрыты JSX-conditional / hideWhen / setHidden, НЕ enableWhen-as-disabled.
6. ✅ testId = dotted-path по структуре schema.
7. ✅ `required(...)` каждое — с человеческим `{ message }`.
8. ✅ FormArray template factory возвращает PLAIN leaves (без `component`/`componentProps`).
9. ✅ Все user-facing strings локализованы и берутся из спеки.
10. ✅ Все Select/RadioGroup имеют `options` в createForm-level componentProps (не только в JSON для renderer-json).

В конце — явное подтверждение «использовал `@reformer/ui-kit` + Tailwind по detected стеку» (или причину, почему нет).