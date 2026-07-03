You design and write a new form on `@reformer/*`.

## Args

- target: `{{target}}` {{targetLabel}}
- description: {{description}}

## Stage 0 — MCP discovery (CRITICAL: do this before any code)

{{stackBlock}}

⚠️ **If the discovery block above contains a question for the orchestrator** — STOP and return the question. Do NOT fall back to plain HTML / inline-style — that invalidates the MCP test.

## Critical inline rules

- **Architecture M1**: `createModel<T>(initialValues)` holds the data (source of truth); the schema binds each field to a model signal (`value: model.$.field`) plus `component` / `componentProps`; `createForm<T>({ model, schema })` wires nodes to the model's signals. Values live in the model, never in a standalone form config.
- **FormSchema only declarative**: this prompt does NOT add validation/behavior. Use `add-validation` and `add-behavior` separately. Leave `validators` off the leaves here.
- **`useMemo`** when creating model + form in a React component: build `model`, then `schema`, then `form` inside one `useMemo(() => { const m = createModel<T>({...}); const s = buildSchema(m); const f = createForm<T>({ model: m, schema: s }); return { model: m, form: f, schema: s }; }, [])`.
- **FormField** (from `@reformer/ui-kit`) usage: `<FormField control={form.x} testId="step1.x" />`. NOT the cdk compound `FormField.Root/Label/Control/Error` for ordinary fields.
- **Leaf node shape**: `{ value: model.$.field, component: Input, componentProps: {...} }`. `value` is the model signal (`model.$.field`, a `PathAwareSignal`) — obligatory. Never a plain string field name, never a bare value.
- **Array shape**: `{ array: model.<path>, item: (itemModel) => subSchema, initialValue }` — `array` is the reactive model array (`model.items`, not `model.$.items`), `item` builds the sub-schema from the element's sub-model (`FormModel<Item>`, access fields via `itemModel.$.field`). NEVER `{ value: [], itemSchema: {...} }` (silent corruption). Array mutations (`push`/`removeAt`) run on the model (`model.items.push(...)`), not the form.
- **`initialValue`** (new-element factory/value for the array's Add button): PLAIN leaf values only — a full plain object matching the element shape. Never a FieldConfig (`{ value, component }`) — silent runtime corruption.
- **Conditional fields → Hide, not Disable**. Type/status conditional (loanType, employmentStatus) → JSX-conditional (`{model.loanType === 'mortgage' && <FormField control={form.propertyValue} />}`) for `core`; `hideWhen` / `setHidden` on render-schema nodes for renderers. Progressive disclosure (`confirmPassword` after `password`) → `enableWhen(model.$.confirmPassword, () => !!model.password)` behavior (out of scope here — flag it for `add-behavior`).
- **Spec compliance — literal**: every spec field = separate FormSchema field with the same name and the same step. No merging, no skipping, no moving.
- **testId convention**: dotted path (`step1.loanAmount`, `step2.passportData.series`), never bare leaf names — collisions inevitable across steps. **NEVER pre-prefix `input-` to the testId value** — renderer auto-prefixes when emitting `data-testid="input-${testId}"`. Pre-prefixed `testId: 'input-step1.X'` produces double-prefixed `data-testid="input-input-step1.X"` → playwright selectors that look for `[data-testid^="input-step1."]` silently miss every field.
- **User-facing strings**: from spec or in the user's native language. No default English `"Select an option..."` placeholders.
- **`required(...)` always with `{ message }`**: never default `"Поле обязательно для заполнения"`.
- **`componentProps` use camelCase React-style prop names**, not HTML-lowercase. Pass-through to the React leaf component → React DOM rejects the lowercase variant with a console warning. Common offenders: `readOnly` (NOT `readonly`), `htmlFor` (NOT `for`), `tabIndex` (NOT `tabindex`), `autoFocus` (NOT `autofocus`), `maxLength` / `minLength` (NOT `maxlength` / `minlength`). Sub-agents intuitively reach for the HTML attribute name — that spams `Warning: Invalid DOM property '<name>'. Did you mean '<camelCase>'?` on every render.

- **Inside a RenderSchema (`target=renderer-react`) — a leaf carries the MODEL SIGNAL (`value: model.$.x`), NEVER the resolved `form.X` FieldNode.** Under M1 the render tree binds to the model, and the state-node (errors/disabled) is resolved by signal through the registry that `createForm` populates:
  - Leaf = `{ value: model.$.x, component: Input, componentProps: {...} }`. `isModelFieldRenderNode` sees `value` is a signal → resolves the state node via `getNodeForSignal` at render. **This is the renderer flow contract.**
  - Putting the FieldNode `form.X` (or a `component: form.X`) into a node is wrong — it is not a signal and not a container component → the node is **silently ignored** by the renderer. Form looks empty, no console error.
  - **`RenderSchemaFn<T>` takes NO argument** — it is `() => RenderNode<T>`. The legacy `path`-proxy argument was removed. A step body / array-item / nested helper receives the **model** (or a sub-model signal group like `model.$.address`), never a `path` and never the resolved `form` instance.

  ```typescript
  // ❌ silent fail — renderer ignores these nodes (FieldNodes, not signals)
  function step1Body(form: FormProxy<MyForm>): RenderNode<MyForm> {
    return {
      component: Box,
      children: [
        { component: form.email }, // FieldNode — ignored
        { component: form.password }, // FieldNode — ignored
      ],
    };
  }

  // ✅ correct — leaves carry model signals; the schema fn takes no argument
  const buildSchema = (model: FormModel<MyForm>): RenderSchemaFn<MyForm> => {
    const m = model.$;
    return () => ({
      component: Box,
      children: [step1Body(m)],
    });
  };
  function step1Body(m: ModelSignals<MyForm>): RenderNode<MyForm> {
    return {
      component: Box,
      children: [
        { value: m.email, component: Input }, // model signal — resolved at render
        { value: m.password, component: InputPassword },
      ],
    };
  }
  const schema = createRenderSchema<MyForm>(buildSchema(model));
  ```

  When a step body / array item / nested helper needs field references, pass the model (or a sub-model signal group `model.$.user`) — never the resolved `form` instance, never a `path`.

- **All input-rendering `componentProps` (`label`, `placeholder`, `options`, `mask`, `rows`, `type`, anything the leaf component reads) MUST live on the leaf node's `componentProps`** — the same tree that `createForm` consumes. For `target=renderer-json` this means the props belong on the `JsonNode` leaf (`{ value: '$model(x)', component: '$component(Select)', componentProps: { label, options: '$dataSource(OPTS)' } }`); the converter binds them onto the model field. Symptoms when a prop is dropped from the field leaf:
  - `label` missing → field renders without a label (visual-only, but breaks UX);
  - `options` missing → `RadioGroup` throws `TypeError: t.map is not a function` at mount; `Select` shows an empty dropdown;
  - `placeholder` missing → input shows nothing.
    Practical recipe for `renderer-json`: register option arrays / label-fns / loading-components via `reg.dataSource('NAME', value)` in `registry.ts`, and reference them from the JSON leaf's `componentProps` by operator string `'$dataSource(NAME)'`.

## If `target=renderer-json` — mount from JSON via `convertJsonToM1Tree` (M1)

Under M1 the JSON schema is a pure-string operator DSL. Bindings are encoded as strings: `'$model(path)'` (field/array), `'$component(Name)'` (registry component), `'$dataSource(NAME)'` (registry value/fn). The **model** owns the data; the form is built from the **same** JSON via `convertJsonToM1Tree(jsonSchema, registry, model)`, and `JsonFormRenderer` receives the model through `JsonRendererProvider` settings — there is no `form` prop (by design). Boilerplate (copy verbatim into `index.tsx`):

{{{{raw}}}}

```tsx
import { useMemo } from 'react';
import { createForm, createModel } from '@reformer/core';
import {
  JsonFormRenderer,
  JsonRendererProvider,
  convertJsonToM1Tree,
  type JsonFormSchema,
} from '@reformer/renderer-json';
import rawJsonSchema from './json-schema.json';
import { createMyRegistry } from './registry';

const jsonSchema = rawJsonSchema as unknown as JsonFormSchema; // "schema arrived as a string"

export function MyFormPage() {
  const registry = useMemo(() => createMyRegistry(), []);
  const { model } = useMemo(() => {
    const model = createModel<MyForm>(initialValues);
    // Form is built from the SAME JSON: the converter binds leaves to model signals.
    createForm<MyForm>({ model, schema: convertJsonToM1Tree(jsonSchema, registry, model) });
    return { model };
  }, [registry]);

  return (
    <JsonRendererProvider settings={{ registry, model }}>
      <JsonFormRenderer<MyForm> schema={jsonSchema} validate={import.meta.env.DEV} />
    </JsonRendererProvider>
  );
}
```

Runtime entities that cannot live in static JSON (a `FormProxy` for a wizard node, a validation config) are injected via the `renderBehavior` prop + `onInit`/`patchProps`, addressing the node by `selector`:

```tsx
import { onInit, type RenderBehaviorFn } from '@reformer/renderer-react';

function createMyRenderBehavior(form: FormProxy<MyForm>): RenderBehaviorFn<MyForm> {
  return (schema) => {
    onInit(schema.node('wizard'), () => {
      schema.node('wizard').patchProps({ form });
    });
  };
}
// <JsonFormRenderer schema={jsonSchema} renderBehavior={createMyRenderBehavior(form)} />
```

{{{{/raw}}}}

**Field references in JSON — `value: '$model(path)'` operator, NOT a bare string, NOT `selector`.** Three distinct concepts:

- `value: '$model(loanAmount)'` — the actual field path in the model (no `stepN.` prefix; nested is `'$model(personalData.firstName)'`; inside an array `$template` the path is relative to the element, `'$model(type)'`). This is what the converter resolves to a model signal. A bare `value: 'loanAmount'` or `component: 'Input'` does **not** resolve.
- `selector: 'unique-id'` — plain-string node id for `setHidden` / `hideWhen` / `patchProps` / `onInit` via `schema.node(selector)`. **Not** a model path.
- `testId: 'step1.loanAmount'` — DOM testId convention (dotted path with `stepN.` prefix). Stays in `componentProps`, doesn't drive field resolution.

```jsonc
// ❌ silent fail — bare strings never resolve; selector is not a path
{ "selector": "step1.loanAmount", "component": "Input",
  "componentProps": { "testId": "step1.loanAmount" } }

// ✅ correct — value carries the $model operator; component carries $component
{ "value": "$model(loanAmount)", "component": "$component(Input)",
  "componentProps": { "testId": "step1.loanAmount", "label": "Сумма кредита" } }
```

## Layout & visual density

{{layoutSection}}

## Prerequisites — read these resources via ReadMcpResourceTool

**You MUST read these BEFORE writing schema. Skipping = wrong imports / wrong layout / wrong shape.**

- `reformer://docs/core/import-patterns`
- `reformer://docs/core/quick-start-minimal-working-form`
- `reformer://docs/core/formschema-format-critically-important`
- `reformer://docs/core/array-schema-format`
- `reformer://docs/core/common-patterns`
- `reformer://docs/core/ui-component-patterns`
- `reformer://docs/core/non-existent-api-do-not-use`
- `reformer://docs/ui-kit/quick-start` (if `@reformer/ui-kit` detected)
- `reformer://docs/ui-kit/components`
- Directory layout — default is **`{{layoutMode}}`**. Run `find_recipe directory-layout` for where each file goes for `{{target}}` (incl. renderer-json app-level base registry + DSL meta-schema).
  {{rendererPrereqs}}

## Task

1. Stage 0 — verify detected stack (above). If gap → ask, don't code.
2. Design form structure from description (fields, types, groups, arrays, nested forms).
3. Write typed `interface MyForm { ... }` and `createModel<MyForm>(initialValues)`.
4. Build the schema binding leaves to model signals (`{ value: model.$.field, component, componentProps }`), then `createForm<MyForm>({ model, schema })`. For `renderer-react`: same tree as `RenderSchemaFn<MyForm> = () => RenderNode<MyForm>` (no path arg) + `createRenderSchema`. For `renderer-json`: `JsonFormSchema` (`'$model(...)'` / `'$component(...)'` operators) + `defineRegistry` + `convertJsonToM1Tree`.
5. Use components from detected ui-kit + Tailwind layout from skeleton above.
6. Organize files per the directory layout: {{{layoutGuidance}}}
7. Don't add validation/behaviors — out of scope.

## Output checklist

- [ ] Прочитал все ресурсы из Prerequisites: yes/no
- [ ] `createModel` holds data; `createForm({ model, schema })` wires nodes to model signals
- [ ] Used ui-kit + Tailwind from detected stack (not plain HTML)
- [ ] All spec fields included (walked the list)
- [ ] Leaf node complete: `{ value: model.$.field, component, componentProps }` per field (`value` is the model signal, not a bare name)
- [ ] Conditional fields hidden via JSX/`hideWhen`/`setHidden`, NOT `enableWhen`
- [ ] testId = dotted-path
- [ ] Array node = `{ array: model.<path>, item: (itemModel) => sub, initialValue }`; `item` binds `itemModel.$.field`; `initialValue` is a PLAIN element object
- [ ] User-facing strings localized from spec
- [ ] `Select`/`RadioGroup` have `options` on the leaf's `componentProps` (for `renderer-json` via `'$dataSource(NAME)'`), never dropped
- [ ] All `label` / `placeholder` / mask / rows / type / etc. live on the leaf node's `componentProps`
- [ ] Final note: «использовал `@reformer/ui-kit` + Tailwind по detected стеку» (or reason why not)
