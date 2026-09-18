// Main compound component
export { Autocomplete, type AutocompleteComponent } from './Autocomplete';

// Sub-components (also available as Autocomplete.Input, etc.)
export { AutocompleteRoot, type AutocompleteRootProps } from './AutocompleteRoot';
export { AutocompleteInput, type AutocompleteInputProps } from './AutocompleteInput';
export { AutocompleteListbox, type AutocompleteListboxProps } from './AutocompleteListbox';
export { AutocompleteOption, type AutocompleteOptionProps } from './AutocompleteOption';
export { AutocompleteLoading, type AutocompleteLoadingProps } from './AutocompleteLoading';

// Hook
export {
  useAutocomplete,
  type UseAutocompleteOptions,
  type UseAutocompleteReturn,
  type AutocompleteIds,
} from './useAutocomplete';

// Context
export {
  AutocompleteContext,
  useAutocompleteContext,
  type AutocompleteContextValue,
} from './AutocompleteContext';

// Pure core (React-free)
export {
  autocompleteReducer,
  initialAutocompleteState,
  isSuggestionResource,
  normalizeSuggestions,
  matchSuggestions,
  type AutocompleteState,
  type AutocompleteAction,
  type AutocompleteSuggestionItem,
  type AutocompleteSuggestionList,
  type AutocompleteSuggestions,
  type AutocompleteFilter,
  type MatchSuggestionsOptions,
} from './autocomplete-core';
