# @reformer/renderer-angular

Angular renderer for [`@reformer/core`](https://www.npmjs.com/package/@reformer/core). Draws the
form bundle built by `createForm` from its form schema — the same compiled tree the React and Vue
renderers draw: field nodes go to their components, containers and HTML tags become markup, arrays
of sub-forms and parts are expanded in their own schema scopes.

> Experimental and not published yet: the package is `private` while the renderer is brought to
> parity with `@reformer/renderer-react`.

Peers: `@reformer/core` and `@angular/core` 21. Components come from your application — usually
thin adapters over a component library. Everything is standalone and works without `zone.js`.

## Quick start

```ts
import { ChangeDetectionStrategy, Component } from '@angular/core';
import { createForm, type FormModel } from '@reformer/core';
import { FormRenderer, ownFormBundle } from '@reformer/renderer-angular';
import { TextInput } from './kit';

type SignUp = { email: string };

const schema = (model: FormModel<SignUp>) => ({
  component: 'form',
  children: [{ model: model.$.email, component: TextInput, componentProps: { label: 'Email' } }],
});

@Component({
  selector: 'app-sign-up',
  imports: [FormRenderer],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<reformer-form [form]="bundle" />`,
})
export class SignUpForm {
  // Built once per component; live validation starts after the first render, the bundle is
  // disposed together with the component.
  readonly bundle = ownFormBundle(() => createForm<SignUp>({ initial: { email: '' }, schema }));
}
```

A form described by a JSON document is built with the framework-neutral entry of
`@reformer/renderer-json`:

```ts
import { defineRegistry } from '@reformer/renderer-json/neutral';

const registry = defineRegistry((reg) => reg.component('TextInput', TextInput));
const bundle = createForm({ schema: document, registry, initial });
```

`<reformer-form>` adds no elements of its own: the form stands right inside its host element.
Inputs: `form` (the bundle), `settings` (`fieldWrapper`, `resolveFieldAdapter`) and `messages` (the
form dictionary of issue texts). Changing an input draws the form again.

## How node props reach a component

The core hands the renderer one flat props object per node — the same one the React and Vue
renderers get. An Angular component has three channels, and the component declaration decides
where a key goes:

- a key that matches a declared input is set as that input;
- a function under the name of a declared output (`valueChange`) or under its handler key
  (`onValueChange`) subscribes to the output;
- everything else goes to the host element: attributes (`data-testid`, `aria-*`), `className`,
  `style` and DOM listeners (`onClick`).

So a component receives only what it declared, and the rest is still not lost. Components whose
host is the native element itself (`selector: 'input[appTextInput]'`) get `data-testid` and the
class right on that element.

Children of a node are projected: the component needs an `<ng-content />` in its template, outside
of any `@if` — the content must be in place when the component is created. A component that lays
its children out itself (a wizard, tabs) declares the static `__selfManagedChildren = true`,
receives the child nodes in the `children` input and draws them with the `reformerNode` directive:

```html
@for (step of children(); track step.id) {
<ng-container [reformerNode]="step" />
}
```

## Controls

A field component is bound as `[(value)]` by default: the value comes in the `value` input, changes
are reported by the `valueChange` output (a `model()` gives the same pair), and losing focus marks
the field as touched — the renderer listens for it on the host element. A component with another
dialect declares it with the `reformerAdapter` static, as in the React renderer.

The renderer also passes `disabled` and `data-testid="input-{path}"`. A control that draws the whole
field itself — label and error included — asks for the form node:

```ts
import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import type { FormControl } from '@reformer/core';
import { fieldError, formControlSignals } from '@reformer/renderer-angular';

@Component({
  selector: 'app-text-input',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <label>
      {{ label() }}
      <input
        [value]="field.value()"
        [disabled]="field.disabled()"
        (input)="valueChange.emit($any($event.target).value)"
      />
    </label>
    @if (error(); as text) {
      <p role="alert">{{ text }}</p>
    }
  `,
})
export class TextInput {
  static readonly reformerAdapter = { passControl: true }; // receive the form node as `control`
  static readonly reformerLayout = 'inline-label'; // receive `label` instead of the field wrapper

  readonly control = input.required<FormControl<string>>();
  readonly label = input<string>();
  readonly valueChange = output<string>();

  protected readonly field = formControlSignals(this.control); // node state as Angular signals
  protected readonly error = fieldError(this.control); // text of the issue the field shows now
}
```

Without such a control, register a field wrapper (`settings.fieldWrapper` of `FormRenderer`, or the
`FIELD_WRAPPER` registry entry): it receives the `control` and `testId` inputs — those it declared —
and the control as projected content.

## Arrays

The component of an array node receives plain inputs: `items` and the callbacks `onAdd`,
`onRemove`, `onMove`, plus the `componentProps` of the node. A row is drawn with the
`reformerArrayItem` directive:

```html
@for (item of items(); track item.key) {
<li>
  <ng-container [reformerArrayItem]="item" />
  <button type="button" (click)="onRemove()?.(item.index)">Remove</button>
</li>
}
```

The callbacks are inputs, not outputs: `onMove` takes two arguments, and an Angular output carries
one value.

## Reactivity

Form state lives in the signals of `@reformer/core`, which Angular templates do not subscribe to.
`fromCoreSignal(read)` bridges them into an Angular signal: the template subscribes to it as usual,
and a change schedules the re-render on its own — no zone is needed. The bridge is lazy, so a
component re-renders only on what it has read. `formControlSignals`, `fieldError` and
`formFlowSignals` are built on it.

The form bundle of the surrounding renderer is available with `injectFormBundle()` — a submit or
reset button of the kit takes the form from there.

## Not in this version

- Uncontrolled field binding (a React re-render optimisation).
- The low-level `render` + `createRenderSchema` path — pass the bundle of `createForm`.
- Reactive locale switching: the locale is read when a component is created.
- An error boundary around registry components.
- Conditional content projection: a component that hides its `<ng-content />` behind `@if` does not
  get the children of its node.

## Scripts

```bash
npm run build      # ng-packagr → dist/ (FESM bundle, type declarations, package manifest)
npm run typecheck  # ngc over sources and tests
npm run test       # vitest with the Analog plugin, happy-dom, no TestBed
```

`dist/` is a complete package with its own `package.json`: it is what gets published. The
`exports` field of the source `package.json` points into `dist/` so that workspace consumers
resolve the built package; ng-packagr rewrites it for the published manifest and reports the
rewrite as three "conflicting export condition" warnings — they are expected.
