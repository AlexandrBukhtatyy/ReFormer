# @reformer/kit-taiga

ReFormer kit on [Taiga UI 5](https://taiga-ui.dev): standalone components under the names of its
component catalog for a form on [`@reformer/renderer-json`](../reformer-renderer-json), drawn by
[`@reformer/renderer-angular`](../reformer-renderer-angular).

> Experimental and not published yet: the package is `private`.

The catalog (`component-catalog.json`, export `./catalog`) describes the kit to its readers — form
generators, checks, hints: component names, their inputs, `kit.framework: "angular"`. The names
match the catalog of `@reformer/ui-kit` (`Input`, `InputMask`, `Select`, `FieldArray`,
`FormWizard`, `Step`, …), so one form document renders with either kit.

## Setup

```ts
import { provideZonelessChangeDetection } from '@angular/core';
import { bootstrapApplication } from '@angular/platform-browser';
import { provideKitTaiga } from '@reformer/kit-taiga';

bootstrapApplication(App, {
  providers: [provideZonelessChangeDetection(), provideKitTaiga()],
});
```

The form lives inside `<tui-root>` — it hosts the dropdown portal of the list. Styles:
`@taiga-ui/styles/taiga-ui-theme.css` and `@reformer/kit-taiga/styles.css`. The icons the kit's
widgets need are inlined: the build needs no `assets` entry pointing into `node_modules`.

Checkbox, switch, radio buttons and list run on a `FormControl` mirror of the ReFormer field, so the
application needs `@angular/forms`.

## Registry

```ts
import { defineRegistry } from '@reformer/renderer-json/neutral';
import { FormWizard, Input, Section, Select, Step } from '@reformer/kit-taiga';

export const registry = defineRegistry((reg) => {
  reg.component('Input', Input);
  reg.component('Select', Select);
  reg.component('Section', Section);
  reg.component('FormWizard', FormWizard);
  reg.component('Step', Step);
});
```

No field wrapper is registered (`kit.infra.fieldWrapper: null`): every control is a complete field
and draws its own label and error.

## DOM contract

The same roles as `@reformer/ui-kit`: `field-`, `label-`, `input-` and `error-{testId}` (no error
element while there is no error); `input-{testId}-{value}` on radio buttons;
`option-{testId}-{value}` on list options, the selected value in `data-value` on `input-{testId}`;
`array-add`, `array-item-{i}`, `array-item-{i}-remove` inside `[data-slot="field-array"]`;
`step-indicator-{n}` with `data-step-current`, `btn-previous` (absent on the first step),
`btn-next`, `btn-submit`.

Values: text — a string (`''` when empty), number — `number | null`, date — a `YYYY-MM-DD` string,
checkbox and switch — `boolean`.
