/**
 * Поля кита в настоящем Chromium под React 19 — тем путём, каким их рисует билдер: схема формы
 * `createForm`, рендерер `FormRenderer`, обёртка поля кита `FormField`, провайдер кита.
 *
 * Здесь проверяется то, что не видно из адаптеров в node: что компонент HexaUI вообще монтируется
 * под React 19, что обёртки сводят его эмиты к значению модели (интервал времени, файлы), что
 * неуправляемые контролы пересоздаются на внешнее значение и только на него (расписание), что
 * подпись чекбокса и переключателя рисует сам контрол, и что всплывающие окна остаются внутри
 * рамки кита.
 */

import { describe, expect, it, vi } from 'vitest';
import { userEvent } from 'vitest/browser';
import { createForm, type FormModel, type FormSchemaNode } from '@reformer/core';
import { FormRenderer } from '@reformer/renderer-react';
import { renderReact } from '../../../.shared/render';
import { FormField } from '../form-field';
import { KitProvider } from '../provider';
import * as fields from './index';

/* eslint-disable @typescript-eslint/no-explicit-any */

type Values = Record<string, any>;

/** Форма из полей на корневом `div`: каждое поле — `{ model, component, componentProps }`. */
function mount(
  initial: Values,
  children: (model: FormModel<Values>) => FormSchemaNode[]
): { bundle: ReturnType<typeof createForm<Values>>; container: HTMLElement } {
  const bundle = createForm<Values>({
    initial,
    schema: (model) => ({ component: 'div', children: children(model) }) as FormSchemaNode,
  });
  const { container } = renderReact(
    <KitProvider>
      <FormRenderer form={bundle} settings={{ fieldWrapper: FormField as any }} />
    </KitProvider>
  );
  return { bundle, container };
}

/** Узел поля схемы: значение по ключу модели, `testId` — тот же ключ. */
const field = (
  model: FormModel<Values>,
  key: string,
  component: unknown,
  componentProps: Values = {}
): FormSchemaNode =>
  ({
    model: (model.$ as any)[key],
    component,
    componentProps: { testId: key, ...componentProps },
  }) as FormSchemaNode;

/** Контейнер поля — HexaUI `Field` с `testId` обёртки. */
async function fieldBox(container: HTMLElement, key: string): Promise<HTMLElement> {
  return vi.waitFor(() => {
    const box = container.querySelector<HTMLElement>(`[data-testid="field-${key}"]`);
    if (box === null) throw new Error(`нет поля ${key}`);
    return box;
  });
}

/** Значение поля модели. */
const valueOf = (bundle: { form: any }, key: string): unknown => bundle.form[key].getValue();

/** День расписания в формате HexaUI: 24 флага, отмечены часы `marked`. */
const hours = (...marked: number[]): number[] =>
  Array.from({ length: 24 }, (_, hour) => (marked.includes(hour) ? 1 : 0));

/** Все поля кита: запись → компонент, начальное значение и пропсы схемы. */
const ALL_FIELDS: [string, unknown, unknown, Values?][] = [
  ['Input', fields.Input, null],
  ['Textarea', fields.Textarea, null],
  ['InputPassword', fields.InputPassword, null],
  ['InputNumber', fields.InputNumber, null],
  ['InputMask', fields.InputMask, null, { mask: '+7 (999) 999-99-99' }],
  ['InputSearch', fields.InputSearch, null],
  ['Select', fields.Select, null, { options: [{ label: 'Один', value: 'a' }] }],
  ['SelectMulti', fields.SelectMulti, null, { options: [{ label: 'Один', value: 'a' }] }],
  ['Combobox', fields.Combobox, null, { options: [{ label: 'Один', value: 'a' }] }],
  ['ComboboxMulti', fields.ComboboxMulti, null, { options: [{ label: 'Один', value: 'a' }] }],
  ['ComboboxTree', fields.ComboboxTree, null, { nodes: [{ id: 'a', label: 'A' }] }],
  ['ComboboxTreeMulti', fields.ComboboxTreeMulti, null, { nodes: [{ id: 'a', label: 'A' }] }],
  ['Checkbox', fields.CheckboxWithLabel, false, { label: 'Согласен' }],
  ['CheckboxGroup', fields.CheckboxGroup, null, { options: [{ label: 'Один', value: 'a' }] }],
  ['RadioGroup', fields.RadioGroup, null, { options: [{ label: 'Один', value: 'a' }] }],
  ['Switch', fields.SwitchWithLabel, false, { label: 'Уведомления' }],
  ['Toggle', fields.ToggleButton, false, { text: 'Важное' }],
  ['ToggleGroup', fields.ToggleGroup, null, { options: [{ label: 'Один', value: 'a' }] }],
  ['ToggleGroupMulti', fields.ToggleGroupMulti, null, { options: [{ label: 'Один', value: 'a' }] }],
  ['ToggleButtonGroup', fields.ToggleButtonGroup, null, { items: [{ value: 'a', text: 'A' }] }],
  ['DatePicker', fields.DatePicker, null, { dateFormat: 'dd.MM.yyyy' }],
  ['DatePickerRange', fields.DatePickerRange, null],
  ['TimeInput', fields.TimeInput, null],
  ['TimeRange', fields.TimeRange, null],
  ['FileUpload', fields.FileUpload, null],
  ['FileUploadDropzone', fields.FileUploadDropzone, null, { hint: 'До 5 МБ' }],
  ['WeeklySchedule', fields.WeeklySchedule, null],
  ['RichTextEditor', fields.RichTextEditor, null],
  ['CodeEditor', fields.CodeEditor, null],
];

