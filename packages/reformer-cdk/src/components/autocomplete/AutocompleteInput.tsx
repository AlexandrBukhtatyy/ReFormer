import { forwardRef, type InputHTMLAttributes } from 'react';
import { Slot } from '../form-wizard/Slot';
import { useAutocompleteContext } from './AutocompleteContext';

/** Props `Autocomplete.Input`. `value`/`onChange` приходят из `Autocomplete.Root`. */
export interface AutocompleteInputProps extends Omit<
  InputHTMLAttributes<HTMLInputElement>,
  'value' | 'defaultValue'
> {
  /** Рендерить собственный элемент вместо `<input>` (пропсы мержатся в него). */
  asChild?: boolean;
}

/**
 * Autocomplete.Input — поле ввода с ролью `combobox`. Свои обработчики (`onKeyDown`, `onBlur`…)
 * вызываются перед встроенными; `preventDefault()` в `onKeyDown` отключает встроенную клавиатуру.
 */
export const AutocompleteInput = forwardRef<HTMLInputElement, AutocompleteInputProps>(
  function AutocompleteInput({ asChild, children, ...props }, ref) {
    const { getInputProps } = useAutocompleteContext();
    if (asChild) {
      return (
        <Slot ref={ref} {...(getInputProps(props) as Record<string, unknown>)}>
          {children}
        </Slot>
      );
    }
    return <input ref={ref} {...getInputProps(props)} />;
  }
);

AutocompleteInput.displayName = 'Autocomplete.Input';
