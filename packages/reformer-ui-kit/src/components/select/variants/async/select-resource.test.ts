import { describe, it, expect } from 'vitest';
import {
  resolveStrategyFlags,
  normalizeItems,
  mergeOptions,
  filterClient,
  resourceReducer,
  initialResourceState,
  hasMore,
  isNearBottom,
  type NormalizedOption,
  type ResourceResult,
} from './select-resource';

const opt = (id: string | number, label: string, group?: string): NormalizedOption => ({
  id,
  label,
  value: String(id),
  group,
});

describe('resolveStrategyFlags', () => {
  it('static: без поиска и пагинации', () => {
    expect(resolveStrategyFlags('static')).toEqual({
      serverSearch: false,
      paginated: false,
      searchable: false,
    });
  });

  it('preload: клиентский поиск, без пагинации', () => {
    expect(resolveStrategyFlags('preload')).toEqual({
      serverSearch: false,
      paginated: false,
      searchable: true,
    });
  });

  it('partial: серверный поиск + пагинация', () => {
    expect(resolveStrategyFlags('partial')).toEqual({
      serverSearch: true,
      paginated: true,
      searchable: true,
    });
  });

  it('undefined трактуется как static', () => {
    expect(resolveStrategyFlags(undefined)).toEqual(resolveStrategyFlags('static'));
  });
});

describe('normalizeItems', () => {
  it('приводит value к строке и сохраняет group', () => {
    const result = normalizeItems<number | string>([
      { id: 1, label: 'One', value: 1 },
      { id: 2, label: 'Two', value: 'two', group: 'g' },
    ]);
    expect(result).toEqual([
      { id: 1, label: 'One', value: '1', group: undefined },
      { id: 2, label: 'Two', value: 'two', group: 'g' },
    ]);
  });
});

describe('mergeOptions', () => {
  it('аппендит новые и отбрасывает дубли по id', () => {
    const prev = [opt(1, 'One'), opt(2, 'Two')];
    const next = [opt(2, 'Two-dup'), opt(3, 'Three')];
    const merged = mergeOptions(prev, next);
    expect(merged.map((o) => o.id)).toEqual([1, 2, 3]);
    // существующий элемент не перезаписывается новым дублем
    expect(merged.find((o) => o.id === 2)?.label).toBe('Two');
  });

  it('пустой next возвращает prev как есть', () => {
    const prev = [opt(1, 'One')];
    expect(mergeOptions(prev, [])).toEqual(prev);
  });
});

describe('filterClient', () => {
  const options = [opt(1, 'Москва'), opt(2, 'Санкт-Петербург'), opt(3, 'Минск')];

  it('пустой запрос возвращает всё', () => {
    expect(filterClient(options, '')).toEqual(options);
    expect(filterClient(options, '   ')).toEqual(options);
  });

  it('фильтрует по подстроке label, case-insensitive', () => {
    expect(filterClient(options, 'мос').map((o) => o.id)).toEqual([1]);
    expect(filterClient(options, 'ПЕТ').map((o) => o.id)).toEqual([2]);
  });

  it('нет совпадений — пустой список', () => {
    expect(filterClient(options, 'zzz')).toEqual([]);
  });
});

describe('resourceReducer', () => {
  const page1: ResourceResult<string> = {
    items: [
      { id: 1, label: 'One', value: '1' },
      { id: 2, label: 'Two', value: '2' },
    ],
    totalCount: 5,
  };
  const page2: ResourceResult<string> = {
    items: [
      { id: 3, label: 'Three', value: '3' },
      { id: 2, label: 'Two-dup', value: '2' },
    ],
    totalCount: 5,
  };

  it('load-start сбрасывает список и запоминает search', () => {
    const dirty = { ...initialResourceState(), options: [opt(9, 'x')], page: 4 };
    const next = resourceReducer(dirty, { kind: 'load-start', search: 'abc' });
    expect(next.options).toEqual([]);
    expect(next.loading).toBe(true);
    expect(next.search).toBe('abc');
    expect(next.page).toBe(0);
  });

  it('load-success заполняет первую страницу', () => {
    const next = resourceReducer(
      { ...initialResourceState(), loading: true },
      { kind: 'load-success', result: page1, page: 1 }
    );
    expect(next.options.map((o) => o.id)).toEqual([1, 2]);
    expect(next.totalCount).toBe(5);
    expect(next.page).toBe(1);
    expect(next.loading).toBe(false);
  });

  it('load-more-success аппендит следующую страницу с дедупом', () => {
    const afterPage1 = resourceReducer(
      { ...initialResourceState(), loading: true },
      { kind: 'load-success', result: page1, page: 1 }
    );
    const started = resourceReducer(afterPage1, { kind: 'load-more-start' });
    expect(started.loadingMore).toBe(true);
    const afterPage2 = resourceReducer(started, {
      kind: 'load-more-success',
      result: page2,
      page: 2,
    });
    expect(afterPage2.options.map((o) => o.id)).toEqual([1, 2, 3]);
    expect(afterPage2.page).toBe(2);
    expect(afterPage2.loadingMore).toBe(false);
  });

  it('load-error гасит флаги и ставит error', () => {
    const next = resourceReducer(
      { ...initialResourceState(), loading: true },
      { kind: 'load-error' }
    );
    expect(next.loading).toBe(false);
    expect(next.loadingMore).toBe(false);
    expect(next.error).toBe(true);
  });
});

describe('hasMore', () => {
  it('true, пока загружено меньше totalCount', () => {
    expect(hasMore({ ...initialResourceState(), options: [opt(1, 'a')], totalCount: 3 })).toBe(
      true
    );
  });
  it('false, когда всё загружено', () => {
    expect(
      hasMore({ ...initialResourceState(), options: [opt(1, 'a'), opt(2, 'b')], totalCount: 2 })
    ).toBe(false);
  });
});

describe('isNearBottom', () => {
  it('true у нижней границы (с учётом threshold)', () => {
    expect(isNearBottom({ scrollTop: 460, clientHeight: 100, scrollHeight: 600 })).toBe(true);
  });
  it('false далеко от низа', () => {
    expect(isNearBottom({ scrollTop: 0, clientHeight: 100, scrollHeight: 600 })).toBe(false);
  });
});
