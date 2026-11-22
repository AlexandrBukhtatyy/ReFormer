/**
 * Булевы поля: `Checkbox` (экспорт `CheckboxWithLabel`), `Switch` (экспорт `SwitchWithLabel`),
 * `Toggle` (экспорт `ToggleButton`) — имена записей те же, что у `@reformer/ui-kit`, а имя
 * экспорта каталог называет полем `exportName`.
 *
 * Чекбоксу и переключателю нужен свой компонент, а не только адаптер: HexaUI рисует их подпись из
 * `children`, а в схеме она приходит пропом `label` — переименовать проп в `children` адаптер не
 * умеет (он переименовывает только value-проп). Подпись они рисуют рядом с собой, поэтому несут
 * статику `reformerLayout = 'inline-label'`: `FormField` кита вторую подпись сверху не даёт, а
 * `required`/`tooltip` контрол рисует у своей подписи сам (адаптер их не срезает).
 *
 * `ToggleButton` HexaUI — кнопка с `selected` и `onChange(value, checked)`: булево поле из неё
 * получается обёрткой (адаптер видит только первый аргумент эмита — строку `value`).
 *
 * @module reformer/kit-hexa-ui/fields/boolean
 */

import type { FocusEventHandler, ReactNode } from 'react';
import type {
  CheckboxProps,
  ToggleButtonProps as HexaToggleButtonProps,
  ToggleProps,
} from '@kaspersky/hexa-ui';
// Значения HexaUI — с подпутей: модуль входит в пространство имён билдера (см. `../palette`).
import { Checkbox } from '@kaspersky/hexa-ui/checkbox';
import { Toggle } from '@kaspersky/hexa-ui/toggle';
import { ToggleButton as HexaToggleButton } from '@kaspersky/hexa-ui/toggle-button';
import { booleanAdapter, checkboxAdapter, switchAdapter } from './adapters';
import { BlurScope } from './control';

/** Пропсы {@link CheckboxWithLabel}: пропсы HexaUI `Checkbox`, подпись — пропом `label`. */
export type CheckboxWithLabelProps = Omit<CheckboxProps, 'children'> & {
  /** Подпись рядом с чекбоксом. */
  label?: ReactNode;
};

/** Чекбокс с подписью: HexaUI `Checkbox` (antd), `onChange(e)` с `e.target.checked`. */
export function CheckboxWithLabel({ label, ...rest }: CheckboxWithLabelProps) {
  return <Checkbox {...rest}>{label}</Checkbox>;
}
CheckboxWithLabel.reformerAdapter = checkboxAdapter;
// Подпись рисует сам контрол — `FormField` кита вторую сверху не даёт.
CheckboxWithLabel.reformerLayout = 'inline-label' as const;

/** Пропсы {@link SwitchWithLabel}: пропсы HexaUI `Toggle`, подпись — пропом `label`. */
export type SwitchWithLabelProps = Omit<ToggleProps, 'children'> & {
  /** Подпись рядом с переключателем. Строку HexaUI рисует своей подписью формы (`FormLabel`). */
  label?: ReactNode;
};

/** Переключатель с подписью: HexaUI `Toggle` (antd `Switch`), `onChange(checked, e)`. */
export function SwitchWithLabel({ label, ...rest }: SwitchWithLabelProps) {
  return <Toggle {...rest}>{label}</Toggle>;
}
SwitchWithLabel.reformerAdapter = switchAdapter;
SwitchWithLabel.reformerLayout = 'inline-label' as const;

/** Пропсы {@link ToggleButton}: пропсы HexaUI `ToggleButton`, значение — булево «нажата». */
export type ToggleButtonProps = Omit<HexaToggleButtonProps, 'value' | 'selected' | 'onChange'> & {
  /** Нажата ли кнопка. */
  value?: boolean;
  onChange?: (pressed: boolean) => void;
  onBlur?: FocusEventHandler;
};

/** Кнопка-переключатель: HexaUI `ToggleButton`; текст кнопки — `text`. */
export function ToggleButton({ value, onChange, onBlur, ...rest }: ToggleButtonProps) {
  return (
    <BlurScope onBlur={onBlur}>
      <HexaToggleButton
        {...rest}
        // HexaUI требует строковое значение кнопки — у одиночной кнопки оно служебное.
        value="on"
        selected={value === true}
        onChange={(_value, checked) => onChange?.(checked)}
      />
    </BlurScope>
  );
}
ToggleButton.reformerAdapter = booleanAdapter;
