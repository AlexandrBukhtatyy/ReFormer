import { describe, it, expect } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { Textarea } from './index';
import { Bound } from '@/test-utils/bound';

describe('Textarea (base, pure shadcn)', () => {
  it('рендерит native textarea с data-slot=textarea', () => {
    expect(renderToStaticMarkup(<Textarea />)).toContain('data-slot="textarea"');
  });

  it('rows прокидывается', () => {
    expect(renderToStaticMarkup(<Textarea rows={5} />)).toContain('rows="5"');
  });
});

describe('Textarea (field-версия)', () => {
  it('value → текстовое содержимое textarea', () => {
    const html = renderToStaticMarkup(<Bound component={Textarea} value="привет" />);
    expect(html).toContain('привет');
    expect(html).toContain('data-slot="textarea"');
  });

  it('value=null → пустое поле (адаптер отдаёт "")', () => {
    const html = renderToStaticMarkup(<Bound component={Textarea} value={null} />);
    expect(html).toContain('></textarea>');
  });

  it('прокидывает aria/id на textarea (seam-контракт)', () => {
    const html = renderToStaticMarkup(
      <Bound component={Textarea} value="x" id="control-a" aria-labelledby="label-a" aria-invalid />
    );
    expect(html).toContain('id="control-a"');
    expect(html).toContain('aria-labelledby="label-a"');
  });
  it('readOnly доезжает до DOM: значение видно, ввод закрыт', () => {
    const html = renderToStaticMarkup(<Bound component={Textarea} value="строка" readOnly />);
    expect(html).toMatch(/readonly/i);
  });
});
