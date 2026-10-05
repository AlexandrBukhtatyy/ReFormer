/**
 * Свойства виджета поля из каталога кита.
 *
 * Проверяется то, из-за чего панель врала бы: чужая запись под виджетом, свойство, которое мост
 * до контрола не донесёт, второе место правки того, что ведёт схема, и мусор в `ui:options` после
 * смены виджета. И порядок строк панели: он задан правилом, а не разметкой, поэтому проверяется
 * здесь — вместе с тем, что булевы свойства группы стоят одной строкой-списком, а не флажками.
 * Каталог — фикстура в форме настоящего (`propsSchema` с `x-doc`); React и DOM не нужны.
 *
 * @module plugins/rjsf/editor/widget-props.test
 */

import { describe, expect, it } from 'vitest';
import type { CatalogJson } from '@reformer/builder-plugin-api';
import type { RjsfFieldSchema, RjsfFieldUi } from '../../core';
import {
  fieldPanelOf,
  flagKey,
  flagOn,
  flagValue,
  retargetUi,
  widgetPropsOf,
  withWidgetOption,
  type FieldFlag,
  type FieldRow,
} from './widget-props';

type Record_ = CatalogJson['components'][number];

const record = (name: string, properties: Record<string, unknown>, role = 'field'): Record_ =>
  ({ name, role, propsSchema: { type: 'object', properties } }) as Record_;

const text = (group: string, extra: Record<string, unknown> = {}) => ({
  type: 'string',
  'x-doc': { group, type: 'string' },
  ...extra,
});

const CATALOG: CatalogJson = {
  version: '2.1',
  components: [
    record('Input', {
      className: {
        type: 'string',
        'x-doc': { group: 'Control', type: 'string', kind: 'readonly' },
      },
      label: text('Textfield'),
      placeholder: text('Textfield'),
      required: { type: 'boolean', 'x-doc': { group: 'State', type: 'boolean' } },
      testId: text('Behavior'),
      tooltip: text('Textfield', { description: 'Подсказка в контроле.' }),
      type: {
        type: 'string',
        enum: ['text', 'email'],
        default: 'text',
        'x-doc': { group: 'Textfield', type: "'text' | 'email'", kind: 'enum' },
      },
      readOnly: { type: 'boolean', default: false, 'x-doc': { group: 'State', type: 'boolean' } },
    }),
    record('InputMask', { mask: text('Textfield'), tooltip: text('Textfield') }),
    record('Slider', {
      orientation: {
        type: 'string',
        enum: ['horizontal', 'vertical'],
        'x-doc': { group: 'Behavior', type: 'string' },
      },
      step: { type: 'number', minimum: 0, 'x-doc': { group: 'Behavior', type: 'number' } },
      onValueCommit: { 'x-doc': { group: 'Control', type: '() => void', kind: 'readonly' } },
      defaultValue: { type: 'array', 'x-doc': { group: 'Control', type: 'number[]' } },
      marks: { type: 'array', 'x-doc': { group: 'Ticks', type: 'number[]' } },
      thumbLabel: text('Ticks'),
      // Атрибут HTML-формы: кит относит его к своей группе Control.
      name: text('Control'),
    }),
    record('Checkbox', {
      label: text('Textfield'),
      // Как в каталоге ui-kit: режим слота у флажка «только чтение» не помечен.
      asChild: { type: 'boolean', 'x-doc': { group: 'Behavior', type: 'boolean' } },
    }),
    record('Toggle', {
      className: text('Control'),
      tooltip: text('Textfield'),
      hint: text('Textfield'),
      size: { type: 'string', enum: ['sm', 'lg'], 'x-doc': { group: 'Behavior', type: 'string' } },
      variant: {
        type: 'string',
        enum: ['default', 'outline'],
        'x-doc': { group: 'Behavior', type: 'string' },
      },
      loop: { type: 'boolean', 'x-doc': { group: 'Behavior', type: 'boolean' } },
      readOnly: { type: 'boolean', 'x-doc': { group: 'State', type: 'boolean' } },
    }),
    // Булевы пропсы вперемешку с прочими, один включён китом по умолчанию.
    record('Rating', {
      count: { type: 'number', 'x-doc': { group: 'Behavior', type: 'number' } },
      clearable: {
        type: 'boolean',
        default: true,
        description: 'Крестик сброса значения.',
        'x-doc': { group: 'Behavior', type: 'boolean' },
      },
      precision: { type: 'number', 'x-doc': { group: 'Behavior', type: 'number' } },
      allowHalf: { type: 'boolean', 'x-doc': { group: 'Behavior', type: 'boolean' } },
    }),
    record('Box', { padding: text('Control') }, 'container'),
  ],
};

