# @reformer/cdk

Headless components for [`@reformer/core`](https://www.npmjs.com/package/@reformer/core) forms:
behavior, state and accessibility without markup or styles. Compound components (`FieldArray.Root`,
`FieldArray.List`, …), render props and hooks — you write the markup. Styled versions built on
them live in [`@reformer/ui-kit`](https://www.npmjs.com/package/@reformer/ui-kit).

## Installation

```bash
npm install @reformer/cdk @reformer/core
```

Peers: `@reformer/core`, `react` and `react-dom` 18 or 19.

## Quick start

A dynamic array of sub-forms: the cdk keeps the rows, keys and actions, the markup is yours.

```tsx
import type { FormArray, FormGroup } from '@reformer/core';
import { useFormControl } from '@reformer/core/react';
import { FieldArray } from '@reformer/cdk/field-array';

type Phone = { number: string };

function PhoneRow({ control }: { control: FormGroup<Phone> }) {
  const { value } = useFormControl(control.number);
  return (
    <input
      aria-label="Phone"
      value={value}
      onChange={(e) => control.number.setValue(e.target.value)}
    />
  );
}

export function Phones({ control }: { control: FormArray<Phone> }) {
  return (
    <FieldArray.Root control={control}>
      <FieldArray.Empty>
        <p>No phones yet</p>
      </FieldArray.Empty>
      {/* The generic types the row: List has no control of its own to infer it from. */}
      <FieldArray.List<Phone>>
        {({ control: row, index, remove }) => (
          <div>
            <span>#{index + 1}</span>
            <PhoneRow control={row} />
            <button type="button" onClick={remove}>
              Remove
            </button>
          </div>
        )}
      </FieldArray.List>
      <FieldArray.AddButton>Add phone</FieldArray.AddButton>
    </FieldArray.Root>
  );
}
```

`control` is the form node of the array (`bundle.form.phones`); a new row is built from the
model's row template (`arrayOf`).

## Package entries

| Import                                            | Contains                                                                                                  |
| ------------------------------------------------- | --------------------------------------------------------------------------------------------------------- |
| `@reformer/cdk`                                   | everything below except the locale entries, plus `ValidationMessagesProvider`, `useIssueMessageResolver`  |
| `@reformer/cdk/field-array`                       | `FieldArray` (`Root`, `List`, `AddButton`, `RemoveButton`, `Empty`, `Count`, `Error`, …), `useFieldArray` |
| `@reformer/cdk/list`                              | `List` (`Root`, `Items`, `Empty`), `useList` — display-only iteration over a model array                  |
| `@reformer/cdk/form-wizard`                       | `FormWizard` (`Step`, `Indicator`, `Actions`, `Prev`, `Next`, `Submit`, `Progress`), `useFormWizard`      |
| `@reformer/cdk/form-field`                        | `FormField` (`Root`, `Label`, `Control`, `Error`, `Description`, `Hint`), `useFormField`                  |
| `@reformer/cdk/file-upload`                       | `FileUpload` (`Root`, `Trigger`, `Dropzone`, `ItemGroup`, `Item`, …), `useFileUpload`                     |
| `@reformer/cdk/autocomplete`                      | `Autocomplete` (`Root`, `Input`, `Listbox`, `Option`, `Loading`), `useAutocomplete`                       |
| `@reformer/cdk/option-source`                     | `ResourceConfig`, `useResourceOptions` — async options source with search and pages                       |
| `@reformer/cdk/async-boundary`                    | `AsyncBoundary` (`Loading`, `Content`, `Empty`, `Error`, `Retry`, …), `useAsyncResource`                  |
| `@reformer/cdk/locale`                            | `loadCdkLocale` — cdk strings on top of the core locale (`en`, `ru`)                                      |
| `@reformer/cdk/locale/en`, `/locale/ru`           | synchronous locale modules                                                                                |
| `@reformer/cdk/locale/en.json`, `/locale/ru.json` | dictionaries as JSON                                                                                      |

Validation issues carry a code, not a text: `FormField.Error` and `FieldArray.Error` take the text
from the locale (`I18nProvider` from `@reformer/core/react`) and a form dictionary
(`<ValidationMessagesProvider messages={defineIssueMessages(…)}>`).

## Links

- Documentation: [CDK overview](https://alexandrbukhtatyy.github.io/ReFormer/docs/cdk/overview),
  [FieldArray](https://alexandrbukhtatyy.github.io/ReFormer/docs/cdk/field-array),
  [FormWizard](https://alexandrbukhtatyy.github.io/ReFormer/docs/cdk/form-wizard),
  [FileUpload](https://alexandrbukhtatyy.github.io/ReFormer/docs/cdk/file-upload)
- Recipes for AI assistants: [`docs/llms`](./docs/llms) — `field-array`, `form-navigation`,
  `form-field`, `async-boundary`, `autocomplete`, `file-upload`, `list`, `option-source`
- MCP server for AI assistants: [`@reformer/mcp`](https://www.npmjs.com/package/@reformer/mcp)

## License

MIT
