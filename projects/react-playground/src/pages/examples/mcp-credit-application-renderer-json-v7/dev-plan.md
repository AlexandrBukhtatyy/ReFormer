# dev-plan — iter-7 page 3 (renderer-json) credit-application

## Цель

Реализовать форму "Заявка на кредит" (`docs/specs/credit-application-form.md`) с **target=renderer-json**, регрессионно протестировать iter-6 patches (особенно label/options правило, RenderSchemaFn-wrapper, FormRoot self-managed pattern, $template для FormArray).

## Выбор пары (A, B)

- **A4 (manual `useState`) + B3 (`renderer-json` setHidden)**.
- A1 (ui-kit `FormWizard`) — недоступен: `@reformer/ui-kit` не экспортирует `FormWizard`.
- A2 (project-custom wrapper) — недоступен: в `projects/react-playground/src/components/` нет `AppWizard`/аналога; есть только `RendererFormArraySection`.
- A3 (CDK `FormWizard` compound) — формально применим, но архитектурно конфликтует с B3:
  - CDK `FormWizard.Step` рендерит **только активный шаг** (через `currentStep === _stepIndex`).
  - B3 паттерн: `FormRenderer` рендерится **один раз**, ВСЕ шаги смонтированы, видимость гоняется через `schema.node('stepN').setHidden(...)`.
  - Эти две модели взаимоисключающи. Чтобы использовать A3, пришлось бы либо размонтировать FormRenderer (теряя state у скрытых шагов), либо ставить 6 пустых `FormWizard.Step`-шеллов только ради подсчёта totalSteps + рендерить FormRenderer как sibling — это анти-паттерн.
- **A4** даёт прямой доступ к `currentStep` для `useEffect setHidden`-loop, валидация шага через `validateForm(form, STEP_VALIDATIONS[currentStep])` в `goNext()`.

## Файлы

1. **`dev-plan.md`** (этот) — план + (A, B) обоснование.
2. **`types.ts`** — interface `CreditApplicationForm` + leaf interfaces (PersonalData, PassportData, Address, Property, ExistingLoan, CoBorrower). **БЕЗ `extends FormFields`** на интерфейсах с union-literal полями — иначе widening к `string` ломает FormProxy.
3. **`schema.ts`** — `createCreditApplicationForm()`:
   - createForm + STEP_VALIDATIONS (6 ключей) + fullValidation + behavior (минимально: copy registration→residence; cleanup hasProperty/hasExistingLoans/hasCoBorrower).
   - 3 plain-leaf templates (PROPERTY_TEMPLATE, EXISTING_LOAN_TEMPLATE, COBORROWER_TEMPLATE) — для AddButton initialValue.
   - **Все Select / RadioGroup имеют `options` + `label` + `placeholder` в createForm-level componentProps** (Patch D).
   - **Все InputMask имеют `mask` + `label` + `placeholder` в createForm-level componentProps**.
   - cast `createForm as ...` для обхода TS2589 на 4+ уровнях вложенности.
4. **`registry.tsx`** — `defineRegistry`:
   - ui-kit fields: Input, InputMask, Textarea, Select, Checkbox, RadioGroup.
   - ui-kit containers: Box, Section.
   - **`FormRoot`** (self-managed, `__selfManagedChildren = true`) — корень дерева, прокидывает `form` в `RenderNodeComponent` для каждого child.
   - **`RendererFormArraySection`** (импорт из `../../../components/`).
   - `FIELD_WRAPPER` → `FormField` (ui-kit).
   - 8 option arrays через `reg.source(...)`: LOAN_TYPES, EMPLOYMENT_STATUSES, MARITAL_STATUSES, EDUCATIONS, GENDERS, PROPERTY_TYPES, EXISTING_LOAN_TYPES, RELATIONSHIPS.
   - 3 templates через `reg.source(...)`: PROPERTY_TEMPLATE, EXISTING_LOAN_TEMPLATE, COBORROWER_TEMPLATE.
5. **`render-schema.ts`** — `creditApplicationJsonSchema: JsonFormSchema`:
   - root: `FormRoot` (`selector: 'root'`).
   - 6 step children, каждый с `selector: 'step{N}'`.
   - Внутри каждого шага — Section (card wrap) + Box (grid layouts) + поля по `model: 'fieldName'`.
   - Conditional sub-sections (mortgage, car, residence, employer, business, properties, existingLoans, coBorrowers) — каждая с своим `selector` для `setHidden`.
   - Шаг 5: 3× `RendererFormArraySection` с `componentProps.itemComponent.$template = {...}` ссылается на template по строке через source.
   - **БЕЗ `array-blocks.tsx`**.
6. **`index.tsx`** — A4 + B3:
   - `useMemo(() => createCreditApplicationForm())`.
   - `useMemo(() => createCreditApplicationRegistry())`.
   - **RenderSchemaFn-wrapper** для form-injection: `baseFn = createRenderSchemaFromJson<T>(jsonSchema, registry)`, `fnWithForm: RenderSchemaFn<T> = (path) => ({ ...baseFn(path) as ContainerRenderNode<T>, componentProps: { ...root.componentProps, form } })`. Затем `createRenderSchema(fnWithForm)`.
   - `useState(currentStep, completedSteps)`.
   - `useEffect setHidden('stepN')` для всех 6 шагов.
   - `useEffect setHidden(...)` для 8 conditional sub-sections, подписан через `useFormControlValue` (через подписку на отдельные fieldNodes).
   - StepIndicator с lucide-react icons + en-dashes между chips.
   - Nav buttons: `← Назад` / `Далее →` / `Отправить`, с progress text.
   - Card wrap: `bg-white border rounded-xl shadow-sm p-6 space-y-4`.
7. **`dev-report.md`** — выбор (A, B) с обоснованием, какие patches помогли, gaps, замечания.

## Регрессионные точки iter-6 patches

- **Patch D** (label/options/placeholder/mask на createForm-уровне) — критично, иначе RadioGroup упадёт `t.map is not a function`, Select/Input будут пустыми.
- **Patch F-1** (RenderSchemaFn-wrapper boilerplate) — без него `form` не дойдёт до FormRoot и поля будут молча пустыми.
- **Patch G** (wizard hierarchy) — A1→A2→A3→A4, документировать обоснование пропуска A3.
- **`__selfManagedChildren = true`** на FormRoot и RendererFormArraySection — иначе `form` prop не пробрасывается.
- **$template для array items** — иначе пришлось бы писать `array-blocks.tsx` (анти-паттерн).
- **Plain-leaf initialValue** для AddButton (никаких FieldConfig) — иначе silent corruption.

## Жёсткие запреты (соблюдаем)

- НЕ редактируем спеку, App.tsx.
- НЕ создаём `array-blocks.tsx` или per-page array-блоки.
- НЕ импортируем `RendererFormArraySection` из `@reformer/renderer-react` (его там нет — он в `projects/react-playground/src/components/`).
- НЕ запускаем dev-server / playwright.
- НЕ коммитим.
