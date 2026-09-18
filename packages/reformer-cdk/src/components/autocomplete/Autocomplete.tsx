import { AutocompleteRoot } from './AutocompleteRoot';
import { AutocompleteInput } from './AutocompleteInput';
import { AutocompleteListbox } from './AutocompleteListbox';
import { AutocompleteOption } from './AutocompleteOption';
import { AutocompleteLoading } from './AutocompleteLoading';

export type AutocompleteComponent = typeof AutocompleteRoot & {
  Root: typeof AutocompleteRoot;
  Input: typeof AutocompleteInput;
  Listbox: typeof AutocompleteListbox;
  Option: typeof AutocompleteOption;
  Loading: typeof AutocompleteLoading;
};

/**
 * Autocomplete — headless compound-компонент поля со свободным вводом и подсказками.
 *
 * Значение — всегда введённый текст; выбор подсказки подставляет её `value`. Этим он отличается
 * от выбора из списка (Select / Combobox), где значение обязано быть одной из опций.
 *
 * ## Слоты
 * - `Autocomplete.Root` — провайдер: `value`, `onChange`, `suggestions`, …
 * - `Autocomplete.Input` — поле с ролью `combobox`
 * - `Autocomplete.Listbox` — список, рендерится пока раскрыт
 * - `Autocomplete.Option` — пункт списка
 * - `Autocomplete.Loading` — индикатор загрузки ресурса
 *
 * @example
 * ```tsx
 * import { Autocomplete } from '@reformer/cdk/autocomplete';
 *
 * <Autocomplete.Root value={city} onChange={setCity} suggestions={['Москва', 'Казань']}>
 *   <Autocomplete.Input placeholder="Город" />
 *   <Autocomplete.Listbox className="dropdown">
 *     {(items) =>
 *       items.map((item, i) => <Autocomplete.Option key={item.id} item={item} index={i} />)
 *     }
 *   </Autocomplete.Listbox>
 * </Autocomplete.Root>
 * ```
 *
 * @see {@link useAutocomplete} — то же без compound-дерева.
 */
export const Autocomplete = AutocompleteRoot as AutocompleteComponent;

Autocomplete.Root = AutocompleteRoot;
Autocomplete.Input = AutocompleteInput;
Autocomplete.Listbox = AutocompleteListbox;
Autocomplete.Option = AutocompleteOption;
Autocomplete.Loading = AutocompleteLoading;
