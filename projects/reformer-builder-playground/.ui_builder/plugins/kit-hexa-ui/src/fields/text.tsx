/**
 * Поля ввода текста и чисел: `Input`, `Textarea`, `InputPassword`, `InputNumber`, `InputMask`,
 * `InputSearch` — имена записей те же, что у `@reformer/ui-kit`.
 *
 * Все, кроме маски, — компоненты HexaUI как есть под собственной идентичностью кита
 * ({@link fieldControl}): диалект `onChange(value)` сводит адаптер. Маске нужна обёртка: в схеме
 * она задаётся строкой `mask` (формат ui-kit), а HexaUI ждёт объект `maskOptions` IMask.
 *
 * @module reformer/kit-hexa-ui/fields/text
 */

import { useMemo } from 'react';
import type {
  SearchProps,
  TextboxMaskedProps,
  TextboxNumberProps,
  TextboxPasswordProps,
  TextboxProps,
  TextboxTextareaProps,
} from '@kaspersky/hexa-ui';
// Значения HexaUI — с подпутей: модуль входит в пространство имён билдера (см. `../palette`).
import { Textbox } from '@kaspersky/hexa-ui/input';
import { Search } from '@kaspersky/hexa-ui/search';
import { numberAdapter, textAdapter } from './adapters';
import { fieldControl } from './control';
import { imaskPattern } from './convert';

/** Пропсы {@link Input} — пропсы HexaUI `Textbox`. */
export type InputProps = TextboxProps;

/** Текстовое поле: HexaUI `Textbox`. */
export const Input = fieldControl<InputProps>(Textbox, 'Input', { reformerAdapter: textAdapter });

/** Пропсы {@link Textarea} — пропсы HexaUI `Textbox.Textarea`. */
export type TextareaProps = TextboxTextareaProps;

/** Многострочное поле: вариант составного компонента `Textbox.Textarea`. */
export const Textarea = fieldControl<TextareaProps>(Textbox.Textarea, 'Textarea', {
  reformerAdapter: textAdapter,
});

/** Пропсы {@link InputPassword} — пропсы HexaUI `Textbox.Password`. */
export type InputPasswordProps = TextboxPasswordProps;

/** Пароль: `Textbox.Password`. */
export const InputPassword = fieldControl<InputPasswordProps>(Textbox.Password, 'InputPassword', {
  reformerAdapter: textAdapter,
});

/** Пропсы {@link InputNumber} — пропсы HexaUI `Textbox.Number`. */
export type InputNumberProps = TextboxNumberProps;

/** Числовое поле: `Textbox.Number` (antd `InputNumber`). Пустое и нечисловое → `null`. */
export const InputNumber = fieldControl<InputNumberProps>(Textbox.Number, 'InputNumber', {
  reformerAdapter: numberAdapter,
});

/** Пропсы {@link InputSearch} — пропсы HexaUI `Search`. */
export type InputSearchProps = SearchProps;

/** Поле поиска: HexaUI `Search` — текстовое поле с иконкой. */
export const InputSearch = fieldControl<InputSearchProps>(Search, 'InputSearch', {
  reformerAdapter: textAdapter,
});

/** Пропсы {@link InputMask}: пропсы `Textbox.Masked` плюс маска строкой, как у ui-kit. */
export type InputMaskProps = TextboxMaskedProps & {
  /**
   * Шаблон маски: `'9'` — цифра, прочие символы — литералы. Напр. `'+7 (999) 999-99-99'`.
   * Без явного `placeholder` он же подсказка в пустом поле. `maskOptions` главнее.
   */
  mask?: string;
};

/**
 * Поле с маской: `Textbox.Masked`. Строка `mask` (формат ui-kit) переводится в шаблон IMask;
 * значение модели — строка как её показывает поле (с литералами).
 */
export function InputMask({ mask, maskOptions, placeholder, ...rest }: InputMaskProps) {
  const options = useMemo(
    () => maskOptions ?? (mask === undefined ? undefined : { mask: imaskPattern(mask) }),
    [mask, maskOptions]
  );
  return (
    <Textbox.Masked
      {...rest}
      // `IMaskInputProps` — объединение по виду маски; строковый шаблон — один из его вариантов.
      maskOptions={options as TextboxMaskedProps['maskOptions']}
      placeholder={placeholder ?? mask}
    />
  );
}
InputMask.reformerAdapter = textAdapter;
