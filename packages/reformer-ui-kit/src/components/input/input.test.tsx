import { describe, it, expect } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { Input, InputNumber } from './index';
import { Bound } from '@/test-utils/bound';

describe('Input (base, pure shadcn)', () => {
  it('рендерит native input с data-slot=input', () => {
    expect(renderToStaticMarkup(<Input />)).toContain('data-slot="input"');
  });

  it('type прокидывается', () => {
    expect(renderToStaticMarkup(<Input type="email" />)).toContain('type="email"');
  });
});

describe('Input в форме (nativeInputAdapter)', () => {
  it('строковый: рендерит value', () => {
    const html = renderToStaticMarkup(<Bound component={Input} value="привет" />);
    expect(html).toContain('value="привет"');
    expect(html).toContain('data-slot="input"');
  });

  it('строковый: value=null → пустое поле', () => {
    const html = renderToStaticMarkup(<Bound component={Input} value={null} />);
    expect(html).toContain('value=""');
  });

  it('InputNumber: type=number + число из value', () => {
    const html = renderToStaticMarkup(<Bound component={InputNumber} value={42} />);
    expect(html).toContain('type="number"');
    expect(html).toContain('value="42"');
  });

  it('InputNumber: value=null → пустое поле (буфер отдаёт "")', () => {
    const html = renderToStaticMarkup(<Bound component={InputNumber} value={null} />);
    expect(html).toContain('value=""');
  });

  it('прокидывает aria/id на input (seam-контракт)', () => {
    const html = renderToStaticMarkup(
      <Bound component={Input} value="x" id="control-a" aria-labelledby="label-a" aria-invalid />
    );
    expect(html).toContain('id="control-a"');
    expect(html).toContain('aria-labelledby="label-a"');
  });
  it('readOnly доезжает до DOM: значение видно, ввод закрыт', () => {
    const html = renderToStaticMarkup(<Bound component={Input} value="Иван Петров" readOnly />);
    expect(html).toMatch(/readonly/i);
    expect(html).toContain('value="Иван Петров"');
  });
});
