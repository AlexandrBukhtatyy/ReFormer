/**
 * Загрузка опций по стратегии ресурса — React-обёртка над чистым редьюсером `option-source.ts`.
 *
 * Общая для Select / SelectMulti из `@reformer/ui-kit` и headless `useAutocomplete`: стратегии,
 * серверный поиск с debounce и пагинация живут здесь, разметка списка — у каждого поля своя.
 * Логика стратегий покрыта `option-source.test.ts`.
 */
import * as React from 'react';

import {
  resolveStrategyFlags,
  resourceReducer,
  initialResourceState,
  filterClient,
  hasMore,
  type ResourceConfig,
  type NormalizedOption,
} from './option-source';
/** Задержка debounce (мс) для серверного поиска в стратегии `partial`. */
const SEARCH_DEBOUNCE_MS = 300;

export interface UseResourceOptionsResult {
  options: NormalizedOption[];
  loading: boolean;
  loadingMore: boolean;
  error: boolean;
  hasMore: boolean;
  loadMore: () => void;
  reload: () => void;
  searchInput: string;
  setSearchInput: (v: string) => void;
  flags: ReturnType<typeof resolveStrategyFlags>;
}

/**
 * Хук управления асинхронным источником опций по стратегии {@link ResourceConfig.type}.
 * Тонкая React-обёртка над чистым reducer из `select-resource.ts` (вся логика стратегий — там).
 */
export function useResourceOptions<T>(resource?: ResourceConfig<T>): UseResourceOptionsResult {
  const flags = React.useMemo(() => resolveStrategyFlags(resource?.type), [resource?.type]);
  const [state, dispatch] = React.useReducer(resourceReducer<T>, undefined, initialResourceState);
  const [searchInput, setSearchInput] = React.useState('');
  const [reloadNonce, setReloadNonce] = React.useState(0);
  const reload = React.useCallback(() => setReloadNonce((n) => n + 1), []);

  // static / preload: одна загрузка при монтировании (searchInput на сервер не влияет).
  React.useEffect(() => {
    if (!resource || flags.serverSearch) return;
    let cancelled = false;
    dispatch({ kind: 'load-start', search: '' });
    resource.load({}).then(
      (result) => {
        if (!cancelled) dispatch({ kind: 'load-success', result, page: 1 });
      },
      () => {
        if (!cancelled) dispatch({ kind: 'load-error' });
      }
    );
    return () => {
      cancelled = true;
    };
  }, [resource, flags.serverSearch, reloadNonce]);

  // partial: серверный поиск с debounce — перезагружает первую страницу.
  React.useEffect(() => {
    if (!resource || !flags.serverSearch) return;
    let cancelled = false;
    const handle = setTimeout(() => {
      dispatch({ kind: 'load-start', search: searchInput });
      resource.load({ search: searchInput, page: 1, pageSize: resource.pageSize }).then(
        (result) => {
          if (!cancelled) dispatch({ kind: 'load-success', result, page: 1 });
        },
        () => {
          if (!cancelled) dispatch({ kind: 'load-error' });
        }
      );
    }, SEARCH_DEBOUNCE_MS);
    return () => {
      cancelled = true;
      clearTimeout(handle);
    };
  }, [resource, flags.serverSearch, searchInput, reloadNonce]);

  const loadMore = React.useCallback(() => {
    if (!resource || !flags.paginated) return;
    if (state.loading || state.loadingMore || !hasMore(state)) return;
    const nextPage = state.page + 1;
    dispatch({ kind: 'load-more-start' });
    resource.load({ search: state.search, page: nextPage, pageSize: resource.pageSize }).then(
      (result) => dispatch({ kind: 'load-more-success', result, page: nextPage }),
      () => dispatch({ kind: 'load-error', more: true })
    );
  }, [resource, flags.paginated, state]);

  const options = flags.serverSearch ? state.options : filterClient(state.options, searchInput);

  return {
    options,
    loading: state.loading,
    loadingMore: state.loadingMore,
    error: state.error,
    hasMore: hasMore(state),
    loadMore,
    reload,
    searchInput,
    setSearchInput,
    flags,
  };
}
