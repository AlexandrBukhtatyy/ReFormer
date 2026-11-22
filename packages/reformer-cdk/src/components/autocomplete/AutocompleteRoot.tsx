import type { ReactNode } from 'react';
import { AutocompleteContext } from './AutocompleteContext';
import { useAutocomplete, type UseAutocompleteOptions } from './useAutocomplete';

/** Props `Autocomplete.Root`: опции {@link useAutocomplete} + дерево слотов. */
export interface AutocompleteRootProps extends UseAutocompleteOptions {
  children?: ReactNode;
}

/**
 * Autocomplete.Root — провайдер состояния автокомплита. Разметки не рендерит.
 */
export function AutocompleteRoot({ children, ...options }: AutocompleteRootProps) {
  const value = useAutocomplete(options);
  return <AutocompleteContext.Provider value={value}>{children}</AutocompleteContext.Provider>;
}

AutocompleteRoot.displayName = 'Autocomplete.Root';