describe('поля кита под React 19', () => {
  it('каждый экспорт полей — поле: несёт адаптер формы', () => {
    const exported = Object.entries(fields);

    expect(exported.length).toBe(ALL_FIELDS.length);
    expect(
      exported.filter(
        ([, value]) => (value as { reformerAdapter?: unknown }).reformerAdapter === undefined
      )
    ).toEqual([]);
  });

  it('все поля монтируются в одной форме без ошибок React', async () => {
    const errors: unknown[] = [];
    const spy = vi.spyOn(console, 'error').mockImplementation((...args: unknown[]) => {
      // Предупреждения React о DOM-атрибутах HexaUI (`$themedColor`, `ref` у элемента) — шум
      // старой библиотеки, а не падение; падение рендера приходит исключением.
      if (args.some((arg) => arg instanceof Error)) errors.push(args[0]);
    });
    const initial = Object.fromEntries(ALL_FIELDS.map(([key, , value]) => [key, value]));
    const { container } = mount(initial, (model) =>
      ALL_FIELDS.map(([key, component, , props]) => field(model, key, component, props))
    );

    for (const [key] of ALL_FIELDS) await fieldBox(container, key);
    // Ленивые движки (редакторы, календари) догружаются — и тоже без ошибок. Первый прогон
    // грузит их с холодного кэша Vite: мегабайты, отсюда запас по времени.
    await vi.waitFor(
      () => {
        expect(container.querySelector('[data-slate-editor]')).not.toBeNull();
        expect(container.querySelector('.cm-editor')).not.toBeNull();
        expect(container.querySelectorAll('.ant-picker')).toHaveLength(2);
      },
      { timeout: 15_000 }
    );
    spy.mockRestore();

    expect(errors).toEqual([]);
  });
});

describe('текст и число', () => {
  it('ввод — в модель; стёртый текст — null', async () => {
    const { bundle, container } = mount({ name: null }, (model) => [
      field(model, 'name', fields.Input, { label: 'Имя' }),
    ]);
    const input = (await fieldBox(container, 'name')).querySelector('input')!;

    await userEvent.type(input, 'Иван');
    expect(valueOf(bundle, 'name')).toBe('Иван');

    await userEvent.clear(input);
    expect(valueOf(bundle, 'name')).toBeNull();
  });

  it('число: пустое поле без «null», ввод — числом', async () => {
    const { bundle, container } = mount({ amount: null }, (model) => [
      field(model, 'amount', fields.InputNumber, { label: 'Сумма' }),
    ]);
    const input = (await fieldBox(container, 'amount')).querySelector('input')!;

    expect(input.value).toBe('');
    await userEvent.type(input, '42');
    await vi.waitFor(() => expect(valueOf(bundle, 'amount')).toBe(42));
  });

  it('маска ui-kit: подсказка — сама маска, литералы ставит IMask', async () => {
    const { bundle, container } = mount({ phone: null }, (model) => [
      field(model, 'phone', fields.InputMask, { label: 'Телефон', mask: '+7 (999) 999-99-99' }),
    ]);
    const input = (await fieldBox(container, 'phone')).querySelector('input')!;

    expect(input.placeholder).toBe('+7 (999) 999-99-99');
    await userEvent.type(input, '9001234567');
    await vi.waitFor(() => expect(valueOf(bundle, 'phone')).toBe('+7 (900) 123-45-67'));
  });
});

