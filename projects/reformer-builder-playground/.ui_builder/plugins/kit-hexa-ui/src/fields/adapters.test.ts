/**
 * Адаптеры полей HexaUI — на настоящей связке поля с контролом (`bindFieldProps` из
 * `@reformer/core/react`) и с теми формами эмитов, которые отдают сами компоненты HexaUI: событие
 * antd у чекбокса и радио, `(checked, e)` у переключателя, `(value, option)` у списка, пустой
 * массив мультивыбора, неполный период, `''` и `NaN` числового поля.
 *
 * Компоненты HexaUI здесь не исполняются: адаптеры — чистые данные, и их контракт проверяется
 * без браузера. Отрисовку обёрток проверяет `../fields.browser.test.tsx`.
 */

import { describe, expect, it, vi } from 'vitest';
import { bindFieldProps, type FieldAdapter } from '@reformer/core/react';
import {
  booleanAdapter,
  checkboxAdapter,
  choiceAdapter,
  dateAdapter,
  dateRangeAdapter,
  documentAdapter,
  multiValueAdapter,
  numberAdapter,
  radioAdapter,
  scheduleAdapter,
  selectAdapter,
  switchAdapter,
  textAdapter,
  timeRangeAdapter,
  WRAPPER_PROPS,
} from './adapters';
import {
  filesOf,
  hexaDateFormat,
  imaskPattern,
  isEmptyDocument,
  sameDocument,
  sameSchedule,
  scheduleOf,
  treeDataOf,
  uploadListOf,
} from './convert';

/** День расписания в формате HexaUI: 24 флага, отмечены часы `marked`. */
const hours = (...marked: number[]): number[] =>
  Array.from({ length: 24 }, (_, hour) => (marked.includes(hour) ? 1 : 0));

/** Пропсы обёртки поля — то, что схема кладёт в `componentProps` рядом с пропсами контрола. */
const WRAPPER = { label: 'Подпись', required: true, description: 'Описание', tooltip: 'Подсказка' };

/**
 * Связка поля с контролом, как её делает обёртка поля: значение модели `value`, пропсы схемы.
 * Возвращает пропсы контрола и эмит — вызов колбэка контрола с аргументами, как его зовёт HexaUI.
 */
function bind(adapter: FieldAdapter, value: unknown, componentProps: Record<string, unknown> = {}) {
  const onChange = vi.fn();
  const onBlur = vi.fn();
  const props = bindFieldProps(
    adapter,
    { value, onChange, onBlur },
    { ...WRAPPER, ...componentProps }
  );
  const emit = (...args: unknown[]): unknown => {
    const callback = props[adapter.changeProp ?? 'onChange'] as (...a: unknown[]) => void;
    callback(...args);
    return onChange.mock.lastCall?.[0];
  };
  return { props, emit, onChange, onBlur };
}

describe('текстовые поля (Textbox, Password, Textarea, Masked, Search, TimeInput)', () => {
  it('строка из onChange(value, mask) — в модель; пустая строка — null', () => {
    const { emit } = bind(textAdapter, null);

    expect(emit('Иван', { mask: '000' })).toBe('Иван');
    expect(emit('')).toBeNull();
  });

  it('null модели — пустая строка контролу: Textbox контролируемый', () => {
    expect(bind(textAdapter, null).props.value).toBe('');
    expect(bind(textAdapter, 'abc').props.value).toBe('abc');
  });

  it('пропсы обёртки поля срезаются — до DOM они не доходят; свои пропсы контрола остаются', () => {
    const { props } = bind(textAdapter, '', { placeholder: 'Имя', labelTooltip: 'ещё подсказка' });

    for (const key of [...WRAPPER_PROPS, 'labelTooltip']) expect(props).not.toHaveProperty(key);
    expect(props.placeholder).toBe('Имя');
  });

  it('blur идёт штатным каналом onBlur', () => {
    const { props, onBlur } = bind(textAdapter, '');
    (props.onBlur as () => void)();

    expect(onBlur).toHaveBeenCalledOnce();
  });
});

