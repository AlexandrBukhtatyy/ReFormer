import { createElement, type ReactNode } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { withTheme } from '@rjsf/core';
import type { RJSFSchema, UiSchema, WidgetProps } from '@rjsf/utils';
import validator from '@rjsf/validator-ajv8';
import type { FieldAdapter } from '@reformer/core';
import { createKitTheme, kitWidget, type KitFieldFrameProps, type KitThemeRecord } from './index';

// ── Фикстурный кит: диалекты полей как у китов ReFormer ────────────────────────────────────────

type Props = Record<string, unknown>;

const nativeAdapter: FieldAdapter = {
  fromEmit: (event) => (event as { target: { value: string } }).target.value || null,
  toValue: (value) => value ?? '',
};
const checkedAdapter: FieldAdapter = {
  valueProp: 'checked',
  changeProp: 'onCheckedChange',
  fromEmit: (checked) => checked === true,
  toValue: (value) => value ?? false,
};
const valueChangeAdapter: FieldAdapter = {
  valueProp: 'value',
  changeProp: 'onValueChange',
  fromEmit: (value) => (value as string) || null,
  toValue: (value) => value ?? '',
};

function Input(props: Props) {
  return (
    <input
      data-kit="Input"
      id={props.id as string}
      type={props.type as string | undefined}
      value={props.value as string}
      placeholder={props.placeholder as string | undefined}
      data-testid={props['data-testid'] as string}
      readOnly
    />
  );
}
Input.reformerAdapter = nativeAdapter;

function CheckboxWithLabel(props: Props) {
  return (
    <label data-kit="Checkbox">
      <input type="checkbox" checked={props.checked as boolean} readOnly />
      {props.label as ReactNode}
    </label>
  );
}
CheckboxWithLabel.reformerAdapter = checkedAdapter;
CheckboxWithLabel.reformerLayout = 'inline-label';

function SwitchWithLabel(props: Props) {
  return <button data-kit="Switch" aria-checked={props.checked as boolean} />;
}
SwitchWithLabel.reformerAdapter = checkedAdapter;
SwitchWithLabel.reformerLayout = 'inline-label';

function Select(props: Props) {
  const options = props.options as { value: string; label: string }[];
  return (
    <select
      data-kit="Select"
      value={props.value as string}
      disabled={props.disabled === true}
      onChange={() => undefined}
    >
      {options.map((option) => (
        <option key={option.value} value={option.value}>
          {option.label}
        </option>
      ))}
    </select>
  );
}
Select.reformerAdapter = valueChangeAdapter;

function FieldFrame({
  label,
  required,
  errors,
  inlineLabel,
  className,
  children,
}: KitFieldFrameProps) {
  return (
    <div data-kit="FieldFrame" data-inline={String(inlineLabel === true)} className={className}>
      {inlineLabel !== true && label !== undefined && (
        <span data-kit="label">
          {label as ReactNode}
          {required === true && '*'}
        </span>
      )}
      {children as ReactNode}
      {errors?.map((error) => (
        <em key={error}>{error}</em>
      ))}
    </div>
  );
}

function Box({ className, children }: Props) {
  return (
    <div data-kit="Box" className={className as string}>
      {children as ReactNode}
    </div>
  );
}

function Button({ type, children }: Props) {
  return (
    <button data-kit="Button" type={type as 'submit'}>
      {children as ReactNode}
    </button>
  );
}

const components: KitThemeRecord[] = [
  { name: 'Input', role: 'field', propsSchema: { properties: { placeholder: {} } } },
  {
    name: 'Checkbox',
    role: 'field',
    exportName: 'CheckboxWithLabel',
    propsSchema: { properties: { label: {} } },
  },
  { name: 'Switch', role: 'field', exportName: 'SwitchWithLabel', propsSchema: { properties: {} } },
  { name: 'Select', role: 'field', propsSchema: { properties: { options: {} } } },
  { name: 'Box', role: 'container' },
  { name: 'Button', role: 'container' },
];

