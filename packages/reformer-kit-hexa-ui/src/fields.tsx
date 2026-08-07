/**
 * Адаптеры полей HexaUI к seam ReFormer.
 *
 * Контракт формы ReFormer — `value` + `onChange(value)` + `onBlur` (см. `withFormControl` в
 * `@reformer/ui-kit`). HexaUI, в отличие от голого antd, уже нормализует колбэки к value-based,
 * поэтому адаптеры тонкие: снять лишние аргументы (`Textbox` отдаёт `(value, mask)`, `Select` —
 * `(value, option)`), привести имя value-пропа и убрать из спреда служебный `control`.
 *
 * Имена экспортов — КАНОНИЧЕСКИЕ для ReFormer (`InputField`, `SelectField`, …), а не HexaUI'шные.
 * Благодаря этому одна и та же схема формы рендерится и на `@reformer/ui-kit`, и на HexaUI: каталог
 * связывает каноническое имя записи с экспортом кита через `exportName`.
 *
 * @module reformer/kit-hexa-ui/fields
 */

import { Textbox, Checkbox, Select } from '@kaspersky/hexa-ui';

/* eslint-disable @typescript-eslint/no-explicit-any */

/** Пропсы, которые рендерер кладёт полю. `control` — служебный, в примитив его пускать нельзя. */
interface FieldProps {
  value?: unknown;
  onChange?: (value: unknown) => void;
  onBlur?: () => void;
  control?: unknown;
  [key: string]: unknown;
}

/**
 * Пропсы, адресованные ОБЁРТКЕ поля, а не контролу: их читает `FormField` из cdk-контекста.
 * Если не снять — HexaUI прокинет неизвестный проп в DOM, и в разметке появится
 * `<input label="Сумма">`. React такие атрибуты не фильтрует, потому что они строковые.
 */
const WRAPPER_PROPS = ['label', 'required', 'description'] as const;

/** Снять со спреда служебные ключи seam'а и пропсы обёртки. */
function rest(props: FieldProps): Record<string, unknown> {
  const { value: _v, onChange: _c, onBlur: _b, control: _ctl, ...other } = props;
  void _v;
  void _c;
  void _b;
  void _ctl;
  for (const key of WRAPPER_PROPS) delete other[key];
  return other;
}

/** Текстовое поле: HexaUI `Textbox` уже отдаёт `onChange(value)`, второй аргумент (маска) лишний. */
export function InputField(props: FieldProps) {
  const { value, onChange, onBlur } = props;
  return (
    <Textbox
      {...(rest(props) as any)}
      value={(value ?? '') as string}
      onChange={(next: string) => onChange?.(next)}
      onBlur={onBlur as any}
    />
  );
}

/** Многострочное поле: вариант compound-компонента `Textbox.Textarea`. */
export function TextareaField(props: FieldProps) {
  const { value, onChange, onBlur } = props;
  return (
    <Textbox.Textarea
      {...(rest(props) as any)}
      value={(value ?? '') as string}
      onChange={(next: string) => onChange?.(next)}
      onBlur={onBlur as any}
    />
  );
}

/** Пароль: `Textbox.Password`. */
export function InputPasswordField(props: FieldProps) {
  const { value, onChange, onBlur } = props;
  return (
    <Textbox.Password
      {...(rest(props) as any)}
      value={(value ?? '') as string}
      onChange={(next: string) => onChange?.(next)}
      onBlur={onBlur as any}
    />
  );
}

/** Числовое поле: `Textbox.Number`. */
export function InputNumberField(props: FieldProps) {
  const { value, onChange, onBlur } = props;
  return (
    <Textbox.Number
      {...(rest(props) as any)}
      value={value as any}
      onChange={(next: unknown) => onChange?.(next)}
      onBlur={onBlur as any}
    />
  );
}

/**
 * Чекбокс. Значение живёт в `checked`, а подпись компонент рисует сам — поэтому помечаем
 * `reformerLayout = 'inline-label'`, иначе обёртка поля нарисует вторую подпись сверху.
 */
export function CheckboxField(props: FieldProps) {
  const { value, onChange } = props;
  return (
    <Checkbox
      {...(rest(props) as any)}
      checked={Boolean(value)}
      onChange={(next: any) => onChange?.(typeof next === 'boolean' ? next : next?.target?.checked)}
    />
  );
}
CheckboxField.reformerLayout = 'inline-label';

/** Выпадающий список: `onChange(value, option)` — второй аргумент отбрасываем. */
export function SelectField(props: FieldProps) {
  const { value, onChange, onBlur } = props;
  return (
    <Select
      {...(rest(props) as any)}
      value={value as any}
      onChange={(next: unknown) => onChange?.(next)}
      onBlur={onBlur as any}
    />
  );
}