const STRING: RjsfFieldSchema = { type: 'string' };
const NUMBER: RjsfFieldSchema = { type: 'number' };

const keys = (field: RjsfFieldSchema, ui?: RjsfFieldUi, catalog: CatalogJson | null = CATALOG) =>
  widgetPropsOf(field, ui, catalog)?.fields.map((item) => item.key);

const flagText = (flag: FieldFlag): string =>
  flag.kind === 'field' ? flag.id : `.${flag.prop.key}`;

/** Строка панели: свойство схемы — именем, свойство контрола — с точкой, флаги — в скобках. */
const rowText = (row: FieldRow): string => {
  if (row.kind === 'field') return row.id;
  if (row.kind === 'prop') return `.${row.prop.key}`;
  return `[${row.flags.map(flagText).join(' ')}]`;
};

/** Панель строками «группа: адреса» — так порядок читается глазами. */
const layout = (field: RjsfFieldSchema, ui?: RjsfFieldUi, catalog: CatalogJson | null = CATALOG) =>
  fieldPanelOf(field, ui, catalog).sections.map(
    (section) => `${section.group}: ${section.rows.map(rowText).join(' ')}`
  );

/** Флаги группы — те, что стоят её единственной строкой-списком. */
const flagsOf = (
  group: string,
  field: RjsfFieldSchema,
  ui?: RjsfFieldUi,
  catalog: CatalogJson | null = CATALOG
): readonly FieldFlag[] =>
  fieldPanelOf(field, ui, catalog)
    .sections.find((section) => section.group === group)
    ?.rows.flatMap((row) => (row.kind === 'flags' ? row.flags : [])) ?? [];

describe('какая запись стоит за виджетом поля', () => {
  it('виджет кита под своим именем — его запись и его свойства', () => {
    const model = widgetPropsOf(STRING, { 'ui:widget': 'InputMask' }, CATALOG);

    expect(model?.component).toBe('InputMask');
    expect(keys(STRING, { 'ui:widget': 'InputMask' })).toEqual(['mask', 'tooltip']);
  });

  it('виджет не выбран — запись, которой тема рисует тип по умолчанию', () => {
    expect(widgetPropsOf(STRING, undefined, CATALOG)?.component).toBe('Input');
    expect(widgetPropsOf({ type: 'boolean' }, undefined, CATALOG)?.component).toBe('Checkbox');
  });

  it('короткое имя RJSF — запись его роли; постоянный проп роли не правится', () => {
    expect(widgetPropsOf(NUMBER, { 'ui:widget': 'range' }, CATALOG)?.component).toBe('Slider');
    // Пароль рисует Input с постоянным `type` — выбора типа у него нет.
    expect(keys(STRING, { 'ui:widget': 'password' })).not.toContain('type');
    expect(keys(STRING)).toContain('type');
  });

  it('уточнение кита (`kit.renderers.rjsf`) меняет запись роли', () => {
    const refined: CatalogJson = {
      ...CATALOG,
      kit: { renderers: { rjsf: { widgets: { TextWidget: 'InputMask' } } } },
    };

    expect(widgetPropsOf(STRING, undefined, refined)?.component).toBe('InputMask');
  });

  it('записи нет — модели нет: кит не подключён, виджет стандартный или не поле', () => {
    expect(widgetPropsOf(STRING, undefined, null)).toBeNull();
    expect(widgetPropsOf(STRING, undefined, { version: '2.1', components: [] })).toBeNull();
    expect(widgetPropsOf(STRING, { 'ui:widget': 'color' }, CATALOG)).toBeNull();
    expect(widgetPropsOf(STRING, { 'ui:widget': 'Box' }, CATALOG)).toBeNull();
  });
});

