You add a dynamic array of sub-forms to a `@reformer/*` form.

An array is one thing in every layer — it is bound by the handle `model.$.<array>` and takes a part that is built for every element:

| Layer      | Where                | How                                                                |
| ---------- | -------------------- | ------------------------------------------------------------------ |
| model      | `model.ts`           | `properties: arrayOf(blankProperty)` — the array and its new-row template |
| schema     | `form.schema.ts`     | `{ model: model.$.properties, component: FormArray, item: propertyRow }`  |
| validation | `form.validation.ts` | `applyEach(model.$.properties, propertyRules)`                     |
| behavior   | `form.behavior.ts`   | `applyEach(model.$.properties, propertyBehavior)`                  |

There is NO tuple `arrField: [itemSchema]` shape and NO `array(itemSchema, {…})` factory — removed legacy forms. The node keys `array:` and the facade `model.properties` in a binding position, the validation operator `each(...)`, and an `initialValue` that is required on the node are the former contract — ❌ do not emit them.

## Args

- requirements: {{requirements}}

## Current form code

```typescript
{{code}}
```

## ⚠️ Critical inline rules (silent corruption hazards)

1. **The template of a new row lives in the MODEL**: `arrayOf(blank, items?)` from `@reformer/core`. `blank` is a factory returning the FULL element with PLAIN leaf values (`string | number | boolean | Date`), NEVER a field config (`{ model, component, componentProps }`). A field config would be stored as the field value: Textarea renders `[object Object]`, Checkbox flips `true`. Compiler/tests don't catch it.

   ```typescript
   // model.ts
   const blankProperty = (): Property => ({ type: 'apartment', description: '', estimatedValue: 0 });

   export const createMyModel = () =>
     createModel<MyForm>({
       properties: arrayOf(blankProperty), // empty array + the template for «Add»
       // properties: arrayOf(blankProperty, [loaded]) — with initial rows
     });

   // a nested array — inside the row template
   const blankCoBorrower = (): CoBorrower => ({ phone: '', phones: arrayOf(blankPhone) });
   ```

   The template is attached to the array itself, so do not copy initial values that contain `arrayOf(...)` before `createModel`: `structuredClone`, `JSON.parse(JSON.stringify(…))` and `[...array]` return an array WITHOUT the template, and `push()` with no argument then throws. Keep such initial values in a factory, not in a constant that gets cloned.

   «Add» is then `model.properties.push()` with NO argument — the element comes from the template; `push(item)` / `insertAt(i, item)` take a ready value (data loaded from the server). An array that is the VALUE of one field (multi-select `tags: []`) is an ordinary field and needs no template.

2. **Never `enableWhen({ resetOnDisable: true })` on a whole array** — browser hang. Conditional visibility of the array = the node rule `hideWhen(schema.node('properties'), () => !model.hasProperty)` (a JSX conditional when the markup is written by hand).

3. **Schema node = `{ model: model.$.<path>, item }`** — `model` is the handle (`model.$.properties`), `item` is a part `(model: FormModel<Item>) => node` whose leaves bind to the row's own handles (`model.$.<field>`). NEVER a tuple `arrField: [itemSchema]`, NEVER `{ value: [], itemSchema: {…} }`. The node needs no `initialValue`: it is only a fallback for forms whose model is created from data without code, and the model's template wins. When the node is drawn by `FormRenderer`, add `component: FormArray` (`"$component(FormArray)"` in JSON) — the renderer ships no array markup of its own, so without a component you get the rows but no add/remove/reorder UI. `List` from `@reformer/ui-kit` is the display-only variant.

   ```typescript
   // form.schema.ts
   const propertyRow = (model: FormModel<Property>): FormSchemaNode => ({
     component: Section,
     children: [
       { model: model.$.type, component: SelectAsync, componentProps: { label: 'Тип' } },
       { model: model.$.estimatedValue, component: InputNumber, componentProps: { label: 'Стоимость' } },
     ],
   });

   // in the tree
   {
     selector: 'properties',
     model: model.$.properties,
     component: FormArray,
     componentProps: { title: 'Имущество', addButtonLabel: '+ Добавить имущество' },
     item: propertyRow,
   }
   ```

   JSON — the row is a named part of the document; paths inside are relative to the element (`"$model(type)"`, not `"$model(properties[0].type)"`):

   ```jsonc
   {
     "format": 2,
     "parts": {
       "propertyRow": {
         "component": "$component(Section)",
         "children": [
           { "model": "$model(type)", "component": "$component(SelectAsync)" },
           { "model": "$model(estimatedValue)", "component": "$component(InputNumber)" },
         ],
       },
     },
     "root": {
       "model": "$model(properties)",
       "component": "$component(FormArray)",
       "item": "$part(propertyRow)",
     },
   }
   ```

   `"item": { "$template": { …node… } }` is the inline form of the same thing.

4. **Element access**: on the model — `model.<arr>.at(i)`, `.length`, `.map(...)` (reading subscribes to length/items — useful inside `compute`); mutations `push`, `insertAt`, `removeAt`, `move`, `swap`, `clear`. On the form node — `form.<arr>.at(i)` (NOT brackets), `.length.value`. Mutate through the model; never touch the items list directly.

5. **A checkbox in a row drawn by the renderer**: don't wrap it in `CdkFormField.Label` — `CheckboxWithLabel` draws its own label, double-rendered otherwise. Pass the label via `componentProps.label`.

