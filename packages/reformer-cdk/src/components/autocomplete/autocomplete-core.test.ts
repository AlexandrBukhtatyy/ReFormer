import { describe, it, expect } from 'vitest';
import {
  autocompleteReducer,
  initialAutocompleteState,
  isSuggestionResource,
  matchSuggestions,
  normalizeSuggestions,
  type AutocompleteState,
} from './autocomplete-core';

const closed = initialAutocompleteState();
const openAt = (activeIndex: number): AutocompleteState => ({ open: true, activeIndex });

describe('autocompleteReducer', () => {
  it('ввод раскрывает список и сбрасывает подсветку', () => {
    expect(autocompleteReducer(openAt(2), { type: 'input' })).toEqual(openAt(-1));
    expect(autocompleteReducer(closed, { type: 'input' })).toEqual(openAt(-1));
  });

  it('↓ на закрытом списке раскрывает его с первой подсказки, ↑ — с последней', () => {
    expect(autocompleteReducer(closed, { type: 'move', delta: 1, count: 3 })).toEqual(openAt(0));
    expect(autocompleteReducer(closed, { type: 'move', delta: -1, count: 3 })).toEqual(openAt(2));
  });

  it('навигация циклическая', () => {
    expect(autocompleteReducer(openAt(2), { type: 'move', delta: 1, count: 3 })).toEqual(openAt(0));
    expect(autocompleteReducer(openAt(0), { type: 'move', delta: -1, count: 3 })).toEqual(
      openAt(2)
    );
  });

  it('close сбрасывает всё, повторный close возвращает тот же объект', () => {
    expect(autocompleteReducer(openAt(1), { type: 'close' })).toEqual(closed);
    expect(autocompleteReducer(closed, { type: 'close' })).toBe(closed);
  });

  it('open не трогает уже открытый список', () => {
    const s = openAt(1);
    expect(autocompleteReducer(s, { type: 'open' })).toBe(s);
    expect(autocompleteReducer(closed, { type: 'open' })).toEqual(openAt(-1));
  });

  it('сужение списка сбрасывает подсветку за его пределами', () => {
    expect(autocompleteReducer(openAt(4), { type: 'items', count: 2 })).toEqual(openAt(-1));
    const s = openAt(1);
    expect(autocompleteReducer(s, { type: 'items', count: 2 })).toBe(s);
  });

  it('highlight меняет подсветку', () => {
    expect(autocompleteReducer(openAt(0), { type: 'highlight', index: 2 })).toEqual(openAt(2));
  });
});

describe('normalizeSuggestions', () => {
  it('строки и объекты; label по умолчанию = value; дубли по value отбрасываются', () => {
    expect(
      normalizeSuggestions([
        'Москва',
        { value: 'spb', label: 'Санкт-Петербург' },
        { value: 'Казань' },
        'Москва',
      ])
    ).toEqual([
      { id: 'Москва', value: 'Москва', label: 'Москва' },
      { id: 'spb', value: 'spb', label: 'Санкт-Петербург' },
      { id: 'Казань', value: 'Казань', label: 'Казань' },
    ]);
  });
});

describe('matchSuggestions', () => {
  const options = normalizeSuggestions(['Москва', 'Мурманск', 'Казань']);

  it('по умолчанию — подстрока label без учёта регистра', () => {
    expect(matchSuggestions(options, 'мУ').map((o) => o.value)).toEqual(['Мурманск']);
    expect(matchSuggestions(options, 'а').map((o) => o.value)).toEqual([
      'Москва',
      'Мурманск',
      'Казань',
    ]);
  });

  it('пустой текст показывает все подсказки', () => {
    expect(matchSuggestions(options, '')).toHaveLength(3);
  });

  it('minChars прячет подсказки для короткого текста', () => {
    expect(matchSuggestions(options, 'М', { minChars: 2 })).toEqual([]);
    expect(matchSuggestions(options, 'Мо', { minChars: 2 })).toHaveLength(1);
  });

  it('единственная подсказка, совпадающая с текстом, не показывается', () => {
    expect(matchSuggestions(options, 'Москва')).toEqual([]);
  });

  it('свой filter заменяет встроенный', () => {
    const startsWith = (o: { label: string }, q: string) =>
      o.label.toLowerCase().startsWith(q.toLowerCase());
    expect(matchSuggestions(options, 'а', { filter: startsWith })).toEqual([]);
    expect(matchSuggestions(options, 'к', { filter: startsWith }).map((o) => o.value)).toEqual([
      'Казань',
    ]);
  });

  it('clientFilter=false доверяет серверной фильтрации', () => {
    expect(matchSuggestions(options, 'zzz', { clientFilter: false })).toHaveLength(3);
  });
});

describe('isSuggestionResource', () => {
  it('массив — статика, объект — ресурс', () => {
    expect(isSuggestionResource(['a'])).toBe(false);
    expect(isSuggestionResource(null)).toBe(false);
    expect(
      isSuggestionResource({ type: 'partial', load: async () => ({ items: [], totalCount: 0 }) })
    ).toBe(true);
  });
});
