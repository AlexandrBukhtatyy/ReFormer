/**
 * Виджеты RJSF из полей кита — мостом через адаптер поля.
 *
 * Поле кита уже умеет жить в форме: контрол объявляет свой диалект статикой `reformerAdapter`
 * (`checked`/`onCheckedChange`, событие вместо значения…), и `bindFieldProps` из `@reformer/core`
 * сводит его к value-based seam. RJSF отдаёт виджету ровно такой seam — `value`, `onChange(value)`,
 * `onBlur(id, value)`. Мост поэтому один на все поля: ни одного виджета под конкретный компонент.
 *
 * Что мост досказывает сам, потому что у RJSF и полей кита разные соглашения:
 *
 * - варианты выбора RJSF (`enumOptions`) приходят контролу пропом `options` в форме
 *   `{ value, label }` (соглашение полей выбора ReFormer) — и только контролу, который объявил
 *   `options` в каталоге. Значения вариантов контрол видит строками, а RJSF получает назад
 *   исходные: иначе числовой вариант вернулся бы строкой и не прошёл бы проверку схемы;
 * - дата RJSF — строка `YYYY-MM-DD`, поле даты кита — `Date`;
 * - границы и шаг числа (`minimum`, `maximum`, `multipleOf`) — пропсами `min`, `max`, `step`;
 * - контрол, подписывающий себя сам (`reformerLayout: 'inline-label'`), получает подпись пропом
 *   `label`: верхнюю подпись рамка поля для него не рисует;
 * - `readonly` RJSF — это `disabled` контрола: у выбора и флажков «только чтения» нет;
 * - пустой ввод (`''`, `null`) — это «значения нет» (`options.emptyValue`): так обязательное
 *   поле остаётся незаполненным, а не заполненным пустой строкой.
 *
 * @module @reformer/rjsf-kit-theme/widgets
 */

import { createElement, type ComponentType } from 'react';
import { bindFieldProps, getFieldAdapter } from '@reformer/core';
import { rangeSpec, type EnumOptionsType, type Widget, type WidgetProps } from '@rjsf/utils';

/** Запись каталога, которой можно заменить виджет RJSF. */
export interface KitWidgetCandidate {
  /** Имя записи каталога. */
  readonly component: string;
  /** Пропсы, без которых запись в этой роли не годится (`Input` под паролем — `type: 'password'`). */
  readonly props?: Readonly<Record<string, unknown>>;
}

/**
 * Виджет RJSF → записи каталога, которые его заменяют, по убыванию предпочтения. Сопоставление
 * по имени записи, а не экспорта: имя записи — общее у китов (`Checkbox`), экспорт — нет.
 */
export const DEFAULT_WIDGET_CANDIDATES: Readonly<Record<string, readonly KitWidgetCandidate[]>> =
  Object.freeze({
    TextWidget: [{ component: 'Input' }],
    PasswordWidget: [
      { component: 'InputPassword' },
      { component: 'Input', props: { type: 'password' } },
    ],
    TextareaWidget: [{ component: 'Textarea' }],
    CheckboxWidget: [{ component: 'Checkbox' }, { component: 'Switch' }],
    SelectWidget: [{ component: 'Select' }, { component: 'NativeSelect' }],
    RadioWidget: [{ component: 'RadioGroup' }],
    RangeWidget: [{ component: 'Slider' }],
    UpDownWidget: [{ component: 'InputNumber' }],
    DateWidget: [{ component: 'DatePicker' }],
  });

/** Контрол подписывает себя сам (чекбокс, переключатель) — маркер полей ReFormer. */
export function isInlineLabel(component: unknown): boolean {
  return (component as { reformerLayout?: string } | null)?.reformerLayout === 'inline-label';
}

/** Похоже ли значение на React-компонент: функция, класс или объект `memo`/`forwardRef`. */
export function isComponent(value: unknown): value is ComponentType<Record<string, unknown>> {
  return (
    typeof value === 'function' ||
    (typeof value === 'object' && value !== null && '$$typeof' in value)
  );
}

/** Перевод значения между RJSF и контролом кита — для виджетов с разными соглашениями. */
interface ValueCodec {
  /** Значение RJSF → значение контрола. */
  readonly toControl: (value: unknown) => unknown;
  /** Значение контрола → значение RJSF. */
  readonly fromControl: (value: unknown) => unknown;
}

const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})$/;
const pad = (value: number) => String(value).padStart(2, '0');

/** Дата RJSF (`format: date`) — строка `YYYY-MM-DD`; поле даты кита — `Date` в местном времени. */
const dateCodec: ValueCodec = {
  toControl: (value) => {
    const match = typeof value === 'string' ? ISO_DATE.exec(value) : null;
    return match === null ? value : new Date(+match[1], +match[2] - 1, +match[3]);
  },
  fromControl: (value) =>
    value instanceof Date && !Number.isNaN(value.getTime())
      ? `${value.getFullYear()}-${pad(value.getMonth() + 1)}-${pad(value.getDate())}`
      : value,
};