const namespace = { Input, CheckboxWithLabel, SwitchWithLabel, Select, FieldFrame, Box, Button };

const kit = { namespace, components, slots: { fieldFrame: 'FieldFrame' } };

// ── Помощники ─────────────────────────────────────────────────────────────────────────────────

/** Контрол-зонд: запоминает пропсы, с которыми его отрисовал мост. */
function probe(adapter?: FieldAdapter, layout?: string) {
  const seen: Props[] = [];
  function Probe(props: Props) {
    seen.push(props);
    return null;
  }
  Object.assign(Probe, { reformerAdapter: adapter, reformerLayout: layout });
  return { Probe, last: () => seen[seen.length - 1] };
}

/** Минимальные пропсы виджета RJSF. */
function widgetProps(overrides: Partial<WidgetProps> = {}): WidgetProps {
  return {
    id: 'root_field',
    name: 'field',
    value: undefined,
    onChange: vi.fn(),
    onBlur: vi.fn(),
    onFocus: vi.fn(),
    label: 'Поле',
    schema: { type: 'string' },
    options: {},
    registry: {} as WidgetProps['registry'],
    ...overrides,
  } as WidgetProps;
}

function render(schema: RJSFSchema, extra: Record<string, unknown> = {}) {
  const Form = withTheme(createKitTheme(kit).theme);
  return renderToStaticMarkup(createElement(Form, { schema, validator, ...extra }));
}

const count = (html: string, needle: string) => html.split(needle).length - 1;

// ── Тесты ─────────────────────────────────────────────────────────────────────────────────────

describe('сборка темы', () => {
  it('без кита — стандартная тема RJSF и никаких расхождений', () => {
    expect(createKitTheme({ namespace: {}, components: [] })).toEqual({
      theme: {},
      componentWidgets: [],
      problems: [],
    });
  });

  it('роли заполняются полями кита по общим именам, недостающее остаётся стандартным', () => {
    const { theme, componentWidgets, problems } = createKitTheme(kit);
    const widgets = theme.widgets ?? {};

    expect(widgets.TextWidget?.displayName).toBe('KitWidget(Input)');
    // Пароля в ките нет — роль берёт Input, но скрывает ввод.
    expect(widgets.PasswordWidget?.displayName).toBe('KitWidget(Input)');
    expect(widgets.PasswordWidget).not.toBe(widgets.TextWidget);
    expect(widgets.CheckboxWidget?.displayName).toBe('KitWidget(Checkbox)');
    expect(widgets.SelectWidget?.displayName).toBe('KitWidget(Select)');
    expect(problems).toEqual(
      ['TextareaWidget', 'RadioWidget', 'RangeWidget', 'UpDownWidget', 'DateWidget'].map(
        (widget) => ({ code: 'widget-default', widget })
      )
    );
    // Поля кита — ещё и виджеты под своими именами; ставшие ролью — тот же виджет.
    expect(componentWidgets).toEqual(['Input', 'Checkbox', 'Switch', 'Select']);
    expect(widgets.Input).toBe(widgets.TextWidget);
    expect(widgets.Switch?.displayName).toBe('KitWidget(Switch)');
  });

  it('renderers.rjsf уточняет роли; названное, но отсутствующее — расхождение', () => {
    const { theme, problems } = createKitTheme({
      ...kit,
      widgets: { CheckboxWidget: 'Switch', TextareaWidget: 'RichText' },
      templates: { submit: 'Submit' },
    });

    expect(theme.widgets?.CheckboxWidget?.displayName).toBe('KitWidget(Switch)');
    expect(problems).toContainEqual({
      code: 'component-missing',
      target: 'TextareaWidget',
      component: 'RichText',
    });
    expect(problems).toContainEqual({ code: 'widget-default', widget: 'TextareaWidget' });
    expect(problems).toContainEqual({
      code: 'component-missing',
      target: 'submit',
      component: 'Submit',
    });
    expect(problems).toContainEqual({ code: 'template-default', template: 'submit' });
    expect(theme.templates?.ButtonTemplates).toBeUndefined();
  });

  it('кит без рамки поля и контейнера — своя минимальная рамка и стандартный объект RJSF', () => {
    const { theme, problems } = createKitTheme({
      namespace: { Input },
      components: [{ name: 'Input', role: 'field' }],
    });

    expect(problems).toContainEqual({ code: 'template-default', template: 'field' });
    expect(problems).toContainEqual({ code: 'template-default', template: 'object' });
    expect(theme.templates?.FieldTemplate).toBeDefined();
    expect(theme.templates?.ObjectFieldTemplate).toBeUndefined();
  });
});

