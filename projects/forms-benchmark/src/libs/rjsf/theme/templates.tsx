/**
 * Templates of the bench theme: RJSF's layout slots mapped onto the neutral primitives.
 * https://rjsf-team.github.io/react-jsonschema-form/docs/advanced-customization/custom-templates
 */
import type {
  ArrayFieldItemTemplateProps,
  ArrayFieldTemplateProps,
  BaseInputTemplateProps,
  FieldTemplateProps,
  ObjectFieldTemplateProps,
  SubmitButtonProps,
} from '@rjsf/utils';
import { getInputProps, getSchemaType, getSubmitButtonOptions, getUiOptions } from '@rjsf/utils';
import { FieldFrame, controlAttrs } from '../../../shared/ui/FieldFrame';
import { DateInput, NumberInput, TextInput } from '../../../shared/ui/controls';
import { ArrayFrame, ArrayRow, Section } from '../../../shared/ui/array';
import { Actions, SubmitButton as BenchSubmitButton } from '../../../shared/ui/layout';
import { formatNumberInput, parseNumberInput } from '../../../shared/domain/credit';
import { fieldPath, parentPath, shownError } from './fieldPath';

/**
 * One form row. Leaf fields get the contract frame (`field-{path}` → label → control → `error-{path}`);
 * objects and arrays are containers and render their own template, and a computed value
 * (`ui:widget: 'computed'`) is a read-only output with its own label, so they pass through untouched.
 * The label is always shown by the frame — for a checkbox it goes after the control (`inline`).
 */
export function FieldTemplate({
  id,
  label,
  children,
  rawErrors,
  hideError,
  hidden,
  schema,
  uiSchema,
  registry,
}: FieldTemplateProps) {
  const type = getSchemaType(schema);
  const { widget } = getUiOptions(uiSchema);
  if (hidden || type === 'object' || type === 'array' || widget === 'computed') return children;
  const path = fieldPath(id, registry);
  const inline = type === 'boolean' && (widget ?? 'checkbox') === 'checkbox';
  return (
    <FieldFrame
      path={path}
      label={label}
      error={shownError(path, rawErrors, hideError, registry)}
      inline={inline}
    >
      {children}
    </FieldFrame>
  );
}

/**
 * Object properties in schema order. The root object and an untitled nested one (an array row, or a
 * group a form layout frames itself) add no markup; a nested object with its own title (`ui:title` or
 * schema `title`) is a `Section`. The `title` prop is not used for that: RJSF falls back to the
 * property name (`personalData`) or the row title (`Имущество-1`) there. A form that needs its own
 * arrangement passes `ui:ObjectFieldTemplate` in its uiSchema.
 */
export function ObjectFieldTemplate({
  properties,
  fieldPathId,
  schema,
  uiSchema,
}: ObjectFieldTemplateProps) {
  const content = properties.map((property) => property.content);
  const title = getUiOptions(uiSchema).title ?? schema.title;
  if (fieldPathId.path.length === 0 || !title) return <>{content}</>;
  return <Section title={title}>{content}</Section>;
}

/**
 * The `<input>` behind RJSF's text, password, email, date and number widgets, by input type:
 * `number` → `NumberInput` (no native `min`/`max`/`step`: the rules are the schema's), `date` →
 * `DateInput`, anything else → `TextInput`. An emptied input reports `options.emptyValue`
 * (`undefined` unless `ui:emptyValue` says otherwise) exactly like the core template, so `required`
 * keeps working; a number is parsed with the shared `parseNumberInput` before RJSF's `NumberField`.
 */
export function BaseInputTemplate(props: BaseInputTemplateProps) {
  const {
    id,
    htmlName,
    value,
    type,
    placeholder,
    disabled,
    readonly,
    autofocus,
    options,
    schema,
    rawErrors,
    hideError,
    registry,
    onChange,
    onChangeOverride,
    onBlur,
    onFocus,
  } = props;
  const path = fieldPath(id, registry);
  const common = {
    name: htmlName || id,
    disabled,
    readOnly: readonly,
    autoFocus: autofocus,
    onBlur: (event: { target: HTMLInputElement }) => onBlur(id, event.target.value),
    onFocus: (event: { target: HTMLInputElement }) => onFocus(id, event.target.value),
    ...controlAttrs(path, shownError(path, rawErrors, hideError, registry)),
  };
  const inputType = getInputProps(schema, type, options).type;
  if (inputType === 'number') {
    return (
      <NumberInput
        placeholder={placeholder || undefined}
        value={formatNumberInput(value)}
        onChange={
          onChangeOverride ??
          ((event) => onChange(parseNumberInput(event.target.value) ?? options.emptyValue))
        }
        {...common}
      />
    );
  }
  const handleChange =
    onChangeOverride ??
    ((event: { target: HTMLInputElement }) =>
      onChange(event.target.value === '' ? options.emptyValue : event.target.value));
  if (inputType === 'date') {
    return <DateInput value={value ?? ''} onChange={handleChange} {...common} />;
  }
  return (
    <TextInput
      type={inputType}
      placeholder={placeholder || undefined}
      value={value ?? ''}
      onChange={handleChange}
      {...common}
    />
  );
}

/**
 * An array: the shared `ArrayFrame` (title, rows, «Добавить» → `onAddClick`). The add label and the
 * row title come from the array's `ui:options` (`addLabel`, `rowTitle`).
 */
export function ArrayFieldTemplate({
  items,
  onAddClick,
  title,
  fieldPathId,
  uiSchema,
  registry,
}: ArrayFieldTemplateProps) {
  const { title: uiTitle, addLabel } = getUiOptions(uiSchema);
  return (
    <ArrayFrame
      path={fieldPath(fieldPathId.$id, registry)}
      title={uiTitle ?? title ?? ''}
      addLabel={String(addLabel)}
      onAdd={onAddClick}
    >
      {items}
    </ArrayFrame>
  );
}

/**
 * One array row: the shared `ArrayRow` («{rowTitle} {i+1}» and «Удалить» → `onRemoveItem` of the
 * item's `buttonsProps`). Move/copy buttons are off (`orderable: false`, `copyable` default).
 */
export function ArrayFieldItemTemplate({
  children,
  index,
  buttonsProps,
  parentUiSchema,
  registry,
}: ArrayFieldItemTemplateProps) {
  const path = parentPath(fieldPath(buttonsProps.fieldPathId.$id, registry), registry);
  return (
    <ArrayRow
      path={path}
      index={index}
      title={String(getUiOptions(parentUiSchema).rowTitle)}
      onRemove={buttonsProps.onRemoveItem}
    >
      {children}
    </ArrayRow>
  );
}

/**
 * Default submit row, rendered only when the Form has no `children`; text and extra props come from
 * `ui:submitButtonOptions`.
 */
export function SubmitButton({ uiSchema }: SubmitButtonProps) {
  const { submitText, norender, props } = getSubmitButtonOptions(uiSchema);
  if (norender) return null;
  return (
    <Actions>
      <BenchSubmitButton {...props}>{submitText}</BenchSubmitButton>
    </Actions>
  );
}
