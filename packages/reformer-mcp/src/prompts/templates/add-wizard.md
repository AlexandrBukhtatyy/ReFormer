You convert a single-page form into a multi-step wizard. Two questions to answer in order:

1. **Which wizard implementation?** — pick by hierarchy (Section A).
2. **How to integrate it with the form's target stack?** — pick by target (Section B).

Sections are independent: any implementation from A composes with any integration from B.

## Args

- steps: {{steps}}

## Current form code

```typescript
{{code}}
```

---

## Section A — Wizard implementation hierarchy (pick the highest applicable)

### A1 (DEFAULT for ui-kit stacks) — `FormWizard` from `@reformer/ui-kit/form-wizard`

If the detected stack includes `@reformer/ui-kit`, **this is the default**. Import `FormWizard` from `@reformer/ui-kit/form-wizard`. Opinionated, batteries-included wrapper around the CDK compound: consistent step indicator + nav buttons + progress + accessibility + Russian-locale defaults wired by default. Minimum code.

**Polymorphic `step.body` (Path C unified API):**

```tsx
import { FormWizard, type FormWizardStep } from '@reformer/ui-kit/form-wizard';

const steps: FormWizardStep<MyForm>[] = [
  // Variant 1 — React FC: receives { control: FormProxy<T> } as prop
  { number: 1, title: 'Кредит', icon: '💰', body: BasicInfoForm },

  // Variant 2 — Static JSX (ReactNode): rendered directly
  { number: 2, title: 'Подтверждение', icon: '✓', body: <ConfirmationStep /> },

  // Variant 3 — RenderNode subtree (used in renderer-react / renderer-json flows)
  // ⚠ Inside the RenderNode tree use `path.X` (FieldPathNode), NOT `form.X` (FieldNode).
  // FieldNode has no `__path` marker → renderer silently ignores the node.
  { number: 3, title: 'Контакты', icon: '📞', body: { component: Box, children: [
    { component: path.phoneMain },
    { component: path.email },
  ] } },
];

<FormWizard
  form={form}
  config={{ stepValidations: STEP_VALIDATIONS, fullValidation }}
  steps={steps}
  onSubmit={handleSubmit}
/>
```

`step.body` is runtime-discriminated — pick whichever shape fits the consumer's flow. ui-kit handles all three internally via `RenderNodeComponent` for the RenderNode case.

If `@reformer/ui-kit` is NOT in package.json, skip to A2.

### A2 — Project-custom wizard wrapper, if one exists in the consumer project

Some projects already have `src/components/AppWizard.tsx` or similar — a thin wrapper over CDK or a fully custom implementation matching project's UX guidelines. If you find such a file in the project (`src/components/`, `src/widgets/`, etc.), prefer it over building anew — consistency with existing app screens.

### A3 — `@reformer/cdk` `FormWizard` compound

Headless compound (`FormWizard.Root + Indicator + Step + Actions + Progress`) — full styling/UX control, you assemble the visual layer. Use when:
- ui-kit doesn't export a high-level wizard, AND
- you don't have a project-custom wrapper, AND
- you want compound primitives (Indicator API, Actions slot, programmatic `goToStep` via ref).

See `reformer://docs/cdk/formwizard-indicator`, `formwizard-actions`, `formwizard-progress`, `external-control-via-ref-2`.

### A4 (last resort) — Manual `useState` wizard

Plain `const [currentStep, setCurrentStep] = useState(1)` with own step indicator and nav buttons. Use only when:
- A1, A2, A3 unavailable or unsuitable, OR
- the wizard has unique flow constraints not expressible in CDK compound (e.g. dynamic step skipping, custom routing integration).

For most multi-step forms A3 is the right level — A4 is opt-out, not default.

### Decision flowchart

```
ui-kit (@reformer/ui-kit) in package.json?
  └─ Yes → A1 (FormWizard from @reformer/ui-kit/form-wizard) [DEFAULT]
  └─ No  → continue

Project-custom wizard wrapper in src/components/?
  └─ Yes → A2 (use it)
  └─ No  → A3 (CDK FormWizard compound headless)

Need flow constraints CDK/ui-kit can't express?
  └─ Yes → A4 (manual useState — last resort)
```

---

## Section B — Target-aware integration

How wizard step visibility is wired to the form rendering. Independent of A.

### Integration B1 — `target=core` (no RenderSchema)

Step bodies are plain React components rendered conditionally:
- A1/A2/A3: Wizard's `<Step>` slot or equivalent renders the active step's body — no `setHidden` needed.
- A4 (manual useState): JSX-conditional `{currentStep === 1 && <Step1Section />}`.

Validation per step: `validateForm(form, STEP_VALIDATIONS[currentStep])` in `goNext()`. Cross-step `fullValidation` runs in submit handler.

### Integration B2 — `target=renderer-react`

Step bodies are RenderSchema sub-trees with `selector: 'step1'..'stepN'` on each step container.

- **A1 (ui-kit FormWizard)**: pass `step.body: RenderNode<T>` (the subtree). FormWizard internally wraps in `<RenderNodeComponent>`. No `setHidden` needed — ui-kit handles step switching.
- A2: if the wrapper accepts a `currentStep` prop and renders its `<Step>` slot, pass schema's pre-rendered nodes per step. Or use `setHidden` (next bullet).
- A3/A4: `useEffect` toggling `schema.node('stepN').setHidden(currentStep !== n)` for each step.