describe('мост поля', () => {
  it('флажок: значение — в checked, эмит контрола — boolean в RJSF', () => {
    const { Probe, last } = probe(checkedAdapter, 'inline-label');
    const onChange = vi.fn();
    const Widget = kitWidget(Probe, { name: 'Checkbox', slot: 'CheckboxWidget' });

    renderToStaticMarkup(
      createElement(
        Widget,
        widgetProps({
          value: true,
          onChange,
          schema: { type: 'boolean' },
          // RJSF строит варианты и для boolean — флажку они не уходят.
          options: { enumOptions: [{ value: true, label: 'Да' }] },
        })
      )
    );
    (last().onCheckedChange as (next: unknown) => void)(false);

    expect(last().checked).toBe(true);
    expect(last().options).toBeUndefined();
    expect(last().label).toBe('Поле');
    expect(onChange).toHaveBeenCalledWith(false);
  });

  it('ввод: событие — в строку, пустой ввод — «значения нет»', () => {
    const { Probe, last } = probe(nativeAdapter);
    const onChange = vi.fn();
    const onBlur = vi.fn();
    const Widget = kitWidget(Probe, { name: 'Input', slot: 'TextWidget' });

    renderToStaticMarkup(
      createElement(
        Widget,
        widgetProps({ value: 'Анна', onChange, onBlur, placeholder: 'Имя', readonly: true })
      )
    );
    const emit = last().onChange as (event: unknown) => void;
    emit({ target: { value: 'Анна Б' } });
    emit({ target: { value: '' } });
    (last().onBlur as () => void)();

    expect(last()).toMatchObject({
      value: 'Анна',
      placeholder: 'Имя',
      disabled: true,
      'data-testid': 'input-field',
    });
    // Подпись рисует рамка — контролу без inline-label она не нужна.
    expect(last().label).toBeUndefined();
    expect(onChange.mock.calls).toEqual([['Анна Б'], [undefined]]);
    expect(onBlur).toHaveBeenCalledWith('root_field', 'Анна');
  });

  it('выбор: контрол видит строковые ключи, RJSF получает исходные значения', () => {
    const { Probe, last } = probe(valueChangeAdapter);
    const onChange = vi.fn();
    const Widget = kitWidget(Probe, { name: 'Select', slot: 'SelectWidget', acceptsOptions: true });

    renderToStaticMarkup(
      createElement(
        Widget,
        widgetProps({
          value: 2,
          onChange,
          schema: { type: 'integer', enum: [1, 2] },
          options: {
            enumOptions: [
              { value: 1, label: 'Один' },
              { value: 2, label: 'Два' },
            ],
          },
          rawErrors: ['плохо'],
        })
      )
    );
    (last().onValueChange as (next: unknown) => void)('1');

    expect(last().value).toBe('2');
    expect(last().options).toEqual([
      { value: '1', label: 'Один' },
      { value: '2', label: 'Два' },
    ]);
    expect(last()['aria-invalid']).toBe(true);
    expect(onChange).toHaveBeenCalledWith(1);
  });

  it('дата: строка RJSF — Date контрола и обратно', () => {
    const { Probe, last } = probe({ fromEmit: (date) => date ?? null });
    const onChange = vi.fn();
    const Widget = kitWidget(Probe, { name: 'DatePicker', slot: 'DateWidget' });

    renderToStaticMarkup(createElement(Widget, widgetProps({ value: '2026-09-26', onChange })));
    (last().onChange as (next: unknown) => void)(new Date(2026, 0, 5));

    expect(last().value).toEqual(new Date(2026, 8, 26));
    expect(onChange).toHaveBeenCalledWith('2026-01-05');
  });

  it('число из диапазона: границы и шаг из схемы', () => {
    const { Probe, last } = probe();
    const Widget = kitWidget(Probe, { name: 'Slider', slot: 'RangeWidget' });

    renderToStaticMarkup(
      createElement(
        Widget,
        widgetProps({
          value: 4,
          schema: { type: 'integer', minimum: 0, maximum: 10, multipleOf: 2 },
        })
      )
    );

    expect(last()).toMatchObject({ min: 0, max: 10, step: 2, value: 4 });
  });
});

