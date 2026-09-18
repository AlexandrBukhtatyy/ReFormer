import type { ReactNode } from 'react';
import { useAutocompleteContext } from './AutocompleteContext';

/** Props `Autocomplete.Loading`. */
export interface AutocompleteLoadingProps {
  children?: ReactNode;
}

/**
 * Autocomplete.Loading — показывает `children`, пока ресурс грузит подсказки
 * (первичная загрузка или следующая страница).
 */
export function AutocompleteLoading({ children }: AutocompleteLoadingProps) {
  const { loading, loadingMore } = useAutocompleteContext();
  return loading || loadingMore ? <>{children}</> : null;
}

AutocompleteLoading.displayName = 'Autocomplete.Loading';
