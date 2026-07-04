import { describe, it, expect } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { Checkbox } from './checkbox';

/** Достаёт значение атрибута из отрендеренной строки HTML. */
function attr(html: string, name: string): string | null {
  const m = html.match(new RegExp(`${name}="([^"]*)"`));
  return m ? m[1] : null;
}

describe('Checkbox a11y — связка label с input', () => {
  it('внутренняя <label> связана с input через htmlFor=id (клик по метке переключает)', () => {
    const html = renderToStaticMarkup(<Checkbox label="Согласен с условиями" />);
    const inputId = attr(html, 'id');
    const labelFor = attr(html, 'for');
    expect(inputId).toBeTruthy();
    expect(labelFor).toBe(inputId);
  });

  it('использует переданный id (ids.controlId из FormFieldControl) как цель htmlFor', () => {
    const html = renderToStaticMarkup(<Checkbox label="Согласен" id="control-abc" />);
    expect(attr(html, 'id')).toBe('control-abc');
    expect(attr(html, 'for')).toBe('control-abc');
  });

  it('сбрасывает висячий aria-labelledby, когда рендерит собственную <label>', () => {
    // В потоке ui-kit FormField верхний Label для чекбокса не рендерится, поэтому
    // aria-labelledby={label-...} указывает в пустоту — его нужно убрать.
    const html = renderToStaticMarkup(
      <Checkbox label="Согласен" id="control-abc" aria-labelledby="label-abc" />
    );
    expect(html).not.toContain('aria-labelledby');
    // доступное имя теперь берётся из связанной <label>
    expect(attr(html, 'for')).toBe('control-abc');
    expect(html).toContain('Согласен');
  });

  it('без внутренней метки сохраняет переданный aria-labelledby (внешняя подпись — на потребителе)', () => {
    const html = renderToStaticMarkup(<Checkbox aria-labelledby="external-label" />);
    expect(attr(html, 'aria-labelledby')).toBe('external-label');
  });

  it('несёт класс-вариант aria-invalid для стилизации ошибки', () => {
    const html = renderToStaticMarkup(<Checkbox label="x" aria-invalid />);
    expect(html).toContain('aria-invalid:border-destructive');
  });
});
