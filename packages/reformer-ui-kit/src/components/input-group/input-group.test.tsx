import { describe, it, expect } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupText,
  InputGroupInput,
  InputGroupTextarea,
} from './index';

// Не-F презентационная композиция (обёртка контролов с аддонами). Всё рендерится инлайн
// (без Portal) — тестируем статический SSR-вывод: data-slot, role, data-align, passthrough.
describe('InputGroup (base)', () => {
  it('InputGroup — div с data-slot="input-group" и role="group"', () => {
    const html = renderToStaticMarkup(<InputGroup />);
    expect(html).toContain('data-slot="input-group"');
    expect(html).toContain('role="group"');
    expect(html).toContain('<div');
  });

  it('InputGroupInput — рендерит input с data-slot="input-group-control" (перекрывает data-slot="input")', () => {
    const html = renderToStaticMarkup(
      <InputGroup>
        <InputGroupInput placeholder="Поиск" />
      </InputGroup>
    );
    expect(html).toContain('data-slot="input-group-control"');
    expect(html).toContain('placeholder="Поиск"');
    expect(html).not.toContain('data-slot="input"');
  });

  it('InputGroupTextarea — рендерит textarea с data-slot="input-group-control"', () => {
    const html = renderToStaticMarkup(
      <InputGroup>
        <InputGroupTextarea placeholder="Комментарий" />
      </InputGroup>
    );
    expect(html).toContain('<textarea');
    expect(html).toContain('data-slot="input-group-control"');
    expect(html).toContain('placeholder="Комментарий"');
  });

  it('InputGroupAddon — по умолчанию data-align="inline-start", data-slot="input-group-addon", role="group"', () => {
    const html = renderToStaticMarkup(
      <InputGroup>
        <InputGroupAddon>@</InputGroupAddon>
      </InputGroup>
    );
    expect(html).toContain('data-slot="input-group-addon"');
    expect(html).toContain('data-align="inline-start"');
    expect(html).toContain('role="group"');
  });

  it('InputGroupAddon — align="inline-end" проставляет data-align="inline-end"', () => {
    const html = renderToStaticMarkup(
      <InputGroup>
        <InputGroupAddon align="inline-end">.com</InputGroupAddon>
      </InputGroup>
    );
    expect(html).toContain('data-align="inline-end"');
  });

  it('InputGroupButton — рендерит button (type="button", variant="ghost", data-size="xs")', () => {
    const html = renderToStaticMarkup(
      <InputGroup>
        <InputGroupInput />
        <InputGroupAddon align="inline-end">
          <InputGroupButton>OK</InputGroupButton>
        </InputGroupAddon>
      </InputGroup>
    );
    expect(html).toContain('data-slot="button"');
    expect(html).toContain('type="button"');
    expect(html).toContain('data-variant="ghost"');
    expect(html).toContain('data-size="xs"');
    expect(html).toContain('>OK</button>');
  });

  it('InputGroupText — рендерит span с текстовым префиксом', () => {
    const html = renderToStaticMarkup(
      <InputGroup>
        <InputGroupAddon>
          <InputGroupText>https://</InputGroupText>
        </InputGroupAddon>
        <InputGroupInput />
      </InputGroup>
    );
    expect(html).toContain('<span');
    expect(html).toContain('>https://</span>');
  });

  it('прокидывает произвольные props (data-testid, aria-invalid)', () => {
    const html = renderToStaticMarkup(
      <InputGroup data-testid="ig">
        <InputGroupInput aria-invalid data-testid="ig-input" />
      </InputGroup>
    );
    expect(html).toContain('data-testid="ig"');
    expect(html).toContain('data-testid="ig-input"');
    expect(html).toContain('aria-invalid="true"');
  });

  it('все под-компоненты экспортируются', () => {
    expect(typeof InputGroup).toBe('function');
    expect(typeof InputGroupAddon).toBe('function');
    expect(typeof InputGroupButton).toBe('function');
    expect(typeof InputGroupText).toBe('function');
    expect(typeof InputGroupInput).toBe('function');
    expect(typeof InputGroupTextarea).toBe('function');
  });
});
