import { createContext, useContext } from 'react';
import type { UseAutocompleteReturn } from './useAutocomplete';

/** Значение контекста `Autocomplete` — целиком {@link UseAutocompleteReturn}. */
export type AutocompleteContextValue = UseAutocompleteReturn;

export const AutocompleteContext = createContext<AutocompleteContextValue | null>(null);

/**
 * Хук доступа к контексту `Autocomplete`. Бросает исключение вне `Autocomplete.Root`.
 *
 * @returns Текущее {@link AutocompleteContextValue}.
 * @throws Error если вызван вне `Autocomplete.Root`.
 */
export function useAutocompleteContext(): AutocompleteContextValue {
  const context = useContext(AutocompleteContext);
  if (!context) {
    throw new Error(
      'Autocomplete.* components must be used within <Autocomplete.Root>. ' +
        'Wrap your slots with <Autocomplete.Root>.'
    );
  }
  return context;
}
