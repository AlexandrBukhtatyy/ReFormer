/**
 * Адаптеры полей HexaUI — чистые данные ({@link FieldAdapter} из `@reformer/core`), без React.
 *
 * Адаптер описывает, как value-based шов формы (`value` + `onChange(value)` + `onBlur`) ложится на
 * контракт контрола. Здесь их несколько, потому что у HexaUI нет единого `onChange`: текстовые
 * поля отдают строку, antd-чекбокс и радио — событие, `Toggle` — `(checked, e)`, мультивыбор —
 * массив, календарь — `(Date | null, string)`. Обёртка поля (`FormField.Control` из cdk или
 * рендерер) зовёт `changeProp` контрола и прогоняет его ПЕРВЫЙ аргумент через `fromEmit`.
 *
 * ## Контракт значений модели
 *
 * Тот же, что у `@reformer/ui-kit` (`packages/reformer-ui-kit/src/fields/adapters.ts`): «пусто» у
 * поля одно — `null`. На входе «ничего не выбрано» у списков — и `null`, и `''`: с пустой строки
 * кодоген билдера стартует список без выбора по умолчанию (мок модели), и `Select` ui-kit её так
 * и читает. Пустая строка, пустой выбор, неполный период, `NaN` из числового поля
 * сворачиваются в `null`, а `required()` ловит его у любого поля. На входе `toValue` отдаёт
 * контролу то, что тот умеет показать: `''` текстовому, `[]` мультивыбору, `undefined` выпадающему
 * списку (иначе antd не покажет placeholder).
 *
 * Массивы `fromEmit` копирует: сигнал модели сравнивает по `!==`, и контрол, вернувший
 * мутированный на месте массив, подписчиков бы не уведомил.
 *
 * ## Что адаптер срезает
 *
 * `strip` — пропсы обёртки поля (`label`/`required`/`description`/`tooltip`): их рисует `FormField`
 * кита (HexaUI `Field`), а без среза HexaUI прокинул бы их в DOM (`<input label="Сумма">`).
 * `labelTooltip` срезает сам `bindFieldProps`. Контролы с подписью рядом с собой (`Checkbox`,
 * `Toggle`) подпись, звёздочку и подсказку рисуют сами — у них срезается только `description`.
 *
 * Модуль тестируется в node (`./adapters.test.ts`): `bindFieldProps` на каждый адаптер с
 * настоящими формами эмитов.
 *
 * @module reformer/kit-hexa-ui/fields/adapters
 */

import type { FieldAdapter } from '@reformer/core/react';
import { isDateRange, isNonEmptySchedule, isSchedule, isStringPair } from './convert';

/** Адаптер с явно заданными ключами — чтобы его можно было вызывать напрямую (тесты, композиция). */
export interface KitFieldAdapter extends FieldAdapter {
  valueProp: string;
  changeProp: string;
  fromEmit: (arg: unknown, rest: Record<string, unknown>) => unknown;
  toValue: (value: unknown) => unknown;
  strip: string[];
}

/**
 * Пропсы, адресованные обёртке поля, а не контролу: их рисует `FormField` кита (HexaUI `Field`).
 * `labelTooltip` здесь нет — его срезает `bindFieldProps` из `@reformer/core/react` у любого контрола.
 */
export const WRAPPER_PROPS: readonly string[] = Object.freeze([
  'label',
  'required',
  'description',
  'tooltip',
]);

/** Адаптер value-based контрола: `value` + `onChange(value)`, срез пропсов обёртки поля. */
function valueBased(
  fromEmit: KitFieldAdapter['fromEmit'],
  toValue: KitFieldAdapter['toValue']
): KitFieldAdapter {
  return {
    valueProp: 'value',
    changeProp: 'onChange',
    fromEmit,
    toValue,
    strip: [...WRAPPER_PROPS],
  };
}

/** Непустая строка либо `null`. */
const textOrNull = (value: unknown): string | null =>
  typeof value === 'string' && value !== '' ? value : null;

/**
 * Текстовые поля: `Textbox`, `.Password`, `.Textarea`, `.Masked`, `Search`, `TimeInput` —
 * `onChange(text, mask?)`. Пустой текст → `null`; на входе `null` → `''` (поле контролируемое).
 */
export const textAdapter: KitFieldAdapter = valueBased(textOrNull, (v) =>
  typeof v === 'string' ? v : ''
);

/**
 * Число: `Textbox.Number` (antd `InputNumber`) — `onChange(number | string | null)`. Строку
 * (режим `stringMode`, промежуточный ввод) читаем числом; `''`, `NaN` и всё нечисловое → `null`.
 */
export const numberAdapter: KitFieldAdapter = valueBased(
  (v) => {
    const number = typeof v === 'string' && v.trim() !== '' ? Number(v) : v;
    return typeof number === 'number' && Number.isFinite(number) ? number : null;
  },
  (v) => (typeof v === 'number' && Number.isFinite(v) ? v : null)
);

/**
 * Выпадающий список с одним значением: `Select` (`onChange(value, option)`), `TreeSelect`
 * (`onChange(value, labels, extra)`). Очистка отдаёт `undefined` → `null`. На входе `null` и `''`
 * → `undefined`: antd показывает placeholder только у `undefined`, а пустую строку считает
 * выбранным значением — поле без выбора стояло бы пустым, без подсказки.
 */
