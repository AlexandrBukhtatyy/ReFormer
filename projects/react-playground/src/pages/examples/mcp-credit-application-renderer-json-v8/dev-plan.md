# Iter-8 Dev Plan — `mcp-credit-application-renderer-json-v8`

Target: **renderer-json** (`createRenderSchemaFromJson` + `defineRegistry`)
Spec: `docs/specs/credit-application-form.md` (read-only).

## Wizard pair (A, B) decision

**A=A4 (manual useState), B=B3 (renderer-json + setHidden orchestration)**

### Why A4 instead of A1 (ui-kit `FormWizard`)?

A1 is the documented default for ui-kit stacks. Path C migration makes it real
(`@reformer/ui-kit/form-wizard` exports `FormWizard` with polymorphic `step.body`
accepting a `RenderNode<T>` subtree). However for **renderer-json + B3 setHidden
orchestration** there is an architectural conflict:

1. **B3 mechanics** require a single JSON tree where each step container has
   `selector: 'stepN'`. External `useEffect` toggles
   `schema.node('stepN').setHidden(n !== currentStep)`. Step state lives in a
   plain `useState` in `index.tsx`.
2. **A1 (ui-kit `FormWizard`)** is a self-contained step orchestrator: it owns
   `currentStep` internally (via headless `FormWizardContext`), it shows /
   hides step bodies inside its own `<Step>` slot, and its `step.body:
   RenderNode` is rendered through `<RenderNodeComponent>` — but that
   RenderNode does NOT participate in the outer `RenderSchemaProxy` override
   maps. There is no `selector: 'stepN'` to address from outside.
3. Mixing A1 with B3 would mean: (a) building 6 separate per-step JSON subtrees,
   (b) converting each via its own `RenderSchemaFn`, (c) packaging each into
   `FormWizardStep<T>['body']`. We lose the single `JsonFormSchema` document
   that B3 is built around, and we duplicate the form-injection-via-wrapper
   boilerplate per step.
4. iter-7 page 3 reached the same conclusion. A1 is correct for `target=core`
   and `target=renderer-react` with whole-form RenderSchemaFn; A4+B3 is correct
   when the layout is fully described in JSON and step visibility must be
   externally orchestrated.

A4+B3 cleanly preserves a single JSON document, single `setHidden` loop,
single `RenderSchemaFn`-wrapper for form-injection, and minimal app-specific
code in `index.tsx`.

## Files

1. `types.ts` — `CreditApplicationForm` + nested types (PersonalData,
   PassportData, Address, Property, ExistingLoan, CoBorrower).
   - Union literals (`LoanType`, `EmploymentStatus`, `MaritalStatus`,
     `EducationLevel`, `Gender`) declared as `type ... = 'a' | 'b' | ...`.
   - **Critical (Patch C):** no `extends FormFields` on leaf interfaces with
     union-literal fields — index signature would widen `'consumer' | 'mortgage' | …`
     back to `string`, breaking `FormProxy<T>` typing.
2. `schema.ts` — `createCreditApplicationForm()` builds a `FormProxy<CreditApplicationForm>`
   via `createForm({ form, behavior, validation })`.
   - Every `componentProps` (label/placeholder/options/mask/rows/type/min/max/step)
     lives on `createForm` componentProps (not only JSON) — required so that the
     renderer reads them at mount time. Otherwise `RadioGroup`/`Select` crash
     with `t.map is not a function` (D1).
   - Validation: `required`, `email`, `min`, `max`, `minLength`, `maxLength`,
     `pattern` — all with explicit `{ message: 'русский текст' }`.
   - Behavior: `enableWhen` (with `resetOnDisable` for conditional fields),
     `copyFrom` (registration→residence, email→emailAdditional),
     `computeFrom` (fullName, age, totalIncome, paymentRatio, monthlyPayment,
     interestRate, initialPayment for mortgage, coBorrowersIncome),
     `watchField` (`{ immediate: false }` always, equality guards), array
     cleanup on `hasProperty=false` etc.
   - **Patch I (computeFrom subscription rule)**: `fullName` subscribes to
     `[path.personalData]` (group node), not flat leaves — computeFn reads
     `values.personalData.lastName/firstName/middleName`.
3. `registry.tsx` — `createCreditApplicationRegistry()` returns `ComponentRegistry`.
   - ui-kit fields: `Input`, `InputMask`, `Textarea`, `Select`, `Checkbox`, `RadioGroup`.
   - ui-kit containers: `Box`, `Section`, `AsyncBoundary`.
   - **Path C (Patch C update):** `FormArraySection` from `@reformer/ui-kit/form-array`
     registered via `reg.container('FormArraySection', FormArraySection)`. JSON uses
     `"itemComponent": { "$template": {...} }` — converter wraps `$template` to FC.
   - Self-managed `FormRoot` with `__selfManagedChildren = true` marker. Receives
     `form` via `componentProps` (injected by RenderSchemaFn-wrapper, see below).
     Forwards `form` down to children via `<RenderNodeComponent form={form} ...>`.
   - `FIELD_WRAPPER` → `FormField` from ui-kit.
   - Sources for option arrays: `LOAN_TYPES`, `EMPLOYMENT_STATUSES`,
     `MARITAL_STATUSES`, `EDUCATIONS`, `GENDERS`, `EXISTING_LOAN_TYPES`,
     `RELATIONSHIPS`, `PROPERTY_TYPES` — referenced by name in JSON, but ALSO
     used directly in `schema.ts` componentProps so the runtime always finds them.
   - itemLabel sources for arrays. `LoadingState`/`ErrorStateDefault` for AsyncBoundary.
