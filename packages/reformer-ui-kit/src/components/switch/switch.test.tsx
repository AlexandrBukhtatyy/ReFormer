import { describe, it, expect } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { Switch, SwitchField } from './index';

describe('Switch (base, pure shadcn)', () => {
  it('рендерит role=switch с data-slot=switch и дефолтным data-size', () => {
    const html = renderToStaticMarkup(<Switch />);
    expect(html).toContain('data-slot="switch"');
    expect(html).toContain('role="switch"');
    expect(html).toContain('data-size="default"');
  });

  it('size прокидывается в data-size', () => {
    expect(renderToStaticMarkup(<Switch size="sm" />)).toContain('data-size="sm"');
  });
});

describe('SwitchField (inline-label, boolean value-based)', () => {
  it('reformerLayout=inline-label (FormField не рисует верхнюю подпись)', () => {
    expect((SwitchField as { reformerLayout?: string }).reformerLayout).toBe('inline-label');
  });

  it('value=true → data-state=checked на Root примитива', () => {
    const html = renderToStaticMarkup(<SwitchField value={true} />);
    expect(html).toContain('data-slot="switch"');
    expect(html).toContain('data-state="checked"');
  });

  it('value=false → data-state=unchecked', () => {
    expect(renderToStaticMarkup(<SwitchField value={false} />)).toContain('data-state="unchecked"');
  });

  it('value=undefined (null-coerce) → unchecked, без падения', () => {
    expect(renderToStaticMarkup(<SwitchField />)).toContain('data-state="unchecked"');
  });

  it('label рендерится справа связанным <label> (data-slot=label)', () => {
    const html = renderToStaticMarkup(<SwitchField value={false} label="Push-уведомления" />);
    expect(html).toContain('Push-уведомления');
    expect(html).toContain('data-slot="label"');
    expect(html).toContain('<label');
  });

  it('без label подпись не рендерится (только контрол)', () => {
    const html = renderToStaticMarkup(<SwitchField value={false} />);
    expect(html).not.toContain('data-slot="label"');
  });

  it('data-testid сидит на Root примитива, НЕ на обёртке-div', () => {
    const html = renderToStaticMarkup(<SwitchField value={false} data-testid="input-notify" />);
    const wrapperTag = html.slice(0, html.indexOf('>') + 1);
    expect(wrapperTag.startsWith('<div')).toBe(true);
    expect(wrapperTag).not.toContain('data-testid'); // не на wrapper
    expect(html).toContain('data-testid="input-notify"'); // на Root
  });

  it('strip control: renderer-путь не течёт в DOM', () => {
    const html = renderToStaticMarkup(<SwitchField value={true} control={{ id: 1 } as never} />);
    expect(html).not.toContain('[object Object]');
    expect(html).not.toContain('control=');
  });

  it('прокидывает id/aria-* на контрол (seam-контракт)', () => {
    const html = renderToStaticMarkup(
      <SwitchField value={false} id="control-a" aria-describedby="desc-a" aria-invalid />
    );
    expect(html).toContain('id="control-a"');
    expect(html).toContain('aria-describedby="desc-a"');
  });
});
