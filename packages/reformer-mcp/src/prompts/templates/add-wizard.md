You convert a single-page form into a multi-step wizard. Two questions to answer in order:

1. **Which wizard implementation?** — pick by hierarchy (Section A).
2. **How does it meet the form?** — pick by who draws the markup (Section B).

## Args

- steps: {{steps}}

## Current form code

```typescript
{{code}}
```

---

## What does not depend on the choice

- **A step is linked to its rules by `selector`**: `validation: { steps: { loan: loanRules, contacts: contactsRules }, extras: crossStepRules }` — the key is the `selector` of the step node in the schema, so reordering steps does not desynchronise rules. A step without a `selector` — and every step declared in JSX, where steps have only a `number` — falls back to its ordinal: step N uses the N-th key of `validation.steps`, so keep the keys in step order. A step with no rules is declared explicitly (`confirm: null`) — otherwise the following steps shift by one.
- **Rules travel as DATA** in the `validation` field of `createForm`. The assembly turns them into `bundle.validation` = `{ validateStep, validateAll, createStepController, stepSelectors }` (`Promise<boolean>` where applicable). Nobody hand-rolls a `makeValidationConfig(model)` wrapper — that is the former contract.
- **Per-step schemas** are ordinary `defineValidationSchema<Root>(({ model }) => { validate(model.$.x, [rules]); … })` functions (async via `validateAsync`, conditional via `validateWhen`, cross-field via `cross`, sub-forms via `apply`, arrays via `applyEach`). «Next» validates only the current step; submit runs every step plus `extras`. No duplicates between a step and `extras`.
- **Don't rename fields** when grouping by step — only visual grouping.

---

## Section A — Wizard implementation hierarchy (pick the highest applicable)

### A1 (DEFAULT) — `FormWizard` from `@reformer/ui-kit`

If the detected stack includes `@reformer/ui-kit`, **this is the default**. Opinionated, batteries-included wrapper around the CDK compound: step indicator + nav buttons + progress + accessibility + Russian-locale defaults wired by default. It is the ONLY implementation that works as a schema node out of the box (Section B2).

If `@reformer/ui-kit` is NOT in package.json, skip to A2.

### A2 — Project-custom wizard wrapper, if one exists in the consumer project

Some projects already have `src/components/AppWizard.tsx` or similar — a thin wrapper over CDK or a fully custom implementation matching the project's UX guidelines. If you find such a file (`src/components/`, `src/widgets/`, etc.), prefer it over building anew — consistency with existing app screens.

### A3 — `@reformer/cdk` `FormWizard` compound

Headless compound (`FormWizard.Root + Indicator + Step + Actions + Progress`) — full styling/UX control, you assemble the visual layer. Use when ui-kit doesn't fit, there is no project wrapper, and you want compound primitives (Indicator API, Actions slot, programmatic `goToStep` via ref).

See `reformer://docs/cdk/formwizard-indicator`, `formwizard-actions`, `formwizard-progress`, `external-control-via-ref-2`.

### A4 (last resort) — Manual `useState` wizard

Plain `const [currentStep, setCurrentStep] = useState(1)` with own step indicator and nav buttons. Only when A1–A3 are unavailable or the flow has constraints the compound cannot express (dynamic step skipping, custom routing integration).

### Decision flowchart

```
ui-kit (@reformer/ui-kit) in package.json?
  └─ Yes → A1 (FormWizard from @reformer/ui-kit) [DEFAULT]
  └─ No  → continue

Project-custom wizard wrapper in src/components/?
  └─ Yes → A2 (use it)
  └─ No  → A3 (CDK FormWizard compound headless)

Need flow constraints CDK/ui-kit can't express?
  └─ Yes → A4 (manual useState — last resort)
```

---

## Section B — How the wizard meets the form

### B1 — markup by hand in JSX (`target=core`)

`FormWizard` gets everything by props: the form and the assembled validation come from the bundle, step bodies are React components.

{{{{raw}}}}

```tsx
import { createForm, useFormBundle } from '@reformer/core';
import { FormWizard, type FormWizardStep } from '@reformer/ui-kit';

const steps: FormWizardStep<MyForm>[] = [
  // React FC: receives { control: FormProxy<T> } as a prop
  { number: 1, title: 'Кредит', icon: '💰', body: LoanStep },
  // static JSX: rendered as is
  { number: 2, title: 'Подтверждение', icon: '✓', body: <ConfirmationStep /> },
];

export function MyWizardPage() {
  const { form, validation } = useFormBundle(() =>
    createForm<MyForm>({
      model: createMyModel(),
      schema: formSchema,
      behavior: formBehavior,
      validation: formValidation, // { steps: { loan: …, confirm: null }, extras? } — keys in step order
    })
  );

  return <FormWizard form={form} config={validation} steps={steps} onSubmit={handleSubmit} />;
}
```