6. **`selector` vs the model path — different things, do NOT mix.** `model: model.$.loanAmount` / `"model": "$model(loanAmount)"` is the binding; `selector: 'unique-id'` is a plain-string node id for `schema.node(selector)` in the behavior; `testId: 'step1.loanAmount'` is the DOM convention and stays in `componentProps`. A bare `"component": "Input"` (no operator) does NOT resolve.

7. **Markup by hand in JSX** — `FormArraySection` from `@reformer/ui-kit` with an `itemComponent`:

   ```tsx
   const PropertyForm: FC<{ control: FormProxy<Property> }> = ({ control }) => (
     <Section>
       <FormField control={control.type} />
       <FormField control={control.estimatedValue} />
     </Section>
   );

   <FormArraySection
     control={form.properties}
     itemComponent={PropertyForm}
     title="Имущество"
     addButtonLabel="+ Добавить имущество"
   />;
   ```

   No `initialValue` prop: «Add» takes the template from the model. Need a custom compound layout? `<FormArray.Root control={form.<arr>}>` + `<FormArray.List>` + `<FormArray.AddButton>` (CDK).

8. **Scopes are isolated.** A rule in the ROOT behavior cannot address a node inside a row: `schema.node(selector)` there sees the root tree only. Rules for nodes of a row go into the row's sub-behavior, which receives its own `schema` and its own `model`:

   ```typescript
   const propertyBehavior = defineFormBehavior<Property>(({ model, schema }) => {
     hideWhen(schema.node('encumbrance'), () => model.type !== 'apartment'); // looked up inside the row
   });

   // form.behavior.ts
   applyEach(model.$.properties, propertyBehavior);
   ```

## Prerequisites — read these resources via ReadMcpResourceTool

**You MUST read these BEFORE writing array code. Skipping = silent runtime corruption.**

- `find_recipe unified-contract`
- `reformer://docs/core/array-operations`
- `reformer://docs/core/array-cleanup-pattern`
- `reformer://docs/cdk/formarrayhandle-api`
- `reformer://docs/cdk/useformarray-hook`
- `reformer://docs/cdk/list-render-props`
- `reformer://docs/cdk/external-control-via-ref`
- `reformer://docs/cdk/nested-formarray`
- `reformer://docs/cdk/custom-addbutton`

## Task

1. **Model** — declare the array with its template: `<path>: arrayOf(blankItem)`; `blankItem` returns the FULL element with plain values.
2. **Schema** — add the node `{ model: model.$.<path>, component: FormArray, item: itemRow }`; the row is a part `(model: FormModel<Item>) => node`. For JSON — a named part and `"item": "$part(itemRow)"`.
3. **Validation** — a separate `defineValidationSchema`, never on schema nodes. Row rules are their own schema over the element, attached with `applyEach`:

   ```typescript
   const propertyRules = defineValidationSchema<Property>(({ model, cross }) => {
     validate(model.$.type, [required({ message: 'Укажите тип' })]);
     // `cross` inside row rules receives the snapshot of the ROW, not of the whole form
     cross(model.$.estimatedValue, (row) =>
       row.type === 'apartment' && row.estimatedValue < 10000 ? { code: 'min', message: '…' } : null
     );
   });

   export const formValidation = defineValidationSchema<MyForm>(({ model, cross }) => {
     applyEach(model.$.properties, propertyRules);
     // array-level «must not be empty» — a cross on the flag that reads the array off the snapshot
     cross(model.$.hasProperty, (form) =>
       form.hasProperty && form.properties.length === 0 ? { code: 'arrayEmpty', message: '…' } : null
     );
   });
   ```

   The same row rules can be attached to a single sub-model with `apply(model.$.group, rules)`.

4. **Behavior** — per-row links and node rules go through `applyEach(model.$.<path>, itemBehavior)` in `form.behavior.ts`.
5. **Cleanup on an external trigger** (a flag turned off) — `onChange(model.$.flag, (on) => { if (!on && model.<arr>.length > 0) model.<arr>.clear(); })`. A `clearWhenOff(...)` shorthand is NOT a `@reformer/core` export — define it yourself if you want it (see `reformer://docs/core/array-cleanup-pattern`). Never `resetValue` on an array.
6. **Nested arrays** — nest another `{ model: model.$.<path>, item }` inside the row part and `arrayOf(...)` inside the row template.
7. **UI** — the renderer draws the node through `component: FormArray`; by hand in JSX — `FormArraySection` (rule #7).

## Output checklist

- [ ] Прочитал все ресурсы из Prerequisites: yes/no
- [ ] Model declares the array as `arrayOf(blankItem)`; the template returns PLAIN leaf values (no `component`/`componentProps`)
- [ ] Schema node `{ model: model.$.<path>, component, item }` — NOT `array:`, NOT a tuple `[itemSchema]`, NOT an `array(...)` factory; no `initialValue` duplicating the model's template
- [ ] Conditional visibility via `hideWhen` / JSX, NOT `enableWhen + resetOnDisable`
- [ ] Validation in a separate `defineValidationSchema`: row rules attached with `applyEach(model.$.<arr>, rowRules)` (NOT `each`); row cross-field via `cross` on the row snapshot; array-empty via `cross` on the flag
- [ ] Per-row behavior attached with `applyEach`; nodes of a row addressed from the row's own `schema`
- [ ] Cleanup wired (`model.<arr>.clear()` guarded by length) if applicable
- [ ] (renderer) Checkbox without `CdkFormField.Label` wrapper
- [ ] (JSX) `FormArraySection` with an FC `itemComponent`, no `initialValue` prop
- [ ] (renderer-json) the row is a named part referenced as `"item": "$part(name)"` (or inline `$template`); every `$component` registered
