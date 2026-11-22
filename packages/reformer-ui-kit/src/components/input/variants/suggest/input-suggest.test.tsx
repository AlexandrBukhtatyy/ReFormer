/**
 * Статический рендер InputSuggest: разметка combobox и связка с формой (адаптер из статики).
 * Клавиатура/мышь — в cdk (`autocomplete-core.test.ts`) и e2e.
 */
import { describe, it, expect } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { InputSuggest } from '../../index';
import { Bound } from '@/test-utils/bound';

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

describe('InputSuggest в форме (textValueAdapter)', () => {
  it('рендерит combobox со значением поля', () => {
    const html = renderToStaticMarkup(
      <Bound component={InputSuggest} value="x" suggestions={['a']} />
    );
    expect(html).toContain('role="combobox"');
    expect(html).toContain('value="x"');
  });

  it('value=null → пустое поле; настройки подсказок в DOM не текут', () => {
    const html = renderToStaticMarkup(
      <Bound component={InputSuggest} value={null} suggestions={['a']} minChars={2} openOnFocus />
    );
    expect(html).toContain('value=""');
    expect(html).not.toMatch(/minchars|openonfocus/i);
  });
});
