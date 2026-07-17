import { describe, it, expect } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { Checkbox, CheckboxField } from './index';

describe('Checkbox (base, pure shadcn Radix)', () => {
  it('рендерит Root (button role=checkbox) с data-slot=checkbox', () => {
    const html = renderToStaticMarkup(<Checkbox />);
    expect(html).toContain('role="checkbox"');
    expect(html).toContain('data-slot="checkbox"');
    expect(html).toContain('data-state="unchecked"');
  });

  it('checked → data-state=checked + индикатор с CheckIcon', () => {
    const html = renderToStaticMarkup(<Checkbox checked />);
    expect(html).toContain('data-state="checked"');
    expect(html).toContain('data-slot="checkbox-indicator"');
    expect(html).toContain('lucide-check');
  });
});

describe('CheckboxField (field, inline-label)', () => {
  it('value=true → отмечен (data-state=checked)', () => {
    const html = renderToStaticMarkup(<CheckboxField value={true} label="Согласен" />);
    expect(html).toContain('data-state="checked"');
  });

  it('value=false → снят; null трактуется как false', () => {
    expect(renderToStaticMarkup(<CheckboxField value={false} label="X" />)).toContain(
      'data-state="unchecked"'
    );
    expect(renderToStaticMarkup(<CheckboxField value={null} label="X" />)).toContain(
      'data-state="unchecked"'
    );
  });

  it('рисует подпись СПРАВА от чекбокса (label после Root)', () => {
    const html = renderToStaticMarkup(<CheckboxField value={false} label="Согласен с условиями" />);
    // Root (button) идёт раньше текста подписи внутри общей <label>.
    expect(html).toMatch(/data-slot="checkbox"[\s\S]*Согласен с условиями/);
    expect(html).toContain('<label');
  });

  it('data-testid ложится на Root примитива (не на wrapper / bubble-input)', () => {
    const html = renderToStaticMarkup(
      <CheckboxField value={false} label="X" data-testid="agree" />
    );
    // data-testid — внутри тега с data-slot=checkbox (Root button), а не на скрытом bubble-input.
    expect(html).toMatch(/data-slot="checkbox"[^>]*data-testid="agree"/);
    // Единственное вхождение — на Root (aria-hidden input его не несёт).
    expect(html.match(/data-testid="agree"/g)).toHaveLength(1);
  });

  it('htmlFor↔id связывают <label> и Root (a11y)', () => {
    const html = renderToStaticMarkup(<CheckboxField value={false} label="X" id="ctrl-a" />);
    expect(html).toContain('for="ctrl-a"');
    expect(html).toContain('id="ctrl-a"');
  });

  it('подпись задаёт доступное имя: висячий aria-labelledby сбрасывается', () => {
    const html = renderToStaticMarkup(
      <CheckboxField value={false} label="X" aria-labelledby="label-a" />
    );
    expect(html).not.toContain('aria-labelledby');
  });

  it('без подписи aria-labelledby пробрасывается (имя — снаружи)', () => {
    const html = renderToStaticMarkup(<CheckboxField value={false} aria-labelledby="label-a" />);
    expect(html).toContain('aria-labelledby="label-a"');
  });

  it('прокидывает aria-describedby/aria-invalid на Root (seam-контракт)', () => {
    const html = renderToStaticMarkup(
      <CheckboxField value={false} label="X" aria-describedby="desc-a" aria-invalid />
    );
    expect(html).toContain('aria-describedby="desc-a"');
    expect(html).toContain('aria-invalid');
  });

  it('strip control: renderer-путь не течёт в DOM', () => {
    const html = renderToStaticMarkup(
      <CheckboxField value={false} label="X" control={{ id: 1 } as never} />
    );
    expect(html).not.toContain('[object Object]');
  });

  it('выставляет статический маркер reformerLayout=inline-label', () => {
    expect((CheckboxField as { reformerLayout?: string }).reformerLayout).toBe('inline-label');
  });
});
