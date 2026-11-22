import { describe, it, expect } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { Icon } from './index';

describe('Icon (base)', () => {
  it('рисует иконку lucide по имени с data-slot; неизвестное имя — ничего', () => {
    expect(renderToStaticMarkup(<Icon iconName="House" />)).toContain('data-slot="icon"');
    expect(renderToStaticMarkup(<Icon iconName="NoSuchIcon" />)).toBe('');
  });

  it('по умолчанию декоративная: aria-hidden, без роли', () => {
    const html = renderToStaticMarkup(<Icon iconName="House" />);
    expect(html).toContain('aria-hidden="true"');
    expect(html).not.toContain('role=');
  });

  it('title даёт доступное имя: <title> внутри svg, role="img", без aria-hidden', () => {
    const html = renderToStaticMarkup(<Icon iconName="House" title="Главная" />);
    expect(html).toContain('<title>Главная</title>');
    expect(html).toContain('role="img"');
    expect(html).not.toContain('aria-hidden');
  });

  it('aria-label доходит до svg и снимает aria-hidden', () => {
    const html = renderToStaticMarkup(<Icon iconName="House" aria-label="Главная" />);
    expect(html).toContain('aria-label="Главная"');
    expect(html).toContain('role="img"');
    expect(html).not.toContain('aria-hidden');
  });

  it('прокидывает style и data-* на svg', () => {
    const html = renderToStaticMarkup(
      <Icon iconName="House" style={{ marginTop: 2 }} data-testid="icon-home" />
    );
    expect(html).toContain('data-testid="icon-home"');
    expect(html).toContain('margin-top:2px');
  });
});
