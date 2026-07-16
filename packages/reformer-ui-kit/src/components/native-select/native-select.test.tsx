import { describe, it, expect } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { NativeSelect, NativeSelectOption, NativeSelectField } from './index';

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