{{{{/raw}}}}

- A3: the compound's `<Step>` slot renders the active step's body; A4: a JSX conditional `{currentStep === 1 && <Step1 />}`. Gate «Next» on `validation.validateStep(stepKey)`, submit on `validation.validateAll()`.
- Rules for schema nodes (`hideWhen`, `onComponentEvent`, `onMount`) are executed by the renderer and do nothing here: visibility, submit and data loading stay in JSX.

### B2 — `FormRenderer` draws the form (`target=renderer-react` and `target=renderer-json`)

The wizard is a **schema node**; the steps are its ordinary children. The library `FormWizard` builds steps from the child nodes (`selector`, `componentProps.title`, `componentProps.icon`) and takes the form and the validation from the assembly itself.

```typescript
// form.schema.ts
import { Step } from '@reformer/cdk/form-wizard';
import { FormWizard, Input, SelectAsync } from '@reformer/ui-kit';

export const formSchema = (model: FormModel<MyForm>): FormSchemaNode => ({
  selector: 'wizard',
  component: FormWizard,
  children: [
    {
      selector: 'loan', // the key in validation.steps
      component: Step,
      componentProps: { title: 'Кредит', icon: '💰' },
      children: [
        { model: model.$.loanType, component: SelectAsync, componentProps: { label: 'Тип' } },
      ],
    },
    {
      selector: 'contacts',
      component: Step,
      componentProps: { title: 'Контакты', icon: '📞' },
      children: [{ model: model.$.email, component: Input, componentProps: { label: 'Email' } }],
    },
  ],
});
```

```typescript
// form.behavior.ts — submit and other wizard events are rules for the node
import { defineFormBehavior, onComponentEvent } from '@reformer/core/behaviors';

export const formBehavior = defineFormBehavior<MyForm>(({ model, schema }) => {
  onComponentEvent(schema.node('wizard'), 'onSubmit', async () => {
    await submitMyForm(model.get());
  });
});
```

`renderer-json` — the same tree as data; register the library components in `registry.ts` (`reg.component('FormWizard', FormWizard)`, `reg.component('Step', Step)`):

```jsonc
{
  "format": 2,
  "root": {
    "selector": "wizard",
    "component": "$component(FormWizard)",
    "children": [
      {
        "selector": "loan",
        "component": "$component(Step)",
        "componentProps": { "title": "Кредит", "icon": "💰" },
        "children": [{ "model": "$model(loanType)", "component": "$component(SelectAsync)" }],
      },
    ],
  },
}
```

What is NOT needed any more — all of it is the former contract, ❌ do not emit:

- ❌ an app shim (`RendererFormWizard`, `wizard.tsx`, `$component(Wizard)`) — the wizard is the library component;
- ❌ steps in `componentProps.steps` — steps are `children`;
- ❌ the `(model, form?)` schema builder called twice, and `...(form ? { form } : {})` in `componentProps`;
- ❌ injecting `form` and the validation config via `onInit(schema.node('wizard'), () => schema.node('wizard').patchProps({ form, config }))`;
- ❌ `renderStepBody`, and a `useEffect` cascade of `schema.node('stepN').setHidden(n !== currentStep)`.

**A2 / A3 / A4 with a renderer.** A component that manages its children itself declares the static `__selfManagedChildren = true`; the renderer then hands it the child NODES plus a `renderNode` function instead of rendered elements, and the component reads the form and the validation from `useFormBundleContext()` (`@reformer/core`). A custom wizard has to implement this protocol to stand in a schema — see `reformer://docs/renderer-react` («Компонент, который сам управляет детьми»). If that is not worth it, keep the wizard in JSX (B1) and draw each step with its own `FormRenderer`.

**Conditional sub-sections inside steps** (mortgage, residence, …) get their own `selector` and a rule in the behavior: `hideWhen(schema.node('mortgage'), () => model.loanType !== 'mortgage')`. The condition reads the MODEL (`model.loanType`), not `form.loanType.value.value`.

**A conditional STEP** (a step that exists only under a condition) is NOT a node rule: the library wizard builds its steps from all child nodes, so `hideWhen` on a step node hides the step's content but leaves the step in the indicator and in navigation. A form with a dynamic step count keeps the wizard in JSX (B1) and renders the step conditionally — see `reformer://docs/cdk/conditional-dynamic-step-count-in-formwizard`.