describe('InputNumber (Textbox.Number — antd InputNumber)', () => {
  it('число — в модель как есть, строка из stringMode — числом', () => {
    const { emit } = bind(numberAdapter, null);

    expect(emit(42)).toBe(42);
    expect(emit(0)).toBe(0);
    expect(emit('12.5')).toBe(12.5);
  });

  it("'' , NaN, null и нечисловая строка — null", () => {
    const { emit } = bind(numberAdapter, 1);

    expect(emit('')).toBeNull();
    expect(emit(Number.NaN)).toBeNull();
    expect(emit(null)).toBeNull();
    expect(emit('-')).toBeNull();
  });

  it('контролу — число либо null (пустое поле)', () => {
    expect(bind(numberAdapter, 7).props.value).toBe(7);
    expect(bind(numberAdapter, null).props.value).toBeNull();
    expect(bind(numberAdapter, 'x').props.value).toBeNull();
  });
});

describe('Select / Combobox / ComboboxTree — один выбор', () => {
  it('значение из onChange(value, option) — в модель, option отбрасывается', () => {
    const { emit } = bind(selectAdapter, null);

    expect(emit('b', { label: 'Два', value: 'b' })).toBe('b');
  });

  it('очистка (undefined) — null', () => {
    expect(bind(selectAdapter, 'b').emit(undefined)).toBeNull();
  });

  it('null модели — undefined контролу: antd показывает placeholder только у undefined', () => {
    expect(bind(selectAdapter, null).props.value).toBeUndefined();
    expect(bind(selectAdapter, 'a').props.value).toBe('a');
  });

  it("'' модели — тоже «ничего не выбрано»: с него кодоген стартует список", () => {
    // antd считает пустую строку значением и прячет placeholder — поле стояло бы пустым.
    expect(bind(selectAdapter, '').props.value).toBeUndefined();
  });
});

describe('мультивыбор (SelectMulti, ComboboxMulti, CheckboxGroup, ToggleGroupMulti, файлы)', () => {
  it('массив — копией: сигнал модели сравнивает по !==', () => {
    const emitted = ['a', 'b'];
    const stored = bind(multiValueAdapter, null).emit(emitted);

    expect(stored).toEqual(['a', 'b']);
    expect(stored).not.toBe(emitted);
  });

  it('пустой массив — null', () => {
    expect(bind(multiValueAdapter, ['a']).emit([])).toBeNull();
  });

  it('null модели — пустой массив контролу', () => {
    expect(bind(multiValueAdapter, null).props.value).toEqual([]);
  });

  it('файлы — тем же пресетом: File[] либо null', () => {
    const file = new File(['x'], 'a.txt');
    const { emit } = bind(multiValueAdapter, null);

    expect(emit([file])).toEqual([file]);
    expect(emit([])).toBeNull();
  });
});

describe('RadioGroup (HexaUI Radio — antd Radio.Group)', () => {
  it('значение из события antd e.target.value', () => {
    const event = { target: { value: 'b', checked: true }, nativeEvent: {} };

    expect(bind(radioAdapter, null).emit(event)).toBe('b');
  });

  it('строка value-based эмита тоже понимается', () => {
    expect(bind(radioAdapter, null).emit('a')).toBe('a');
  });

  it('null модели — null контролу: группа контролируемая, ничего не отмечено', () => {
    expect(bind(radioAdapter, null).props.value).toBeNull();
    expect(bind(radioAdapter, '').props.value).toBeNull();
  });
});

describe('Checkbox (CheckboxWithLabel — antd Checkbox)', () => {
  it('значение — проп checked; событие antd e.target.checked — булево модели', () => {
    const { props, emit } = bind(checkboxAdapter, null);

    expect(props.checked).toBe(false);
    expect(emit({ target: { checked: true } })).toBe(true);
    expect(emit({ target: { checked: false } })).toBe(false);
  });

  it('подпись, звёздочку и подсказку рисует сам контрол — срезается только описание', () => {
    const { props } = bind(checkboxAdapter, true);

    expect(props.checked).toBe(true);
    expect(props.label).toBe('Подпись');
    expect(props.required).toBe(true);
    expect(props.tooltip).toBe('Подсказка');
    expect(props).not.toHaveProperty('description');
  });
});

