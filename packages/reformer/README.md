# @reformer/core

[![npm version](https://img.shields.io/npm/v/@reformer/core.svg)](https://www.npmjs.com/package/@reformer/core)
[![npm downloads](https://img.shields.io/npm/dm/@reformer/core.svg)](https://www.npmjs.com/package/@reformer/core)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://opensource.org/licenses/MIT)

Reactive form state on signals. The root entry is UI-agnostic (works on a server and in tests);
React bindings live in `@reformer/core/react`.

A form is four parts bound to the model's handles (`model.$.<field>`): the **model** (values),
the **form schema** (a tree of nodes), the **validation** (rules over the model, separate from
the schema) and the **behavior** (computed values, links between fields). `createForm` assembles
them in one call.

[![Open in StackBlitz](https://developer.stackblitz.com/img/open_in_stackblitz_small.svg)](https://stackblitz.com/~/github.com/AlexandrBukhtatyy/ReFormer/tree/main/projects/react-playground?file=projects/react-playground/src/App.tsx)

## Installation

```bash
npm install @reformer/core
```

`react` and `react-dom` are optional peers — needed only for `@reformer/core/react`.

## Quick start

```tsx
import { createForm, type FormControl, type FormModel, type FormSchemaNode } from '@reformer/core';
import { useFormBundle, useFormControl } from '@reformer/core/react';
import { defineValidation, validate } from '@reformer/core/validation';
import { required, email } from '@reformer/core/validators';

type Contact = { email: string };

// Form schema: a tree of nodes bound to model handles. No rules here.
const schema = (model: FormModel<Contact>): FormSchemaNode => ({
  children: [{ model: model.$.email }],
});

// Validation is a separate contract. A rule reports a code, not a text.
const rules = defineValidation<Contact>(({ model }) => {
  validate(model.$.email, [required(), email()]);
});

const createContact = () =>
  createForm<Contact>({ initial: { email: '' }, schema, validation: rules });

function EmailInput({ control }: { control: FormControl<string> }) {
  const { value, shouldShowError, issues } = useFormControl(control);
  return (
    <label>
      Email
      <input
        value={value}
        onChange={(e) => control.setValue(e.target.value)}
        onBlur={() => control.markAsTouched()}
      />
      {shouldShowError && <span role="alert">{issues[0]?.code}</span>}
    </label>
  );
}

export function ContactForm() {
  // The factory runs once; the bundle stays stable between renders.
  const bundle = useFormBundle(createContact);
  const send = async (event: React.FormEvent) => {
    event.preventDefault();
    // One run of all rules; the handler is called only when the form is valid.
    await bundle.submission.submit((values) => console.log(values));
  };
  return (
    <form onSubmit={send}>
      <EmailInput control={bundle.form.email} />
      <button type="submit">Send</button>
    </form>
  );
}
```

Issue texts come from the locale (`I18nProvider`) and a form dictionary
(`defineIssueMessages`, `useIssueMessage`). Ready-made fields with a label and an error —
`FormField` from [`@reformer/ui-kit`](https://www.npmjs.com/package/@reformer/ui-kit).

## Package entries

| Import                                             | Contains                                                                                                         |
| -------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| `@reformer/core`                                   | `createForm`, `createModel`, `arrayOf`, `compileSchema`, `createFormFlow`, `createSubmission`, node types        |
| `@reformer/core/react`                             | `useFormBundle`, `useFormControl`, `useFormFlow`, `useFormValidation`, `I18nProvider`, `useIssueMessage`         |
| `@reformer/core/validation`                        | `defineValidation`, `validate`, `validateAsync`, `validateWhen`, `apply`, `applyEach`, `validateModel`           |
| `@reformer/core/validators`                        | rule factories: `required`, `min`, `max`, `minLength`, `email`, `pattern`, `url`, `phone`, numbers, dates, files |
| `@reformer/core/validators/<name>`                 | one rule per entry (`required`, `email`, `min-length`, `is-date`, `min-age`, …)                                  |
| `@reformer/core/behaviors`                         | `defineFormBehavior`, `compute`, `copyFrom`, `onChange`, `enableWhen`, `resetWhen`, `hideWhen`, …                |
| `@reformer/core/model`                             | the low-level model without forms: `createModel`, `arrayOf`, `modelOf`, value operations                         |
| `@reformer/core/signals`                           | `signal`, `computed`, `effect`, `batch`, `untracked` — the single copy of the reactive runtime                   |
| `@reformer/core/i18n`                              | localization without React: `defineIssueMessages`, `createLocaleLoader`, `createI18n`, `msg`                     |
| `@reformer/core/locale`                            | `loadCoreLocale` — built-in locales (`en`, `ru`), one chunk per language                                         |
| `@reformer/core/locale/en`, `/locale/ru`           | synchronous locale modules (SSR, tests)                                                                          |
| `@reformer/core/locale/en.json`, `/locale/ru.json` | dictionaries as JSON                                                                                             |

## Links

- Documentation: [quick start](https://alexandrbukhtatyy.github.io/ReFormer/docs/getting-started/quick-start),
  [validation](https://alexandrbukhtatyy.github.io/ReFormer/docs/validation/overview),
  [behaviors](https://alexandrbukhtatyy.github.io/ReFormer/docs/behaviors/overview),
  [API reference](https://alexandrbukhtatyy.github.io/ReFormer/docs/api)
- Recipes for AI assistants: [`docs/llms`](./docs/llms) (start with
  [`39-overview.md`](./docs/llms/39-overview.md)); they ship in the package together with `llms.txt`
- MCP server for AI assistants: [`@reformer/mcp`](https://www.npmjs.com/package/@reformer/mcp)

## License

MIT