describe('подпись рядом с контролом', () => {
  it('SwitchWithLabel: подпись рисует переключатель, сверху её нет; щелчок по ней переключает', async () => {
    const { bundle, container } = mount({ notify: false }, (model) => [
      field(model, 'notify', fields.SwitchWithLabel, { label: 'Уведомления' }),
    ]);
    const box = await fieldBox(container, 'notify');

    // Подпись одна — у самого переключателя (HexaUI `FormLabel` с классом `toggle-label`).
    const labels = [...box.querySelectorAll('*')].filter(
      (element) => element.childElementCount === 0 && element.textContent === 'Уведомления'
    );
    expect(labels).toHaveLength(1);
    expect(labels[0]?.closest('.toggle-label')).not.toBeNull();

    await userEvent.click(labels[0] as HTMLElement);
    await vi.waitFor(() => expect(valueOf(bundle, 'notify')).toBe(true));
  });

  it('CheckboxWithLabel: щелчок — булево в модели', async () => {
    const { bundle, container } = mount({ agree: false }, (model) => [
      field(model, 'agree', fields.CheckboxWithLabel, { label: 'Согласен' }),
    ]);
    const box = await fieldBox(container, 'agree');

    await userEvent.click(box.querySelector('input[type="checkbox"]')!);
    await vi.waitFor(() => expect(valueOf(bundle, 'agree')).toBe(true));
  });
});

describe('выбор', () => {
  it('выпадающий список открывается внутри рамки кита, выбор — в модель', async () => {
    const { bundle, container } = mount({ color: null }, (model) => [
      field(model, 'color', fields.Select, {
        label: 'Цвет',
        options: [
          { label: 'Красный', value: 'red' },
          { label: 'Синий', value: 'blue' },
        ],
      }),
    ]);
    const box = await fieldBox(container, 'color');

    await userEvent.click(box.querySelector('.ant-select-selector')!);
    const option = await vi.waitFor(() => {
      const found = [...document.querySelectorAll<HTMLElement>('.ant-select-item-option')].find(
        (item) => item.textContent === 'Синий'
      );
      if (found === undefined) throw new Error('список не открылся');
      return found;
    });

    expect(option.closest('[data-hexa-popup-root]')).not.toBeNull();
    await userEvent.click(option);
    await vi.waitFor(() => expect(valueOf(bundle, 'color')).toBe('blue'));
  });

  it('радиогруппа: значение из события antd', async () => {
    const { bundle, container } = mount({ size: null }, (model) => [
      field(model, 'size', fields.RadioGroup, {
        label: 'Размер',
        options: [
          { label: 'Малый', value: 's' },
          { label: 'Большой', value: 'l' },
        ],
      }),
    ]);
    const box = await fieldBox(container, 'size');

    await userEvent.click(box.querySelectorAll<HTMLElement>('input[type="radio"]')[1]!);
    await vi.waitFor(() => expect(valueOf(bundle, 'size')).toBe('l'));
  });
});

describe('дата и время', () => {
  it('DatePicker: дата модели показана в формате dateFormat (токены date-fns)', async () => {
    const { container } = mount({ birth: new Date(2024, 0, 15) }, (model) => [
      field(model, 'birth', fields.DatePicker, { label: 'Дата', dateFormat: 'dd.MM.yyyy' }),
    ]);
    const box = await fieldBox(container, 'birth');

    // Календарь грузится лениво: до него в поле — заглушка без значения.
    await vi.waitFor(
      () =>
        expect(box.querySelector<HTMLInputElement>('.ant-picker input')?.value).toBe('15.01.2024'),
      { timeout: 15_000 }
    );
  });

  it('DatePickerRange: после первой даты модель — null, а выбор продолжается до полного периода', async () => {
    // Период уже выбран: новый выбор сначала превращает значение модели в null — и календарь
    // обязан не забыть при этом только что выбранное начало.
    const now = new Date();
    const initial = [
      new Date(now.getFullYear(), now.getMonth(), 1),
      new Date(now.getFullYear(), now.getMonth(), 5),
    ];
    const { bundle, container } = mount({ trip: initial }, (model) => [
      field(model, 'trip', fields.DatePickerRange, { label: 'Поездка' }),
    ]);
    const box = await fieldBox(container, 'trip');

    // Календарь грузится лениво: щёлкаем по нему, а не по заглушке.
    const picker = await vi.waitFor(
      () => {
        const found = box.querySelector<HTMLInputElement>('.ant-picker input');
        if (found === null) throw new Error('календарь не загрузился');
        return found;
      },
      { timeout: 15_000 }
    );
    await userEvent.click(picker);
    /** День текущего месяца в открытом календаре (первая панель). */
    const day = (n: number): Promise<HTMLElement> =>
      vi.waitFor(() => {
        const panel = document.querySelector('.ant-picker-dropdown .ant-picker-date-panel');
        const found = [
          ...(panel?.querySelectorAll<HTMLElement>('.ant-picker-cell-in-view') ?? []),
        ].find((cellNode) => cellNode.textContent === String(n));
        if (found === undefined) throw new Error('календарь не открылся');
        return found;
      });

    await userEvent.click(await day(10));
    // Неполный период модель не получает (поле-кортеж хранит null как []) — но календарь начало
    // не забыл.
    await vi.waitFor(() => expect(valueOf(bundle, 'trip') ?? []).toEqual([]));
    await userEvent.click(await day(20));

    await vi.waitFor(() => {
      const range = valueOf(bundle, 'trip') as [Date, Date] | null;
      expect(range?.map((date) => date.getDate())).toEqual([10, 20]);
    });
  });

  it('TimeRange: пока заполнено одно поле — null; оба — пара; внешний сброс очищает поля', async () => {
    const { bundle, container } = mount({ work: null }, (model) => [
      field(model, 'work', fields.TimeRange, { label: 'Часы работы' }),
    ]);
    const [start, end] = (await fieldBox(container, 'work')).querySelectorAll('input');

    await userEvent.type(start!, '1000');
    await vi.waitFor(() => expect(start!.value).toBe('10:00'));
    expect(valueOf(bundle, 'work')).toBeNull();

    await userEvent.type(end!, '1130');
    await vi.waitFor(() => expect(valueOf(bundle, 'work')).toEqual(['10:00', '11:30']));

    bundle.form.work.setValue(null);
    await vi.waitFor(() => {
      expect(start!.value).toBe('');
      expect(end!.value).toBe('');
    });
  });
});