describe('Switch (SwitchWithLabel — HexaUI Toggle, antd Switch)', () => {
  it('onChange(checked, e): в модель — первый аргумент', () => {
    const { props, emit } = bind(switchAdapter, null);

    expect(props.checked).toBe(false);
    expect(emit(true, { type: 'click' })).toBe(true);
    expect(emit(false, { type: 'click' })).toBe(false);
  });

  it('подпись остаётся у контрола', () => {
    expect(bind(switchAdapter, true).props.label).toBe('Подпись');
  });
});

describe('Toggle (ToggleButton кита) и ToggleGroup', () => {
  it('кнопка-переключатель — булево', () => {
    const { props, emit } = bind(booleanAdapter, null);

    expect(props.value).toBe(false);
    expect(emit(true)).toBe(true);
  });

  it('один выбор кнопками — строка либо null', () => {
    const { props, emit } = bind(choiceAdapter, null);

    expect(props.value).toBeNull();
    expect(emit('a')).toBe('a');
    expect(emit(null)).toBeNull();
    expect(bind(choiceAdapter, '').props.value).toBeNull();
  });
});

describe('DatePicker (HexaUI Calendar — Date | null)', () => {
  it('onChange(Date, dateString): в модель — дата', () => {
    const date = new Date(2024, 0, 15);

    expect(bind(dateAdapter, null).emit(date, '15.01.2024')).toBe(date);
  });

  it('очистка и невалидная дата — null', () => {
    const { emit } = bind(dateAdapter, new Date());

    expect(emit(null, '')).toBeNull();
    expect(emit(new Date(Number.NaN))).toBeNull();
  });

  it('контролу — дата либо null', () => {
    expect(bind(dateAdapter, null).props.value).toBeNull();
  });
});

describe('DatePickerRange (HexaUI RangePicker — кортеж)', () => {
  const from = new Date(2024, 0, 1);
  const to = new Date(2024, 0, 10);

  it('полный период — копией кортежа', () => {
    const range = [from, to];
    const stored = bind(dateRangeAdapter, null).emit(range);

    expect(stored).toEqual([from, to]);
    expect(stored).not.toBe(range);
  });

  it('неполный период (первая дата выбрана, вторая нет) — null', () => {
    expect(bind(dateRangeAdapter, null).emit([from, null])).toBeNull();
    expect(bind(dateRangeAdapter, null).emit(null)).toBeNull();
  });

  it('на входе всё, что не две даты, — «период не выбран» (null)', () => {
    expect(bind(dateRangeAdapter, []).props.value).toBeNull();
    expect(bind(dateRangeAdapter, [from, to]).props.value).toEqual([from, to]);
  });
});

describe('TimeRange — пара строк', () => {
  it('полный интервал — копией; неполный — null', () => {
    const { emit } = bind(timeRangeAdapter, null);

    expect(emit(['10:00', '11:30'])).toEqual(['10:00', '11:30']);
    expect(emit(['10:00', ''])).toBeNull();
  });
});

describe('WeeklySchedule и RichTextEditor', () => {
  it('расписание (24 флага на день, как отдаёт HexaUI) — копией по дням; без единого часа — null', () => {
    const schedule = { ...scheduleOf(null), monday: hours(9, 10) };
    const stored = bind(scheduleAdapter, null).emit(schedule) as Record<string, number[]>;

    expect(stored).toEqual(schedule);
    expect(stored.monday).not.toBe(schedule.monday);
    // HexaUI отдаёт пустое расписание нулями — это «ничего не выбрано».
    expect(bind(scheduleAdapter, null).emit(scheduleOf(null))).toBeNull();
  });

  it('документ — копией массива; пустой — null', () => {
    const doc = [{ type: 'paragraph', children: [{ text: 'Привет' }] }];
    const stored = bind(documentAdapter, null).emit(doc);

    expect(stored).toEqual(doc);
    expect(stored).not.toBe(doc);
    expect(bind(documentAdapter, null).emit([])).toBeNull();
  });
});