describe('форма RJSF в ките', () => {
  const schema: RJSFSchema = {
    type: 'object',
    title: 'Контакт',
    required: ['name'],
    properties: {
      name: { type: 'string', title: 'Имя' },
      channel: { type: 'string', title: 'Канал', enum: ['email', 'телефон'] },
      size: { type: 'integer', title: 'Размер', enum: [1, 2] },
      agree: { type: 'boolean', title: 'Согласие' },
    },
  };

  it('поля — компонентами кита в его рамке, объект — в его контейнере, отправка — его кнопкой', () => {
    const html = render(schema, {
      formData: { name: 'Анна', channel: 'телефон', size: 2, agree: true },
    });

    expect(count(html, 'data-kit="Box"')).toBe(1);
    expect(html).toContain('<h3 class="text-base font-semibold">Контакт</h3>');
    expect(count(html, 'data-kit="FieldFrame"')).toBe(4);
    expect(html).toContain('value="Анна"');
    expect(html).toContain('data-testid="input-name"');
    expect(html).toContain('<span data-kit="label">Имя*</span>');
    expect(html).toContain('<option value="телефон" selected="">телефон</option>');
    expect(html).toContain('<option value="2" selected="">2</option>');
    expect(html).toMatch(
      /<label data-kit="Checkbox"><input type="checkbox"[^>]*checked=""[^>]*\/>Согласие/
    );
    // Флажок подписывает себя сам — рамка верхнюю подпись не рисует.
    expect(html).toContain('data-inline="true"');
    expect(html).not.toContain('<span data-kit="label">Согласие');
    expect(html).toContain('<button data-kit="Button" type="submit">Submit</button>');
  });

  it('поле кита под своим именем и подписи кнопки из uiSchema', () => {
    const uiSchema: UiSchema = {
      agree: { 'ui:widget': 'Switch' },
      'ui:submitButtonOptions': { submitText: 'Отправить' },
    };
    const html = render(schema, { uiSchema, formData: { agree: true } });

    expect(html).toContain('data-kit="Switch"');
    expect(html).not.toContain('data-kit="Checkbox"');
    expect(html).toContain('>Отправить</button>');
    expect(
      render(schema, { uiSchema: { 'ui:submitButtonOptions': { norender: true } } })
    ).not.toContain('data-kit="Button"');
  });

  it('свойство из additionalProperties: ключ правит обёртка RJSF, значение — поле кита в рамке', () => {
    const html = render(
      { type: 'object', additionalProperties: { type: 'string' } },
      { formData: { extra: 'x' } }
    );

    // Поле ключа рисует обёртка RJSF, значение — Input кита внутри его рамки.
    expect(html).toMatch(/<input[^>]*value="extra"/);
    expect(html).toMatch(/data-kit="FieldFrame"[^>]*>(?:(?!<\/div>).)*<input data-kit="Input"/);
    expect(html).toContain('value="x"');
  });

  it('ошибки поля — в рамке, скрытое поле — без рамки', () => {
    const html = render(schema, {
      extraErrors: { name: { __errors: ['Заполните имя'] } },
      uiSchema: { size: { 'ui:widget': 'hidden' } },
    });

    expect(html).toContain('<em>Заполните имя</em>');
    expect(count(html, 'data-kit="FieldFrame"')).toBe(3);
  });
});
