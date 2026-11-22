/**
 * Number view, apart from `./fields` so that the registration bundle does not import the credit
 * domain module (`parseNumberInput`/`formatNumberInput` live there).
 */
import { FieldFrame, controlAttrs } from '../../../shared/ui/FieldFrame';
import { NumberInput } from '../../../shared/ui/controls';
import { formatNumberInput, parseNumberInput } from '../../../shared/domain/credit';
import type { Bound } from './binding';
import type { ViewProps } from './fields';

/**
 * `number | null` in the form, a string in the input. `handleChange` would store `''` for an empty
 * number input, so the value goes through `setValue` (`FieldHelperProps.setValue` semantics).
 */
export function numberView(
  b: Bound<number | null>,
  { label, ...props }: ViewProps<typeof NumberInput>
) {
  return (
    <FieldFrame path={b.path} label={label} error={b.error}>
      <NumberInput
        {...props}
        name={b.field.name}
        value={formatNumberInput(b.field.value)}
        onChange={(e) => b.setValue(parseNumberInput(e.target.value))}
        onBlur={b.field.onBlur}
        {...controlAttrs(b.path, b.error)}
      />
    </FieldFrame>
  );
}
