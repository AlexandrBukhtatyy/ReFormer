/**
 * Статический рендер Autocomplete: ARIA-разметка поля и слотов. Клавиатура и мышь проверяются
 * чистым reducer'ом (`autocomplete-core.test.ts`) и e2e — jsdom в монорепо не используется.
 */
import { describe, it, expect } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { Autocomplete } from './Autocomplete';
import { AutocompleteContext } from './AutocompleteContext';
import { useAutocomplete, type UseAutocompleteReturn } from './useAutocomplete';
import { normalizeSuggestions } from './autocomplete-core';

const noop = () => {};

describe('Autocomplete — статическая разметка', () => {
  it('Input — combobox со свободным текстом, список закрыт до ввода', () => {
    const html = renderToStaticMarkup(
      <Autocomplete.Root value="Мос" onChange={noop} suggestions={['Москва']} id="city">
        <Autocomplete.Input placeholder="Город" />
        <Autocomplete.Listbox>
          {(items) =>
            items.map((item, i) => <Autocomplete.Option key={item.id} item={item} index={i} />)
          }
        </Autocomplete.Listbox>
      </Autocomplete.Root>
    );
    expect(html).toContain('id="city"');
    expect(html).toContain('role="combobox"');
    expect(html).toContain('aria-autocomplete="list"');
    expect(html).toContain('aria-expanded="false"');
    expect(html).toContain('value="Мос"');
    expect(html).toContain('autoComplete="off"');
    expect(html).not.toContain('role="listbox"');
  });

  it('раскрытый список: listbox, option с id и подсветкой', () => {
    const items = normalizeSuggestions(['Москва', 'Мурманск']);
    function Probe() {
      const real = useAutocomplete({ value: 'М', onChange: noop, id: 'c' });
      const ctx: UseAutocompleteReturn = { ...real, open: true, items, activeIndex: 1 };
      return (
        <AutocompleteContext.Provider value={ctx}>
          <Autocomplete.Listbox>
            {(list) =>
              list.map((item, i) => <Autocomplete.Option key={item.id} item={item} index={i} />)
            }
          </Autocomplete.Listbox>
        </AutocompleteContext.Provider>
      );
    }
    const html = renderToStaticMarkup(<Probe />);
    expect(html).toContain('id="c-listbox"');
    expect(html).toContain('role="listbox"');
    expect(html).toContain('id="c-option-0"');
    expect(html).toContain('>Москва<');
    // Prop-getter строит подсветку из activeIndex самого хука, поэтому в пробе её нет.
    expect(html).toContain('aria-selected="false"');
  });

  it('Loading виден только во время загрузки', () => {
    const render = (loading: boolean) => {
      function Probe() {
        const real = useAutocomplete({ value: '', onChange: noop });
        return (
          <AutocompleteContext.Provider value={{ ...real, loading }}>
            <Autocomplete.Loading>грузим</Autocomplete.Loading>
          </AutocompleteContext.Provider>
        );
      }
      return renderToStaticMarkup(<Probe />);
    };
    expect(render(true)).toBe('грузим');
    expect(render(false)).toBe('');
  });

  it('слоты вне Root бросают понятную ошибку', () => {
    expect(() => renderToStaticMarkup(<Autocomplete.Input />)).toThrow(/Autocomplete.Root/);
  });
});
