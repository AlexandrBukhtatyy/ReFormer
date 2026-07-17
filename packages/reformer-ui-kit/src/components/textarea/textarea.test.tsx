import { describe, it, expect } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { Textarea, TextareaField } from './index';

describe('Textarea (base, pure shadcn)', () => {
  it('рендерит native textarea с data-slot=textarea', () => {
    expect(renderToStaticMarkup(<Textarea />)).toContain('data-slot="textarea"');
  });

  it('rows прокидывается', () => {
    expect(renderToStaticMarkup(<Textarea rows={5} />)).toContain('rows="5"');
  });
});

describe('TextareaField (field-версия)', () => {
  it('value → текстовое содержимое textarea', () => {
    const html = renderToStaticMarkup(<TextareaField value="привет" />);
    expect(html).toContain('привет');
    expect(html).toContain('data-slot="textarea"');
  });

  it('value=null → пустое поле (адаптер отдаёт "")', () => {
    const html = renderToStaticMarkup(<TextareaField value={null} />);
    expect(html).toContain('></textarea>');
  });

  it('strip control: renderer-путь не течёт в DOM', () => {
    const html = renderToStaticMarkup(<TextareaField value="x" control={{ id: 1 } as never} />);
    expect(html).not.toContain('[object Object]');
  });

  it('прокидывает aria/id на textarea (seam-контракт)', () => {
    const html = renderToStaticMarkup(
      <TextareaField value="x" id="control-a" aria-labelledby="label-a" aria-invalid />
    );
    expect(html).toContain('id="control-a"');
    expect(html).toContain('aria-labelledby="label-a"');
  });
});
