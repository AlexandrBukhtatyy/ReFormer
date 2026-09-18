/**
 * Статический рендер Input с подсказками: разметка combobox и маршрутизация диспетчера InputField.
 * Клавиатура/мышь — в cdk (`autocomplete-core.test.ts`) и e2e.
 */
import { describe, it, expect } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { InputField, InputSuggest } from '../../index';

describe('InputSuggest', () => {
  it('shadcn Input с ролью combobox и свободным текстом', () => {
    const html = renderToStaticMarkup(
      <InputSuggest id="city" value="Мос" suggestions={['Москва']} placeholder="Город" />
    );
    expect(html).toContain('data-slot="input"');
    expect(html).toContain('role="combobox"');
    expect(html).toContain('aria-expanded="false"');
    expect(html).toContain('value="Мос"');
    expect(html).toContain('placeholder="Город"');
  });

  it('value=null → пустое поле', () => {
    expect(renderToStaticMarkup(<InputSuggest value={null} suggestions={[]} />)).toContain(
      'value=""'
    );
  });
});

describe('InputField — диспетчер по suggestions', () => {
  it('suggestions задан → combobox', () => {
    const html = renderToStaticMarkup(<InputField value="x" suggestions={['a']} />);
    expect(html).toContain('role="combobox"');
  });

  it('без suggestions — обычный input, настройки подсказок в DOM не текут', () => {
    const html = renderToStaticMarkup(<InputField value="x" minChars={2} openOnFocus />);
    expect(html).not.toContain('role="combobox"');
    expect(html).not.toMatch(/minchars|openonfocus/i);
  });

  it('type=number игнорирует suggestions', () => {
    const html = renderToStaticMarkup(<InputField type="number" value={1} suggestions={['1']} />);
    expect(html).toContain('type="number"');
    expect(html).not.toContain('role="combobox"');
    expect(html).not.toContain('suggestions');
  });
});