```tsx
useEffect(() => {
  for (let n = 1; n <= TOTAL_STEPS; n++) {
    schema.node(`step${n}`).setHidden(n !== currentStep);
  }
}, [schema, currentStep]);
```

Conditional sub-sections within steps (mortgage, residence, etc.) get their own selectors and use top-level `hideWhen(proxy.node('selector'), () => ...)` after `createRenderSchema(...)` — NOT inside the node config.

### Integration B3 — `target=renderer-json`

Same as B2 mechanics (`schema.node().setHidden`), but the schema is built from JSON via a `RenderSchemaFn`-wrapper that injects `form` into root `FormRoot` componentProps:

{{{{raw}}}}
```tsx
const schema = useMemo(() => {
  const baseFn = createRenderSchemaFromJson<MyForm>(jsonSchema, registry);
  const fnWithForm: RenderSchemaFn<MyForm> = (path) => {
    const root = baseFn(path) as ContainerRenderNode<MyForm>;
    return { ...root, componentProps: { ...(root.componentProps ?? {}), form } };
  };
  return createRenderSchema(fnWithForm);
}, [registry, form]);
useEffect(() => { /* same setHidden loop as B2 */ }, [schema, currentStep]);
```
{{{{/raw}}}}

JSON `selector: 'stepN'` on each step container; `useEffect setHidden` orchestration in `index.tsx`. Conditional sub-sections via `useFormControlValue(form.field as never)` + `useEffect setHidden('subsection-selector')`.

⚠️ **NEVER use raw `effect()` from `@preact/signals-core` для setHidden orchestration.** `setHidden` пишет в hidden-signal, raw `effect()` подписан на signals → infinite loop с «Cycle detected». Используй React-mediated bridge: `const x = useFormControlValue(form.x as never); useEffect(() => schema.node('y').setHidden(...), [schema, x])` — **отдельный `useEffect` per condition**. См. add-behavior.md rule #9 с примерами ❌/✅.

---

## Common to every (A, B) combination

- **`STEP_VALIDATIONS: Record<number, ValidationSchemaFn>`** — `goNext()` validates only the current step.
- **`fullValidation`** — separate, runs on submit (no duplicates with per-step rules; use `apply([...])` for reuse).
- **Don't rename fields** when grouping by step — only visual grouping.
- **Conditional steps** — filter `STEPS` array dynamically OR `setCurrentStep(n)` directly (A4) / `useRef<FormWizardHandle>().goToStep(n)` (A3).

## Visual baseline (do NOT skip — A1/A2 give it for free; A3/A4 must wire it manually)

- **Step indicator strip** with icons + en-dashes between chips. Chips MUST be `<button>` with `onClick` (clickable to completed steps), not `<div>`.
- **Step section card wrap**: `bg-white border rounded-xl shadow-sm p-6 space-y-4`.
- **Page container**: `max-w-4xl mx-auto p-6 space-y-6`.
- **Footer with progress text** under nav buttons (`Шаг N из M • X% завершено`).
- **Nav buttons**: `← Назад` / `Далее →` with arrows.
- **testId convention**: `step-indicator`, `step-chip-{N}` (with `data-current`/`data-completed`), `step-progress`, `wizard-prev`/`wizard-next`/`wizard-submit`.
- Icons via `lucide-react`: `Coins, User, Phone, Briefcase, FileText, CheckSquare`.

## Prerequisites — read these resources via ReadMcpResourceTool

**Mandatory based on chosen A and B:**

- **A1 / A2**: read the wrapper's docs (ui-kit `reformer://docs/ui-kit/...` if A1, project README if A2).
- **A3**: `reformer://docs/cdk/formwizard-indicator`, `reformer://docs/cdk/formwizard-actions`, `reformer://docs/cdk/formwizard-progress`, `reformer://docs/cdk/external-control-via-ref-2`, `reformer://docs/cdk/conditional-dynamic-step-count-in-formwizard`, `reformer://docs/cdk/multi-step-submit`.
- **A4**: `reformer://docs/core/multi-step-form-validation` for `validateForm(form, schema)` semantics.
- **B2 / B3**: `reformer://docs/renderer-react/render-schema-proxy` for `schema.node().setHidden()` API.
- **B3**: `reformer://docs/renderer-json/quick-start` for `FormRoot` self-managed root + `RenderSchemaFn`-wrapper boilerplate.

## Task

1. **Pick A** by walking the hierarchy A1 → A2 → A3 → A4 (the highest applicable wins).
2. **Pick B** by target.
3. State both choices in your output ("A=A3 (CDK FormWizard compound), B=B2 (renderer-react setHidden)").
4. Split existing fields into steps per requirements.
5. Build `STEP_VALIDATIONS` + `fullValidation`.
6. Implement following A's API + B's integration.
7. Add full visual baseline (or rely on A1/A2 if they ship it).

## Output checklist

- [ ] Stated chosen (A, B) pair AND why each was picked
- [ ] Read the Prerequisites for both A and B
- [ ] STEP_VALIDATIONS map covers all step fields
- [ ] fullValidation includes cross-step rules
- [ ] No duplicate validation between step and full
- [ ] Visual baseline present (step indicator strip with icons + en-dashes, card wrap, progress text, nav arrows) — either from A1/A2 or wired manually for A3/A4
- [ ] testIds present per convention
- [ ] (B2 / B3) all step containers have `selector: 'stepN'`
- [ ] (B3) `RenderSchemaFn`-wrapper injects `form` into root `FormRoot` componentProps
