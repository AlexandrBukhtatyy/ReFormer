/**
 * Widgets of the bench theme: adapters "RJSF value ⇄ native event" over the neutral primitives.
 * https://rjsf-team.github.io/react-jsonschema-form/docs/advanced-customization/custom-widgets-fields
 *
 * Text, password, email, date and number inputs need no widget of their own: RJSF's `TextWidget`,
 * `PasswordWidget`, `EmailWidget` and `DateWidget` all render the theme's `BaseInputTemplate`.
 */
import type { WidgetProps } from '@rjsf/utils';
import {
  enumOptionSelectedValue,
  enumOptionValueDecoder,
  enumOptionValueEncoder,
  getOptionValueFormat,
} from '@rjsf/utils';
import { controlAttrs } from '../../../shared/ui/FieldFrame';
import { CaptchaWidget as Captcha } from '../../../shared/ui/CaptchaWidget';
import {
  Checkbox,
  MaskedInput,
  RadioGroup,
  ReadonlyValue,
  Select,
  Textarea,
} from '../../../shared/ui/controls';
import { fieldPath, shownError, type BenchFormContext } from './fieldPath';

/** id, testid and aria of the control, from the RJSF id and the field's shown error. */
function attrs({ id, rawErrors, hideError, registry }: WidgetProps) {
  const path = fieldPath(id, registry);
  return controlAttrs(path, shownError(path, rawErrors, hideError, registry));
}

/** `enumOptions` as `{ value, label }` for the shared primitives, encoded per `optionValueFormat`. */
function encodedOptions({ options }: WidgetProps) {
  const format = getOptionValueFormat(options);
  return (options.enumOptions ?? []).map((option, index) => ({
    value: enumOptionValueEncoder(option.value, index, format),
    label: option.label,
  }));
}

/** DOM value → typed enum value (`enumOptionValueDecoder` with the widget's options). */
function decoder({ options }: WidgetProps) {
  const { enumOptions = [], emptyValue } = options;
  const format = getOptionValueFormat(options);
  return (raw: string) => enumOptionValueDecoder(raw, enumOptions, format, emptyValue);
}

/** Replaces core `CheckboxWidget` (booleans). The label is rendered by `FieldTemplate`. */
export function CheckboxWidget(props: WidgetProps) {
  const { id, htmlName, value, disabled, readonly, autofocus, onChange, onBlur, onFocus } = props;
  return (
    <Checkbox
      name={htmlName || id}
      checked={value ?? false}
      disabled={disabled || readonly}
      autoFocus={autofocus}
      onChange={(event) => onChange(event.target.checked)}
      onBlur={(event) => onBlur(id, event.target.checked)}
      onFocus={(event) => onFocus(id, event.target.checked)}
      {...attrs(props)}
    />
  );
}

/** Replaces core `SelectWidget` (single `enum`/`oneOf` choice) with the same option encoding. */
export function SelectWidget(props: WidgetProps) {
  const {
    id,
    htmlName,
    value,
    placeholder,
    disabled,
    readonly,
    autofocus,
    options,
    onChange,
    onBlur,
    onFocus,
  } = props;
  const decode = decoder(props);
  return (
    <Select
      name={htmlName || id}
      placeholder={placeholder || undefined}
      options={encodedOptions(props)}
      value={enumOptionSelectedValue(
        value,
        options.enumOptions,
        false,
        getOptionValueFormat(options),
        ''
      )}
      disabled={disabled || readonly}
      autoFocus={autofocus}
      onChange={(event) => onChange(decode(event.target.value))}
      onBlur={(event) => onBlur(id, decode(event.target.value))}
      onFocus={(event) => onFocus(id, decode(event.target.value))}
      {...attrs(props)}
    />
  );
}

/**
 * Replaces core `RadioWidget` (`ui:widget: 'radio'`) with the shared `RadioGroup`: the contract ids
 * go on the group, each radio gets `{testid}-{DOM value}` (the field's `ui:optionValueFormat:
 * 'realValue'` makes that the enum value itself; README, deviation 21).
 */
export function RadioWidget(props: WidgetProps) {
  const { id, htmlName, value, disabled, readonly, options, onChange, onBlur, onFocus } = props;
  const decode = decoder(props);
  return (
    <RadioGroup
      name={htmlName || id}
      options={encodedOptions(props)}
      value={String(
        enumOptionSelectedValue(
          value,
          options.enumOptions,
          false,
          getOptionValueFormat(options),
          ''
        )
      )}
      disabled={disabled || readonly}
      onChange={(event) => onChange(decode(event.target.value))}
      onBlur={(event) => onBlur(id, decode(event.target.value))}
      // Not a RadioGroup prop: lands on the group and receives the radio's bubbling focus.
      onFocus={(event) => onFocus(id, decode((event.target as HTMLInputElement).value))}
      {...attrs(props)}
    />
  );
}