export const selectAdapter: KitFieldAdapter = valueBased(
  (v) => (v === undefined || v === null || v === '' ? null : v),
  (v) => (v === undefined || v === null || v === '' ? undefined : v)
);

/**
 * Мультивыбор: `SelectMulti`, `ComboboxMulti`, `ComboboxTreeMulti`, `CheckboxGroup`,
 * `ToggleGroupMulti`, `ToggleButtonGroup` — `onChange(string[])`; тот же пресет у файлов
 * (`File[]`). Пустой выбор → `null` (поле-массив сохранит его как `[]`); на входе — массив.
 */
export const multiValueAdapter: KitFieldAdapter = valueBased(
  (v) => (Array.isArray(v) && v.length > 0 ? [...(v as unknown[])] : null),
  (v) => (Array.isArray(v) ? v : [])
);

/**
 * Выбор одного из вариантов обёрткой кита (`ToggleGroup`): обёртка уже отдаёт `string | null`,
 * адаптер только нормализует пустое.
 */
export const choiceAdapter: KitFieldAdapter = valueBased(textOrNull, textOrNull);

/**
 * Радиогруппа: HexaUI `Radio` — это antd `Radio.Group`, `onChange(e)` с `e.target.value`.
 * Строка — на случай value-based эмита. На входе `null` (и `''` списка без выбора) — `null`:
 * группа контролируемая, просто ни один вариант не отмечен.
 */
export const radioAdapter: KitFieldAdapter = valueBased(
  (e) => {
    const value =
      typeof e === 'string' ? e : (e as { target?: { value?: unknown } } | null)?.target?.value;
    return value === undefined || value === null || value === '' ? null : value;
  },
  (v) => (v === undefined || v === '' ? null : v)
);

/**
 * Чекбокс с подписью: antd-чекбокс, `onChange(e)` с `e.target.checked`; булево — на случай
 * value-based эмита. Подпись, звёздочку и подсказку контрол рисует сам — срезается только описание.
 */
export const checkboxAdapter: KitFieldAdapter = {
  valueProp: 'checked',
  changeProp: 'onChange',
  fromEmit: (e) =>
    typeof e === 'boolean'
      ? e
      : (e as { target?: { checked?: unknown } } | null)?.target?.checked === true,
  toValue: (v) => v === true,
  strip: ['description'],
};

/**
 * Переключатель с подписью: HexaUI `Toggle` (antd `Switch`) — `onChange(checked, e)`; адаптер
 * получает первый аргумент. Подпись — как у чекбокса.
 */
export const switchAdapter: KitFieldAdapter = {
  valueProp: 'checked',
  changeProp: 'onChange',
  fromEmit: (checked) => checked === true,
  toValue: (v) => v === true,
  strip: ['description'],
};

/** Кнопка-переключатель (`ToggleButton` кита): обёртка отдаёт булево. */
export const booleanAdapter: KitFieldAdapter = valueBased(
  (v) => v === true,
  (v) => v === true
);

/** Дата: HexaUI `Calendar` — `onChange(Date | null, string)`. Невалидная дата → `null`. */
export const dateAdapter: KitFieldAdapter = valueBased(
  (d) => (d instanceof Date && !Number.isNaN(d.getTime()) ? d : null),
  (v) => (v instanceof Date ? v : null)
);

/**
 * Период: HexaUI `RangePicker` — `onChange([Date | null, Date | null] | null)`. Неполный период →
 * `null`. Значение — кортеж (как у ui-kit): массив, к которому схема привязала компонент, ядро
 * делает полем при любом начальном значении.
 */
export const dateRangeAdapter: KitFieldAdapter = valueBased(
  (range) => (isDateRange(range) ? [range[0], range[1]] : null),
  (v) => (isDateRange(v) ? v : null)
);

/** Интервал времени (`TimeRange` кита): обёртка отдаёт пару строк либо `null`. */
export const timeRangeAdapter: KitFieldAdapter = valueBased(
  (range) => (isStringPair(range) ? [range[0], range[1]] : null),
  (v) => (isStringPair(v) ? v : null)
);

/**
 * Недельное расписание: `Record<день, 24 флага часов>`. Без единого отмеченного часа → `null`.
 * Копия — по дням: сигнал модели сравнивает по `!==`.
 */
export const scheduleAdapter: KitFieldAdapter = valueBased(
  (schedule) =>
    isNonEmptySchedule(schedule)
      ? Object.fromEntries(Object.entries(schedule).map(([day, hours]) => [day, [...hours]]))
      : null,
  (v) => (isSchedule(v) ? v : null)
);

/**
 * Документ редактора (`RichTextEditor` кита): обёртка отдаёт узлы slate либо `null` (пустой
 * документ). Массив копируется.
 */
export const documentAdapter: KitFieldAdapter = valueBased(
  (v) => (Array.isArray(v) && v.length > 0 ? [...(v as unknown[])] : null),
  (v) => (Array.isArray(v) ? v : null)
);