/** Границы и шаг числа из схемы поля. */
function rangeProps({ schema }: WidgetProps): Record<string, unknown> {
  const { min, max, step } = rangeSpec(schema);
  return {
    ...(min !== undefined ? { min } : {}),
    ...(max !== undefined ? { max } : {}),
    ...(step !== undefined ? { step } : {}),
  };
}

/** Что виджет RJSF добавляет к мосту: перевод значения и пропсы из схемы. */
interface SlotBridge {
  readonly codec?: ValueCodec;
  readonly props?: (props: WidgetProps) => Record<string, unknown>;
}

const SLOT_BRIDGES: Readonly<Record<string, SlotBridge>> = {
  DateWidget: { codec: dateCodec },
  RangeWidget: { props: rangeProps },
  UpDownWidget: { props: rangeProps },
  TextareaWidget: {
    props: ({ options }) => (typeof options.rows === 'number' ? { rows: options.rows } : {}),
  },
};

/** Варианты выбора со строковыми ключами: контрол видит ключи, RJSF — исходные значения. */
function keyedOptions(enumOptions: readonly EnumOptionsType[]) {
  const byKey = new Map(enumOptions.map((option) => [String(option.value), option.value]));
  const toKey = (value: unknown): unknown =>
    value === undefined || value === null
      ? value
      : Array.isArray(value)
        ? value.map((item) => String(item))
        : String(value);
  const fromKey = (value: unknown): unknown =>
    Array.isArray(value)
      ? value.map(fromKey)
      : (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') &&
          byKey.has(String(value))
        ? byKey.get(String(value))
        : value;
  return {
    options: enumOptions.map((option) => ({ value: String(option.value), label: option.label })),
    toKey,
    fromKey,
  };
}

export interface KitWidgetOptions {
  /** Имя для отладчика React — запись каталога или виджет RJSF. */
  readonly name: string;
  /** Виджет RJSF, который заменяет контрол: от него зависит перевод значения и пропсы схемы. */
  readonly slot?: string;
  /**
   * Контрол принимает варианты пропом `options` — по каталогу кита. Не известно — варианты
   * получает всё, кроме флажка (RJSF строит варианты и для `boolean`, а флажку они не нужны).
   */
  readonly acceptsOptions?: boolean;
  /** Постоянные пропсы роли (`type: 'password'`). */
  readonly props?: Readonly<Record<string, unknown>>;
}

/** Пустой ввод — «значения нет»: так RJSF отличает незаполненное обязательное поле. */
function emptyToValue(next: unknown, emptyValue: unknown): unknown {
  return next === '' || next === null ? emptyValue : next;
}

/** Виджет RJSF, который рисует поле кита. */
export function kitWidget(
  Control: ComponentType<Record<string, unknown>>,
  { name, slot, acceptsOptions, props: fixed }: KitWidgetOptions
): Widget {
  const adapter = getFieldAdapter(Control);
  const inline = isInlineLabel(Control);
  const bridge: SlotBridge = (slot !== undefined ? SLOT_BRIDGES[slot] : undefined) ?? {};

  function KitWidget(props: WidgetProps) {
    const {
      id,
      name: fieldName,
      value,
      onChange,
      onBlur,
      disabled,
      readonly,
      placeholder,
      required,
      autofocus,
      options,
      label,
      hideLabel,
      rawErrors,
      schema,
    } = props;
    const choice = acceptsOptions ?? schema.type !== 'boolean';
    const keyed =
      choice && options.enumOptions !== undefined ? keyedOptions(options.enumOptions) : undefined;
    const toControl = (current: unknown) => {
      const decoded = bridge.codec ? bridge.codec.toControl(current) : current;
      return keyed ? keyed.toKey(decoded) : decoded;
    };
    const fromControl = (next: unknown) => {
      const unkeyed = keyed ? keyed.fromKey(next) : next;
      return bridge.codec ? bridge.codec.fromControl(unkeyed) : unkeyed;
    };
    const bound = bindFieldProps(
      adapter,
      {
        value: toControl(value),
        onChange: (next) => onChange(emptyToValue(fromControl(next), options.emptyValue)),
        onBlur: () => onBlur(id, value),
      },
      {
        ...fixed,
        ...bridge.props?.(props),
        id,
        'data-testid': `input-${fieldName}`,
        ...(disabled === true || readonly === true ? { disabled: true } : {}),
        ...(placeholder ? { placeholder } : {}),
        ...(required === true ? { required: true } : {}),
        ...(autofocus === true ? { autoFocus: true } : {}),
        ...(rawErrors !== undefined && rawErrors.length > 0 ? { 'aria-invalid': true } : {}),
        ...(keyed !== undefined ? { options: keyed.options } : {}),
        ...(inline && hideLabel !== true ? { label } : {}),
      }
    );
    return createElement(Control, bound);
  }
  KitWidget.displayName = `KitWidget(${name})`;
  return KitWidget;
}
