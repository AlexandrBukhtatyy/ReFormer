/**
 * Свойства виджета поля из каталога кита.
 *
 * Проверяется то, из-за чего панель врала бы: чужая запись под виджетом, свойство, которое мост
 * до контрола не донесёт, второе место правки того, что ведёт схема, и мусор в `ui:options` после
 * смены виджета. Каталог здесь — фикстура в форме настоящего (`propsSchema` с `x-doc`); React и
 * DOM не нужны.
 *
 * @module plugins/rjsf/editor/widget-props.test
 */

import { describe, expect, it } from 'vitest';
import type { CatalogJson } from '@reformer/builder-plugin-api';
import type { RjsfFieldSchema, RjsfFieldUi } from '@/plugins/rjsf/core';
import { retargetUi, widgetPropsOf, withWidgetOption } from './widget-props';

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
    }),
    record('Checkbox', { label: text('Textfield') }),
    record('Box', { padding: text('Control') }, 'container'),
  ],
};

const STRING: RjsfFieldSchema = { type: 'string' };
const NUMBER: RjsfFieldSchema = { type: 'number' };

const keys = (field: RjsfFieldSchema, ui?: RjsfFieldUi, catalog: CatalogJson | null = CATALOG) =>
  widgetPropsOf(field, ui, catalog)?.sections.flatMap((section) =>
    section.fields.map((item) => item.key)
  );

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
    // Флажок объявил одну подпись — секций у него нет вовсе.
    expect(widgetPropsOf({ type: 'boolean' }, undefined, CATALOG)?.sections).toEqual([]);
  });

  it('редактор — по виду свойства; чего JSON не задаёт, того в панели нет', () => {
    const fields = widgetPropsOf(NUMBER, { 'ui:widget': 'Slider' }, CATALOG)!.sections.flatMap(
      (section) => section.fields
    );

    expect(fields.map((field) => [field.key, field.editor])).toEqual([
      ['orientation', 'select'],
      ['step', 'number'],
      ['thumbLabel', 'text'],
    ]);
    expect(fields[0]).toMatchObject({ options: ['horizontal', 'vertical'] });
    expect(fields[1]).toMatchObject({ min: 0 });
  });

  it('секции — в порядке групп каталога, своя группа кита — следом; класс правится строкой', () => {
    const model = widgetPropsOf(STRING, undefined, CATALOG)!;

    expect(model.sections.map((section) => section.group)).toEqual([
      'Control',
      'Textfield',
      'State',
    ]);
    expect(model.sections[0]?.fields).toMatchObject([{ key: 'className', editor: 'text' }]);
    expect(
      widgetPropsOf(NUMBER, { 'ui:widget': 'Slider' }, CATALOG)!.sections.map(
        (section) => section.group
      )
    ).toEqual(['Behavior', 'Ticks']);
  });

  it('значение — из ui:options, умолчание каталога — отдельно и в значение не подставляется', () => {
    const ui = { 'ui:options': { tooltip: 'Как в паспорте' } };
    const fields = widgetPropsOf(STRING, ui, CATALOG)!.sections.flatMap(
      (section) => section.fields
    );
    const at = (key: string) => fields.find((field) => field.key === key);

    expect(at('tooltip')).toMatchObject({
      label: 'Tooltip',
      value: 'Как в паспорте',
      description: 'Подсказка в контроле.',
    });
    expect(at('type')).toMatchObject({ value: undefined, fallback: 'text' });
    expect(at('readOnly')).toMatchObject({ label: 'Read Only', editor: 'checkbox' });
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
