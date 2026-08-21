import { describe, it, expect } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import {
  NativeSelect,
  NativeSelectOption,
  NativeSelectField,
  NativeSelectMulti,
  NativeSelectMultiField,
} from './index';

const OPTS = [
  { value: 'a', label: 'A' },
  { value: 'b', label: 'B' },
];

describe('NativeSelect (base, pure shadcn)', () => {
  it('рендерит native select с data-slot=native-select', () => {
    const html = renderToStaticMarkup(
      <NativeSelect>
        <NativeSelectOption value="a">A</NativeSelectOption>
      </NativeSelect>
    );
    expect(html).toContain('data-slot="native-select"');
    expect(html).toContain('data-slot="native-select-wrapper"');
  });

  it('рендерит переданные <option> children', () => {
    const html = renderToStaticMarkup(
      <NativeSelect>
        <NativeSelectOption value="a">Первый</NativeSelectOption>
      </NativeSelect>
    );
    expect(html).toContain('Первый');
    expect(html).toContain('data-slot="native-select-option"');
  });

  it('size=sm → data-size=sm', () => {
    const html = renderToStaticMarkup(<NativeSelect size="sm" />);
    expect(html).toContain('data-size="sm"');
  });
});

describe('NativeSelectField (field-версия)', () => {
  it('строит <option> из componentProps.options', () => {
    const html = renderToStaticMarkup(<NativeSelectField value="a" options={OPTS} />);
    expect(html).toContain('>A</option>');
    expect(html).toContain('>B</option>');
  });

  it('value → выбранная опция (selected)', () => {
    const html = renderToStaticMarkup(<NativeSelectField value="b" options={OPTS} />);
    expect(html).toContain('selected');
    expect(html).toContain('value="b"');
  });

  it('value=null → выбран placeholder (адаптер отдаёт "")', () => {
    const html = renderToStaticMarkup(
      <NativeSelectField value={null} options={OPTS} placeholder="Выберите" />
    );
    expect(html).toContain('Выберите');
    expect(html).toContain('value=""');
  });

  it('group → опции объединяются в <optgroup label>', () => {
    const grouped = [
      { value: 'msk', label: 'Москва', group: 'Россия' },
      { value: 'minsk', label: 'Минск', group: 'Беларусь' },
    ];
    const html = renderToStaticMarkup(<NativeSelectField value="msk" options={grouped} />);
    expect(html).toContain('data-slot="native-select-optgroup"');
    expect(html).toContain('label="Россия"');
    expect(html).toContain('label="Беларусь"');
  });

  it('strip control: renderer-путь не течёт в DOM', () => {
    const html = renderToStaticMarkup(
      <NativeSelectField value="a" options={OPTS} control={{ id: 1 } as never} />
    );
    expect(html).not.toContain('[object Object]');
  });

  it('прокидывает id/aria-*/data-testid на <select> (seam-контракт)', () => {
    const html = renderToStaticMarkup(
      <NativeSelectField
        value="a"
        options={OPTS}
        id="control-a"
        data-testid="input-loanType"
        aria-labelledby="label-a"
        aria-invalid
      />
    );
    expect(html).toContain('id="control-a"');
    expect(html).toContain('aria-labelledby="label-a"');
    expect(html).toContain('data-testid="input-loanType"');
  });
});

const GROUPED = [
  { value: 'a', label: 'Альфа', group: 'Греческие' },
  { value: 'b', label: 'Бета', group: 'Греческие' },
  { value: 'x', label: 'Икс' },
];

describe('NativeSelectMulti (вариант multi, нативный <select multiple>)', () => {
  it('рендерит именно multiple-листбокс со своим data-slot (порт NativeSelect не задействован)', () => {
    const html = renderToStaticMarkup(<NativeSelectMulti options={OPTS} value={[]} />);
    expect(html).toContain('multiple=""');
    expect(html).toContain('data-slot="native-select-multi"');
    // Обёртка с шевроном — принадлежность однострочного порта, в листбоксе её быть не должно.
    expect(html).not.toContain('data-slot="native-select-wrapper"');
    expect(html).not.toContain('data-slot="native-select-icon"');
  });

  it('отмечает КАЖДОЕ выбранное значение', () => {
    const html = renderToStaticMarkup(
      <NativeSelectMulti options={[...OPTS, { value: 'c', label: 'C' }]} value={['a', 'c']} />
    );
    expect(html.match(/selected=""/g) ?? []).toHaveLength(2);
  });

  it('rows задаёт нативный size (число видимых строк), а не ступень шкалы размеров', () => {
    const html = renderToStaticMarkup(<NativeSelectMulti options={OPTS} value={[]} rows={6} />);
    expect(html).toContain('size="6"');
    expect(html).not.toContain('data-size=');
  });

  it('группирует опции в optgroup по полю group', () => {
    const html = renderToStaticMarkup(<NativeSelectMulti options={GROUPED} value={[]} />);
    expect(html).toContain('data-slot="native-select-optgroup"');
    expect(html).toContain('label="Греческие"');
  });

  it('per-option data-testid = input-<field>-<value> (конвенция POM)', () => {
    const html = renderToStaticMarkup(
      <NativeSelectMulti options={OPTS} value={[]} data-testid="input-tags" />
    );
    expect(html).toContain('data-testid="input-tags"');
    expect(html).toContain('data-testid="input-tags-a"');
    expect(html).toContain('data-testid="input-tags-b"');
  });

  it('maxItems гасит только НЕвыбранные опции', () => {
    const html = renderToStaticMarkup(
      <NativeSelectMulti
        options={[...OPTS, { value: 'c', label: 'C' }]}
        value={['a']}
        maxItems={1}
      />
    );
    expect(html.match(/ disabled=""/g) ?? []).toHaveLength(2);
  });

  it('placeholder-опции нет и быть не может (в листбоксе она стала бы выбираемым пунктом)', () => {
    const html = renderToStaticMarkup(<NativeSelectMulti options={OPTS} value={[]} />);
    expect(html).not.toContain('value=""');
  });
});

describe('NativeSelectMultiField (field-версия, значение string[] | null)', () => {
  it('null из формы не роняет рендер — адаптер разворачивает его в []', () => {
    const html = renderToStaticMarkup(<NativeSelectMultiField value={null} options={OPTS} />);
    expect(html).not.toContain('selected=""');
    expect(html).toContain('multiple=""');
  });

  it('массив из формы доезжает до контрола', () => {
    const html = renderToStaticMarkup(<NativeSelectMultiField value={['b']} options={OPTS} />);
    expect(html).toContain('selected=""');
  });

  it('control (renderer-путь) не протекает в DOM', () => {
    const html = renderToStaticMarkup(
      <NativeSelectMultiField value={null} options={OPTS} control={{} as never} />
    );
    expect(html).not.toContain('control=');
  });
});
