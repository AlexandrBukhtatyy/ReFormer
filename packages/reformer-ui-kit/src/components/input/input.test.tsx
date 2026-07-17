import { describe, it, expect } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { Input, InputField } from './index';

describe('Input (base, pure shadcn)', () => {
  it('рендерит native input с data-slot=input', () => {
    expect(renderToStaticMarkup(<Input />)).toContain('data-slot="input"');
  });

  it('type прокидывается', () => {
    expect(renderToStaticMarkup(<Input type="email" />)).toContain('type="email"');
  });
});

describe('InputField (диспетчер по type)', () => {
  it('строковый: рендерит value', () => {
    const html = renderToStaticMarkup(<InputField value="привет" />);
    expect(html).toContain('value="привет"');
    expect(html).toContain('data-slot="input"');
  });

  it('строковый: value=null → пустое поле', () => {
    const html = renderToStaticMarkup(<InputField value={null} />);
    expect(html).toContain('value=""');
  });

  it('number: type=number + число из value', () => {
    const html = renderToStaticMarkup(<InputField type="number" value={42} />);
    expect(html).toContain('type="number"');
    expect(html).toContain('value="42"');
  });

  it('number: value=null → пустое поле (буфер отдаёт "")', () => {
    const html = renderToStaticMarkup(<InputField type="number" value={null} />);
    expect(html).toContain('value=""');
  });

  it('strip control: renderer-путь не течёт в DOM', () => {
    const html = renderToStaticMarkup(<InputField value="x" control={{ id: 1 } as never} />);
    expect(html).not.toContain('[object Object]');
  });

  it('прокидывает aria/id на input (seam-контракт)', () => {
    const html = renderToStaticMarkup(
      <InputField value="x" id="control-a" aria-labelledby="label-a" aria-invalid />
    );
    expect(html).toContain('id="control-a"');
    expect(html).toContain('aria-labelledby="label-a"');
  });
});
