# @reformer/renderer-vue

Vue 3 renderer for [`@reformer/core`](https://www.npmjs.com/package/@reformer/core). Draws the form
bundle built by `createForm` from its form schema — the same compiled tree the React renderer
draws: field nodes go to their components, containers and HTML tags become markup, arrays of
sub-forms and parts are expanded in their own schema scopes.

> Experimental and not published yet: the package is `private` while the renderer is brought to
> parity with `@reformer/renderer-react`.

Peers: `@reformer/core` and `vue` 3.5+. Components come from your application — usually thin
adapters over a component library.

## Quick start

```ts
import { defineComponent, h } from 'vue';
import { createForm, type FormModel } from '@reformer/core';
import { FormRenderer, useFormBundle } from '@reformer/renderer-vue';
import { TextInput } from './kit';

type SignUp = { email: string };

const schema = (model: FormModel<SignUp>) => ({
  component: 'form',
  children: [{ model: model.$.email, component: TextInput, componentProps: { label: 'Email' } }],
});

export const SignUpForm = defineComponent({
  setup() {
    // Built once per component; live validation starts on mount, the bundle is disposed on unmount.
    const bundle = useFormBundle(() => createForm<SignUp>({ initial: { email: '' }, schema }));
    return () => h(FormRenderer, { form: bundle });
  },
});
```

A form described by a JSON document is built with the framework-neutral entry of
`@reformer/renderer-json`:

```ts
import { defineRegistry } from '@reformer/renderer-json/neutral';

const registry = defineRegistry((reg) => reg.component('TextInput', TextInput));
const bundle = createForm({ schema: document, registry, initial });
```

## Controls

A field component is bound with `v-model` by default: the value comes as `modelValue`, changes are
reported with `update:modelValue`, and `blur` marks the field as touched. A component with another
dialect declares it with the `reformerAdapter` static, as in the React renderer.

The renderer also passes `disabled` and `data-testid="input-{path}"`. A control that draws the whole
field itself — label and error included — asks for the form node:

```ts
import { useFieldError, useFormControl } from '@reformer/renderer-vue';

export const TextInput = defineComponent({
  props: { modelValue: String, label: String, control: Object },
  emits: ['update:modelValue', 'blur'],
  setup(props, { emit }) {
    const error = useFieldError(props.control); // text of the issue the field shows now
    return () => /* … */ null;
  },
});
TextInput.reformerNeedsControl = true; // receive the form node as `control`
TextInput.reformerLayout = 'inline-label'; // receive `label` instead of the field wrapper
```

Without such a control, register a field wrapper (`settings.fieldWrapper` of `FormRenderer`, or the
`FIELD_WRAPPER` registry entry): it receives `control` and `testId` and the control in its default
slot.

## Reactivity

Form state lives in the signals of `@reformer/core`; the renderer bridges them into `shallowRef`s
(`useSignalValue`, `useFormControl`). The bundle and form nodes are marked with `markRaw`: the core
matches nodes and model handles by reference, so a Vue proxy around a node would silently detach
the field from the form. Do not wrap them in `reactive()` yourself.

## Not in this version

- Uncontrolled field binding (a React re-render optimisation).
- The low-level `render` + `createRenderSchema` path — pass the bundle of `createForm`.
- Reactive locale switching: the locale is read when a component is created.
