/**
 * Поля HexaUI для формы ReFormer — тем же способом, что в `@reformer/ui-kit`: без per-control
 * «field-обёрток». Контрол объявляет свой диалект статикой `reformerAdapter` ({@link FieldAdapter}
 * из `@reformer/core`), а связывает его с формой обёртка поля — `FormField.Control` из
 * `@reformer/cdk` (путь `<FormField control>`) или рендерер `@reformer/renderer-react`.
 *
 * ## Почему статика висит не на самих компонентах HexaUI
 *
 * `Textbox`, `Select`, `Textbox.Password` — объекты ЧУЖОГО модуля. Повесить на них
 * `reformerAdapter` — значит мутировать `@kaspersky/hexa-ui` для всего приложения: каждый, кто
 * импортирует тот же `Textbox` вне формы, получит скрытую статику, а два кита с разными адаптерами
 * к одному компоненту перетирали бы друг друга (побеждает последний импорт). `resolveFieldAdapter`
 * рендерера эту мутацию не заменяет: путь `<FormField control>` из cdk читает ТОЛЬКО статику.
 *
 * Поэтому каждое поле — собственная идентичность кита ({@link fieldControl}): функция, которая
 * рендерит компонент HexaUI с теми же пропсами, без логики. Статика вешается на неё.
 *
 * ## Что делает адаптер вместо прежних обёрток
 *
 * - `strip` — снимает пропсы обёртки поля (`label`/`required`/`description`/`tooltip`; `labelTooltip`
 *   срезает сам `bindFieldProps`). Их рисует `FormField` кита (HexaUI `Field`), а без среза HexaUI
 *   прокинул бы их в DOM: `<input label="Сумма">` — строковые атрибуты React не фильтрует.
 * - Лишние аргументы колбэков (`Textbox` отдаёт `(value, mask)`, `Select` — `(value, option)`)
 *   снимать не нужно: адаптер получает только первый аргумент эмита.
 * - `toValue` — коэрсия `null` → `''` у текстовых полей (HexaUI `Textbox` контролируемый).
 * - Служебный `control` рендерер контролу больше не передаёт (нет `passControl`).
 *
 * Имена экспортов — канонические, как у `@reformer/ui-kit` (`Input`, `Textarea`, `InputPassword`,
 * `InputNumber`, `CheckboxWithLabel`, `Select`): каталог кита связывает имя записи с экспортом
 * через `exportName`, и одна и та же схема формы рендерится на обоих китах.
 *
 * @module reformer/kit-hexa-ui/fields
 */

import { createElement } from 'react';
import type { ComponentType, ReactNode } from 'react';
import { Checkbox as HexaCheckbox, Select as HexaSelect, Textbox } from '@kaspersky/hexa-ui';
import type { FieldAdapter } from '@reformer/core';

/* eslint-disable @typescript-eslint/no-explicit-any */

/** Раскладка в `FormField` кита: `inline-label` — контрол сам рисует подпись рядом с собой. */
export type FieldControlLayout = 'inline-label';

/** Статики поля, которые читают обёртка поля (`reformerAdapter`) и `FormField` кита (`reformerLayout`). */
export interface FieldControlStatics {
  reformerAdapter?: FieldAdapter;
  reformerLayout?: FieldControlLayout;
}

/**
 * Пропсы, адресованные обёртке поля, а не контролу: их рисует `FormField` кита (HexaUI `Field`).
 * `labelTooltip` здесь нет — его срезает `bindFieldProps` из `@reformer/core` у любого контрола.
 */
const WRAPPER_PROPS = ['label', 'required', 'description', 'tooltip'];

/**
 * Собственная идентичность кита для компонента HexaUI: рендерит его с теми же пропсами (без
 * логики) и несёт статики формы. Нужна ровно затем, чтобы не мутировать чужой модуль (см. шапку).
 */
function fieldControl<P>(
  component: ComponentType<P>,
  displayName: string,
  statics: FieldControlStatics
): ComponentType<P> & FieldControlStatics {
  const Control = (props: P) => createElement(component as ComponentType<any>, props as any);
  Control.displayName = displayName;
  return Object.assign(Control, statics) as ComponentType<P> & FieldControlStatics;
}

/** Текстовые поля HexaUI: value-based `onChange(value)`, контролируемый `value` — без `null`. */
const textAdapter: FieldAdapter = { toValue: (v) => v ?? '', strip: WRAPPER_PROPS };

/** Число и выбор: value-based `onChange(value)`, значение как есть. */
const valueAdapter: FieldAdapter = { strip: WRAPPER_PROPS };

/** Текстовое поле: HexaUI `Textbox`. */
export const Input = fieldControl(Textbox, 'Input', { reformerAdapter: textAdapter });

/** Многострочное поле: вариант compound-компонента `Textbox.Textarea`. */
export const Textarea = fieldControl(Textbox.Textarea, 'Textarea', {
  reformerAdapter: textAdapter,
});

/** Пароль: `Textbox.Password`. */
export const InputPassword = fieldControl(Textbox.Password, 'InputPassword', {
  reformerAdapter: textAdapter,
});

/** Числовое поле: `Textbox.Number`. */
export const InputNumber = fieldControl(Textbox.Number, 'InputNumber', {
  reformerAdapter: valueAdapter,
});

/** Выпадающий список: `Select` (`onChange(value, option)` — адаптер берёт только `value`). */
export const Select = fieldControl(HexaSelect, 'Select', { reformerAdapter: valueAdapter });

/** Пропсы {@link CheckboxWithLabel}: пропсы HexaUI `Checkbox` плюс подпись. */
export interface CheckboxWithLabelProps {
  label?: ReactNode;
  [key: string]: unknown;
}

/**
 * Чекбокс с подписью. Единственное поле, которому нужен свой компонент, а не только адаптер:
 * HexaUI `Checkbox` рисует подпись из `children`, а приходит она пропом `label` — переименовать
 * проп в `children` адаптер не умеет (он переименовывает только value-проп). Прежняя обёртка
 * `label` просто срезала, а `FormField` для inline-контрола верхнюю подпись подавляет — подписи
 * не было вовсе.
 *
 * `required`/`tooltip` HexaUI `Checkbox` рисует сам у своей подписи — поэтому их адаптер НЕ
 * срезает (у inline-контрола верхней подписи со звёздочкой нет). `description` рисует `Field`.
 */
export function CheckboxWithLabel({ label, ...rest }: CheckboxWithLabelProps) {
  return createElement(HexaCheckbox as ComponentType<any>, rest, label);
}
CheckboxWithLabel.reformerAdapter = {
  valueProp: 'checked',
  // antd-чекбокс эмитит событие (`e.target.checked`); булево — на случай value-based эмита.
  fromEmit: (next: unknown) =>
    typeof next === 'boolean'
      ? next
      : Boolean((next as { target?: { checked?: boolean } } | null)?.target?.checked),
  toValue: (v: unknown) => Boolean(v),
  strip: ['description'],
} satisfies FieldAdapter;
// Подпись рисует сам контрол — `FormField` кита вторую сверху не даёт.
CheckboxWithLabel.reformerLayout = 'inline-label' as const;