4. `render-schema.ts` — `JsonFormSchema` describing layout for all 6 steps as
   children of root `FormRoot`. Each step container uses `component: 'Box'` with
   `selector: 'step1'..'step6'`, `bg-white border rounded-xl shadow-sm p-6`.
   - Conditional sub-sections have selectors (`mortgage-section`, `car-section`,
     `residence-address-section`, `employer-section`, `business-section`,
     `properties-array`, `existing-loans-array`, `co-borrowers-array`).
   - FormArray sections use `FormArraySection` with `itemComponent: { $template: {...} }`.
   - testId convention: dotted-path (`step1.loanAmount`, etc.).
5. `data-fixture.ts` — `happyPathFixture: CreditApplicationForm` for Иванов И. И.,
   потребительский кредит 800 000 ₽ × 24 мес., работающий по найму, без
   имущества/созаёмщиков/доп. кредитов, все согласия + код 123456.
6. `index.tsx`:
   - `const form = useMemo(() => createCreditApplicationForm(), [])`.
   - `const registry = useMemo(() => createCreditApplicationRegistry(), [])`.
   - `const [currentStep, setCurrentStep] = useState(1)`.
   - **Patch F-1 (RenderSchemaFn-wrapper):**
     ```ts
     const schema = useMemo(() => {
       const baseFn = createRenderSchemaFromJson<CreditApplicationForm>(jsonSchema, registry);
       const fnWithForm: RenderSchemaFn<CreditApplicationForm> = (path) => {
         const root = baseFn(path) as ContainerRenderNode<CreditApplicationForm>;
         return { ...root, componentProps: { ...(root.componentProps ?? {}), form } };
       };
       return createRenderSchema(fnWithForm);
     }, [registry, form]);
     ```
   - `useEffect(() => { for (let n=1;n<=6;n++) schema.node(\`step${n}\`).setHidden(n!==currentStep); }, [schema, currentStep])`.
   - Conditional sub-section orchestration via `useFormControlValue` reading
     `loanType`, `employmentStatus`, `sameAsRegistration`, `hasProperty`,
     `hasExistingLoans`, `hasCoBorrower` and toggling `setHidden` on the
     respective sub-section selectors.
   - Step indicator strip (chips with icons + en-dashes, clickable to completed
     steps), nav buttons (`← Назад` / `Далее →` / `Отправить`), progress text
     under nav.
   - **Fake data fill button** (`{import.meta.env.DEV && ...}`) above the
     wizard, calls `form.setValue(happyPathFixture)`.
7. `dev-report.md` — final summary, tsc result, patch verification, screenshots
   path placeholder.

## Iter-8 patches verification

| Patch | Where applied |
|---|---|
| **G** (wizard hierarchy A1→A4) | dev-plan: A4 chosen with explicit architectural justification (B3 conflict). |
| **F-1** (RenderSchemaFn-wrapper) | `index.tsx`: `fnWithForm` injects `form` into root `FormRoot` componentProps. |
| **C** (T extends FormFields) | No custom array resolver in this implementation — array UI is `FormArraySection` from ui-kit, no custom logic that would need the constraint. |
| **H** (camelCase componentProps) | All readonly fields use `readOnly: true` (camelCase), never `readonly`. |
| **I** (computeFrom subscription) | `fullName` subscribes to `[path.personalData]` group node, computeFn reads `values.personalData.{lastName,firstName,middleName}`. |
| **D1** (no `r.map` crash) | All `Select`/`RadioGroup` `options` declared in `createForm` componentProps; JSON has same string-name reference via `reg.source(...)` but it is documentation, not runtime source-of-truth. |
| **D3** (FormArray plain leaves) | `FormArraySection` has no `initialValue` here (defaults to schema), but item template-factory in `schema.ts` returns plain leaf primitives (per `propertyFormSchema` etc.). |
| **C update** (Path C ui-kit migration) | `FormArraySection` registered as a container; JSON uses `itemComponent: { $template: {...} }` — converter wraps `$template` to FC automatically. |

## Out of scope

- Async fetch (regions/cities/car models) — left as static text inputs.
- view-mode (mode='view' fully readonly) — out of scope.
- Async submit handler (just `console.log` + `alert`).
