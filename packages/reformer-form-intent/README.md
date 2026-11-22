# @reformer/form-intent

The form intent contract of [`@reformer/core`](https://www.npmjs.com/package/@reformer/core) and the
printers that turn its rules into code.

A form intent is a flat registry of fields, arrays, validation rules and behaviors plus a layout tree
that refers to them by name. Tools that generate ReFormer forms — the visual builder, code generators,
AI assistants — share this contract, so a rule written by one of them prints the same way in all of
them.

- **Types** — `FormIntent`, `FieldIntent`, `ArrayIntent`, `ValidationRuleIntent`, `BehaviorIntent`,
  `VisibilityIntent`, `LayoutNode` and the rest of the records.
- **Normalization** — `normalizeIntent` fills the defaults of a canonical intent (`modelPath`,
  `selector`, interface name) and reports what is missing as `warnings`.
- **Rule printers** — `buildValidationSchemaTs` prints a validation schema
  (`@reformer/core/validation`), `buildBehaviorTs` prints the form behavior
  (`@reformer/core/behaviors`), `mergeFieldChecks` folds the checks of one field into one `validate`.
- **Layout** — the layout document types (`SchemaDocument`, `SchemaDocNode`) and `collectSteps` for
  wizard steps.
- **Graph** — `findCycle` finds a cycle among behaviors that read each other's fields.

Pure functions with no dependencies: the package runs in Node and in the browser.

## Installation

```bash
npm install @reformer/form-intent
```

## Usage

```ts
import { buildValidationSchemaTs, normalizeIntent, buildBehaviorTs } from '@reformer/form-intent';

const validation = buildValidationSchemaTs(
  [
    { target: 'name', rules: ['required', 'minLength(2)'] },
    { target: 'email', rules: ['required', 'email()'] },
  ],
  { interfaceName: 'Signup', exportName: 'signupValidation', typeImport: './model' }
);

const intent = normalizeIntent({
  formName: 'Order',
  fields: [
    { name: 'price', type: 'number', component: 'InputNumber' },
    { name: 'qty', type: 'number', component: 'InputNumber' },
    { name: 'total', type: 'number', component: 'InputNumber' },
  ],
  behavior: [
    {
      kind: 'compute',
      target: 'total',
      sources: ['price', 'qty'],
      expr: 'model.price.value * model.qty.value',
    },
  ],
});
const behavior = buildBehaviorTs(intent);
```

`@reformer/form-intent/emit` exposes the building blocks of the printers for code generators that lay
out a form module differently (for example, validation split by wizard steps) and want every rule to
print exactly as it does here.

## License

MIT