**Scopes are isolated.** `schema.node(selector)` in the root behavior sees the root tree only — not the nodes inside an array `item` or a sub-form `part`. Reach those from the sub-behavior passed to `applyEach(model.$.items, itemBehavior)` / `apply(model.$.group, groupBehavior)`: it receives its own `schema`.

---

## Visual baseline (do NOT skip — A1/A2 give it for free; A3/A4 must wire it manually)

- **Step indicator strip** with icons + en-dashes between chips. Chips MUST be `<button>` with `onClick` (clickable to completed steps), not `<div>`.
- **Step section card**: `<Card><CardHeader><CardTitle>…</CardTitle></CardHeader><CardContent className="space-y-4">…</CardContent></Card>` — карточка компонентом, НЕ строкой `bg-white border rounded-xl shadow-sm p-6`.
- **Page container**: `max-w-2xl mx-auto p-6 space-y-6`.
- **Классы — только раскладка и отступы** (`space-y-*`, `grid`, `gap-*`, `flex`, `max-w-*`). Цвет, фон, рамку, тень и радиус даёт компонент кита. Правила: `find_recipe({ topic: "form-layout", package: "ui-kit" })`.
- **Footer with progress text** under nav buttons (`Шаг N из M • X% завершено`).
- **Nav buttons**: `← Назад` / `Далее →` with arrows.
- **testId convention**: `step-indicator`, `step-chip-{N}` (with `data-current`/`data-completed`), `step-progress`, `wizard-prev`/`wizard-next`/`wizard-submit`.
- Icons via `lucide-react`: `Coins, User, Phone, Briefcase, FileText, CheckSquare`.

## Prerequisites — read these resources via ReadMcpResourceTool

**Mandatory based on chosen A and B:**

- always: `find_recipe unified-contract`, `find_recipe wizard`.
- **A1 / A2**: the wrapper's docs (ui-kit `reformer://docs/ui-kit/...` if A1, project README if A2).
- **A3**: `reformer://docs/cdk/formwizard-indicator`, `reformer://docs/cdk/formwizard-actions`, `reformer://docs/cdk/formwizard-progress`, `reformer://docs/cdk/external-control-via-ref-2`, `reformer://docs/cdk/conditional-dynamic-step-count-in-formwizard`, `reformer://docs/cdk/multi-step-submit`.
- **A4**: `reformer://docs/core/multi-step-form-validation` for `validateModel(model, schema)` semantics.
- **B2**: `reformer://docs/renderer-react` (the bundle and node rules); for `renderer-json` also `reformer://docs/renderer-json/quick-start`.

## Task

1. **Pick A** by walking the hierarchy A1 → A2 → A3 → A4 (the highest applicable wins).
2. **Pick B** by who draws the markup.
3. State both choices in your output ("A=A1 (ui-kit FormWizard), B=B2 (schema node)").
4. Split existing fields into steps per requirements; give every step a `selector`.
5. Build per-step `defineValidationSchema` functions and declare them as data: `export const formValidation: FormValidation<MyForm> = { steps: { loan: …, contacts: … }, extras: crossStepRules }` → the `validation` field of `createForm`.
6. Implement following A's API + B's integration.
7. Add the full visual baseline (or rely on A1/A2 if they ship it).

## Output checklist

- [ ] Stated chosen (A, B) pair AND why each was picked
- [ ] Read the Prerequisites for both A and B
- [ ] Per-step `defineValidationSchema` functions cover all step fields; declared as `validation: { steps, extras }`, keys = step selectors
- [ ] Cross-step rules live in `extras`; no duplicate validation between a step and `extras`
- [ ] Navigation gated on the assembled `bundle.validation` (`validateStep` / `validateAll`, plain `Promise<boolean>`); warnings stay non-blocking via the runner (no hand-rolled `.errors` gate)
- [ ] (B2) the wizard is a schema node `{ selector: 'wizard', component: FormWizard, children: [steps] }`; no shim, no `componentProps.steps`, no `patchProps({ form, config })`
- [ ] (B2) submit is `onComponentEvent(schema.node('wizard'), 'onSubmit', …)` in `form.behavior.ts`
- [ ] Visual baseline present (step indicator strip with icons + en-dashes, `Card`-wrapped step, progress text, nav arrows) — either from A1/A2 or wired manually for A3/A4
- [ ] No hand-written appearance classes (`bg-*`, `text-<color>-<shade>`, `border-<color>`, `shadow-*`, `rounded-*`) — layout and spacing only
- [ ] testIds present per convention