describe('какие свойства показаны и чем правятся', () => {
  it('того, что ведёт схема и форма, среди свойств контрола нет', () => {
    const shown = keys(STRING) ?? [];

    for (const owned of ['label', 'placeholder', 'required', 'testId']) {
      expect(shown).not.toContain(owned);
    }
    // Флажок объявил подпись и режим слота: первую ведёт схема, второй оставил бы форму без
    // флажка — свойств контрола у него нет вовсе.
    expect(widgetPropsOf({ type: 'boolean' }, undefined, CATALOG)?.fields).toEqual([]);
  });

  it('редактор — по виду свойства; чего JSON не задаёт, того в панели нет', () => {
    const fields = widgetPropsOf(NUMBER, { 'ui:widget': 'Slider' }, CATALOG)!.fields;

    expect(fields.map((field) => [field.key, field.editor])).toEqual([
      ['orientation', 'select'],
      ['step', 'number'],
      ['thumbLabel', 'text'],
      ['name', 'text'],
    ]);
    expect(fields[0]).toMatchObject({ options: ['horizontal', 'vertical'] });
    expect(fields[1]).toMatchObject({ min: 0 });
  });

  it('класс правится строкой, хотя кит пометил его «только чтение»', () => {
    const fields = widgetPropsOf(STRING, undefined, CATALOG)!.fields;

    expect(fields.find((field) => field.key === 'className')).toMatchObject({
      editor: 'text',
      group: 'Control',
    });
  });

  it('значение — из ui:options, умолчание каталога — отдельно и в значение не подставляется', () => {
    const ui = { 'ui:options': { tooltip: 'Как в паспорте' } };
    const fields = widgetPropsOf(STRING, ui, CATALOG)!.fields;
    const at = (key: string) => fields.find((field) => field.key === key);

    expect(at('tooltip')).toMatchObject({
      label: 'Tooltip',
      value: 'Как в паспорте',
      description: 'Подсказка в контроле.',
    });
    expect(at('type')).toMatchObject({ value: undefined, fallback: 'text' });
    expect(at('readOnly')).toMatchObject({ label: 'Read Only', editor: 'flag' });
  });
});

describe('порядок панели: общие группы, внутри — от важного к второстепенному', () => {
  it('свойства схемы и свойства контрола стоят в одних группах, а не двумя блоками', () => {
    expect(layout(STRING)).toEqual([
      'Control: name widget .className',
      'Textfield: label .tooltip placeholder .type',
      'Options: type enum',
      'State: [required .readOnly]',
    ]);
  });

  it('вариант и размер — внешний вид поля: сразу за виджетом, а не в «Поведении» каталога', () => {
    expect(layout({ type: 'boolean' }, { 'ui:widget': 'Toggle' })).toEqual([
      'Control: name widget .variant .size .className',
      // Подсказке в поле и вариантам у «да/нет» взяться неоткуда.
      'Textfield: label .tooltip .hint',
      'Options: type',
      'Behavior: [.loop]',
      'State: [required .readOnly]',
    ]);
  });

  it('свойство контрола без своего места идёт в группе каталога, своя группа кита — последней', () => {
    expect(layout(NUMBER, { 'ui:widget': 'Slider' })).toEqual([
      'Control: name widget',
      'Textfield: label placeholder',
      'Options: type enum',
      // Технический проп из группы Control каталога в «Основные» не попадает.
      'Behavior: .orientation .step .name',
      'State: [required]',
      'Ticks: .thumbLabel',
    ]);
  });

  it('кита нет — те же группы из одних свойств схемы; записи под виджетом нет', () => {
    const panel = fieldPanelOf(STRING, undefined, null);

    expect(panel.component).toBeNull();
    expect(layout(STRING, undefined, null)).toEqual([
      'Control: name widget',
      'Textfield: label placeholder',
      'Options: type enum',
      'State: [required]',
    ]);
    expect(fieldPanelOf(STRING, undefined, CATALOG).component).toBe('Input');
  });
});