describe('файлы', () => {
  it('FileUpload: выбранный файл — File в модели, удаление — null', async () => {
    const { bundle, container } = mount({ docs: null }, (model) => [
      field(model, 'docs', fields.FileUpload, { label: 'Документы' }),
    ]);
    const box = await fieldBox(container, 'docs');
    const file = new File(['содержимое'], 'passport.pdf', { type: 'application/pdf' });

    await userEvent.upload(box.querySelector<HTMLInputElement>('input[type="file"]')!, file);
    await vi.waitFor(() => {
      const stored = valueOf(bundle, 'docs') as File[] | null;
      expect(stored?.map((item) => item.name)).toEqual(['passport.pdf']);
    });
    await vi.waitFor(() => expect(box.textContent).toContain('passport.pdf'));

    await userEvent.click(box.querySelector<HTMLElement>('.close-icon')!);
    await vi.waitFor(() => expect(valueOf(bundle, 'docs')).toBeNull());
  });
});

describe('WeeklySchedule — неуправляемый HexaUI', () => {
  /** Ячейка сетки: день × 24 + час. */
  const cell = (box: HTMLElement, day: number, hour: number): HTMLElement =>
    box.querySelector<HTMLElement>(`[data-testid="cell-id-${day * 24 + hour}"]`)!;

  /**
   * Отмечена ли ячейка. HexaUI отличает отмеченную только цветом фона, поэтому сравниваем с
   * ячейкой, которую тест не трогает (воскресенье, 23 часа).
   */
  const marked = (box: HTMLElement, day: number, hour: number): boolean =>
    getComputedStyle(cell(box, day, hour)).backgroundColor !==
    getComputedStyle(cell(box, 6, 23)).backgroundColor;

  it('внешнее значение и сброс формы — пересоздание; своя правка — без пересоздания', async () => {
    const { bundle, container } = mount({ schedule: null }, (model) => [
      field(model, 'schedule', fields.WeeklySchedule, { label: 'Расписание' }),
    ]);
    const box = await fieldBox(container, 'schedule');
    expect(marked(box, 0, 9)).toBe(false);

    // Значение снаружи: сетка показывает его — компонент пересоздан с новым начальным состоянием.
    bundle.form.schedule.setValue({ monday: hours(9) });
    await vi.waitFor(() => expect(marked(box, 0, 9)).toBe(true));

    // Своя правка: выделение мышью уходит в модель, а сетка остаётся тем же экземпляром.
    const before = cell(box, 1, 10);
    const rect = before.getBoundingClientRect();
    const at = { bubbles: true, button: 0, clientX: rect.x + 2, clientY: rect.y + 2 };
    before.dispatchEvent(new MouseEvent('mousedown', at));
    document.dispatchEvent(new MouseEvent('mouseup', at));
    await vi.waitFor(() => {
      const stored = valueOf(bundle, 'schedule') as Record<string, number[]>;
      expect(stored.tuesday?.[10]).toBe(1);
      expect(stored.monday?.[9]).toBe(1);
    });
    expect(cell(box, 1, 10)).toBe(before);

    // Сброс формы — снова внешнее значение: сетка пустая.
    bundle.form.reset();
    await vi.waitFor(() => expect(marked(box, 0, 9)).toBe(false));
    expect(valueOf(bundle, 'schedule')).toBeNull();
  });
});