/**
 * `ui:widget: 'remoteSelect'` — a choice whose options come from the server, not from the schema:
 * `formContext.options[ui:options.optionsFrom]`. Loading them changes `formContext`, never the schema,
 * so RJSF keeps its compiled validator and schema utils. The value is the option's string as is.
 */
export function RemoteSelectWidget(props: WidgetProps) {
  const {
    id,
    htmlName,
    value,
    placeholder,
    disabled,
    readonly,
    autofocus,
    options,
    registry,
    onChange,
    onBlur,
    onFocus,
  } = props;
  const lists = (registry.formContext as BenchFormContext).options;
  const toValue = (raw: string) => (raw === '' ? options.emptyValue : raw);
  return (
    <Select
      name={htmlName || id}
      placeholder={placeholder || undefined}
      options={lists?.[String(options.optionsFrom)] ?? []}
      value={value ?? ''}
      disabled={disabled || readonly}
      autoFocus={autofocus}
      onChange={(event) => onChange(toValue(event.target.value))}
      onBlur={(event) => onBlur(id, toValue(event.target.value))}
      onFocus={(event) => onFocus(id, toValue(event.target.value))}
      {...attrs(props)}
    />
  );
}

/**
 * `ui:widget: 'computed'` — a read-only value the form computes (`readOnly` in the schema): the shared
 * `ReadonlyValue` (`computed-{path}`), no input. `FieldTemplate` leaves it unframed.
 */
export function ComputedWidget({ id, label, value, registry }: WidgetProps) {
  return <ReadonlyValue path={fieldPath(id, registry)} label={label} value={value} />;
}

/** Replaces core `TextareaWidget` (`ui:widget: 'textarea'`, `ui:options.rows`). */
export function TextareaWidget(props: WidgetProps) {
  const {
    id,
    htmlName,
    value,
    placeholder,
    disabled,
    readonly,
    autofocus,
    options,
    onChange,
    onBlur,
    onFocus,
  } = props;
  return (
    <Textarea
      name={htmlName || id}
      placeholder={placeholder || undefined}
      rows={options.rows}
      disabled={disabled}
      readOnly={readonly}
      autoFocus={autofocus}
      value={value ?? ''}
      onChange={(event) =>
        onChange(event.target.value === '' ? options.emptyValue : event.target.value)
      }
      onBlur={(event) => onBlur(id, event.target.value)}
      onFocus={(event) => onFocus(id, event.target.value)}
      {...attrs(props)}
    />
  );
}

/** `ui:widget: 'masked'` with `ui:options.mask` (`9` — digit, anything else — literal). */
export function MaskedWidget(props: WidgetProps) {
  const {
    id,
    htmlName,
    value,
    placeholder,
    disabled,
    readonly,
    autofocus,
    options,
    onChange,
    onBlur,
    onFocus,
  } = props;
  return (
    <MaskedInput
      mask={String(options.mask)}
      name={htmlName || id}
      placeholder={placeholder || undefined}
      disabled={disabled}
      readOnly={readonly}
      autoFocus={autofocus}
      value={value ?? ''}
      onChange={(event) =>
        onChange(event.target.value === '' ? options.emptyValue : event.target.value)
      }
      onBlur={(event) => onBlur(id, event.target.value)}
      onFocus={(event) => onFocus(id, event.target.value)}
      {...attrs(props)}
    />
  );
}

/**
 * `ui:widget: 'captcha'` — the shared widget has a value API; the ids land on its text input. «Обновить»
 * clears the answer through `onChange('')`, which is stored as `emptyValue` like any emptied input.
 */
export function CaptchaWidget(props: WidgetProps) {
  const {
    id,
    htmlName,
    value,
    placeholder,
    disabled,
    readonly,
    autofocus,
    options,
    onChange,
    onBlur,
    onFocus,
  } = props;
  return (
    <Captcha
      name={htmlName || id}
      placeholder={placeholder || undefined}
      disabled={disabled}
      readOnly={readonly}
      autoFocus={autofocus}
      value={value ?? ''}
      onChange={(answer) => onChange(answer === '' ? options.emptyValue : answer)}
      onBlur={() => onBlur(id, value)}
      onFocus={(event) => onFocus(id, event.target.value)}
      {...attrs(props)}
    />
  );
}