describe('булевы свойства группы — одной строкой-списком', () => {
  const RATING = { 'ui:widget': 'Rating' };

  it('флаги группы собраны в одну строку — на месте первого из них', () => {
    expect(layout(NUMBER, RATING)).toEqual([
      'Control: name widget',
      'Textfield: label placeholder',
      'Options: type enum',
      // В каталоге булевы пропсы стоят через один; прочие строки свой порядок сохранили.
      'Behavior: .count [.clearable .allowHalf] .precision',
      'State: [required]',
    ]);
  });

  it('в одной строке — оба слоя: «обязательное» схемы и булевы пропсы контрола', () => {
    const flags = flagsOf('State', STRING);

    expect(flags.map((flag) => flag.kind)).toEqual(['field', 'prop']);
    // Ключ флага — значение пункта списка: у двух слоёв он общий и в строке не повторяется.
    expect(flags.map(flagKey)).toEqual(['required', 'readOnly']);
  });

  it('отдельной строкой булево свойство не стоит нигде', () => {
    for (const ui of [undefined, RATING, { 'ui:widget': 'Slider' }]) {
      const rows = fieldPanelOf(NUMBER, ui, CATALOG).sections.flatMap((section) => section.rows);

      expect(rows.filter((row) => row.kind === 'prop' && row.prop.editor === 'flag')).toEqual([]);
    }
    const toggle = fieldPanelOf({ type: 'boolean' }, { 'ui:widget': 'Toggle' }, CATALOG);
    // По списку на группу, а не один на поле: «с зацикливанием» — поведение, «только чтение» —
    // состояние, и каталог уже развёл их по группам.
    expect(
      toggle.sections.map((section) => section.rows.filter((row) => row.kind === 'flags').length)
    ).toEqual([0, 0, 0, 1, 1]);
  });

  it('список показывает действующее состояние: умолчание кита, пока значение не задано', () => {
    const at = (ui: RjsfFieldUi) => {
      const flag = flagsOf('Behavior', NUMBER, ui).find((item) => flagKey(item) === 'clearable');
      if (flag?.kind !== 'prop') throw new Error('флага clearable нет');
      return flag.prop;
    };

    // В документе свойства нет, а действует оно — кит включает его сам.
    expect(flagOn(at(RATING))).toBe(true);
    expect(flagOn(at({ ...RATING, 'ui:options': { clearable: false } }))).toBe(false);
    expect(flagOn(at({ ...RATING, 'ui:options': { clearable: true } }))).toBe(true);
    // Не булево значение (написано руками) умолчания не отменяет.
    expect(flagOn(at({ ...RATING, 'ui:options': { clearable: 'да' } }))).toBe(true);
  });

  it('в документ пишется только отличное от умолчания кита', () => {
    const [clearable, allowHalf] = flagsOf('Behavior', NUMBER, RATING).map((flag) => {
      if (flag.kind !== 'prop') throw new Error('в «Поведении» флагов схемы нет');
      return flag.prop;
    });

    // Умолчание `true`: выключить — явный `false`; убрать свойство вернуло бы умолчание.
    expect(flagValue(clearable!, false)).toBe(false);
    expect(flagValue(clearable!, true)).toBeUndefined();
    // Умолчания нет: включить — `true`, выключенное в документе не лежит.
    expect(flagValue(allowHalf!, true)).toBe(true);
    expect(flagValue(allowHalf!, false)).toBeUndefined();
  });
});

describe('запись свойства в ui:options', () => {
  it('свойство ложится в ui:options рядом с прочими подсказками поля', () => {
    const ui = { 'ui:widget': 'InputMask', 'ui:options': { tooltip: 'Телефон' } };

    expect(withWidgetOption(ui, 'mask', '+7 999')).toEqual({
      'ui:widget': 'InputMask',
      'ui:options': { tooltip: 'Телефон', mask: '+7 999' },
    });
    expect(withWidgetOption(undefined, 'mask', '+7 999')).toEqual({
      'ui:options': { mask: '+7 999' },
    });
  });

  it('пустое значение убирает свойство, пустые опции и пустые подсказки — целиком', () => {
    const ui = { 'ui:widget': 'InputMask', 'ui:options': { mask: '+7 999' } };

    expect(withWidgetOption(ui, 'mask', '')).toEqual({ 'ui:widget': 'InputMask' });
    expect(withWidgetOption({ 'ui:options': { mask: '+7 999' } }, 'mask', undefined)).toBeNull();
    // `false` — значение, а не «не задано».
    expect(withWidgetOption(undefined, 'readOnly', false)).toEqual({
      'ui:options': { readOnly: false },
    });
  });
});

describe('смена виджета', () => {
  it('свойства прежнего контрола, чужие новому, уходят; общие и чужие ключи остаются', () => {
    const before = {
      'ui:widget': 'InputMask',
      'ui:options': { mask: '+7 999', tooltip: 'Телефон', emptyValue: '' },
    };
    const after = { ...before, 'ui:widget': 'Input' };

    expect(
      retargetUi({ field: STRING, ui: before }, { field: STRING, ui: after }, CATALOG)
    ).toEqual({ 'ui:widget': 'Input', 'ui:options': { tooltip: 'Телефон', emptyValue: '' } });
  });

  it('виджет по умолчанию меняют и тип поля, и появление вариантов', () => {
    const ui = { 'ui:options': { tooltip: 'Телефон' } };

    // Строка → да/нет: Input → Checkbox, подсказки контрола у него нет.
    expect(
      retargetUi({ field: STRING, ui }, { field: { type: 'boolean' }, ui }, CATALOG)
    ).toBeNull();
    // Варианты: Input → выбор, которого в ките нет, — свойства Input больше некому принять.
    expect(
      retargetUi({ field: STRING, ui }, { field: { type: 'string', enum: ['a'] }, ui }, CATALOG)
    ).toBeNull();
  });

  it('убирать нечего — подсказки те же самые', () => {
    const ui = { 'ui:widget': 'Input', 'ui:options': { tooltip: 'Телефон' } };
    const next = { ...ui, 'ui:widget': 'InputMask' };

    expect(retargetUi({ field: STRING, ui }, { field: STRING, ui: next }, CATALOG)).toBe(next);
    expect(
      retargetUi({ field: STRING, ui: undefined }, { field: STRING, ui: null }, null)
    ).toBeNull();
  });
});