describe('преобразования значений', () => {
  it('маска ui-kit → шаблон IMask: 9 — цифра, спецсимволы IMask экранируются', () => {
    expect(imaskPattern('+7 (999) 999-99-99')).toBe('+7 (000) 000-00-00');
    expect(imaskPattern('+7 (900) 99')).toBe('+7 (0\\0\\0) 00');
    expect(imaskPattern('a*{9}')).toBe('\\a\\*\\{0\\}');
  });

  it('формат даты date-fns → формат HexaUI', () => {
    expect(hexaDateFormat('dd.MM.yyyy')).toBe('DD.MM.YYYY');
    expect(hexaDateFormat('yyyy-MM-dd')).toBe('YYYY-MM-DD');
  });

  it('узлы ui-kit → treeData antd: ветки при leaf не выбираются, при all — выбираются', () => {
    const nodes = [
      { id: 'docs', label: 'Документы', children: [{ id: 'a', label: 'a.txt' }] },
      { id: 'b', label: 'b.txt', disabled: true },
      { id: 'empty', label: 'Пустая папка', kind: 'branch' as const },
    ];

    expect(treeDataOf(nodes)).toEqual([
      {
        value: 'docs',
        title: 'Документы',
        selectable: false,
        children: [{ value: 'a', title: 'a.txt' }],
      },
      { value: 'b', title: 'b.txt', disabled: true },
      { value: 'empty', title: 'Пустая папка', selectable: false },
    ]);
    expect(treeDataOf(nodes, 'all')[0]).not.toHaveProperty('selectable');
  });

  it('файлы ↔ список Uploader: uid файла сохраняется, свой — стабилен', () => {
    const own = Object.assign(new File(['1'], 'own.txt'), { uid: 'rc-1' });
    const plain = new File(['22'], 'plain.txt');
    const uidOf = vi.fn(() => 'gen-1');

    const list = uploadListOf([own, plain], uidOf);

    expect(list.map((item) => [item.uid, item.name, item.size])).toEqual([
      ['rc-1', 'own.txt', 1],
      ['gen-1', 'plain.txt', 2],
    ]);
    expect(filesOf(list)).toEqual([own, plain]);
    expect(filesOf([{ uid: 'x', name: 'x', size: 0 }])).toEqual([]);
  });

  it('расписание: все семь дней по 24 флага, сравнение по отмеченным часам', () => {
    const empty = hours();
    const full = scheduleOf({ monday: hours(9) });

    expect(Object.keys(full)).toEqual([
      'monday',
      'tuesday',
      'wednesday',
      'thursday',
      'friday',
      'saturday',
      'sunday',
    ]);
    expect(full.monday).toEqual(hours(9));
    // День не из 24 флагов HexaUI читает пустым — так же и обёртка.
    expect(full.tuesday).toEqual(empty);
    expect(scheduleOf({ monday: [1, 1] }).monday).toEqual(empty);
    expect(sameSchedule({ monday: hours(9) }, { monday: hours(9), friday: empty })).toBe(true);
    expect(sameSchedule(null, scheduleOf(null))).toBe(true);
    expect(sameSchedule({ monday: hours(9) }, null)).toBe(false);
  });

  it('документ редактора: пустой абзац — пусто; тот же документ — по узлам', () => {
    const paragraph = { type: 'paragraph', children: [{ text: '' }] };
    const filled = { type: 'paragraph', children: [{ text: 'x' }] };

    expect(isEmptyDocument([paragraph])).toBe(true);
    expect(isEmptyDocument([filled])).toBe(false);
    expect(sameDocument([filled], [filled])).toBe(true);
    expect(sameDocument([filled], [{ ...filled }])).toBe(false);
    expect(sameDocument(null, [paragraph])).toBe(true);
  });
});
