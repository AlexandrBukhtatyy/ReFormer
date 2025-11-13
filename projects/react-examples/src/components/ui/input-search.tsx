import * as React from 'react';
import { SearchIcon, XIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { ResourceConfig } from 'reformer';

export interface InputSearchProps
  extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'value' | 'onChange' | 'resource'> {
  className?: string;
  value?: string | null;
  onChange?: (value: string | null) => void;
  onBlur?: () => void;
  resource?: ResourceConfig;
  placeholder?: string;
  disabled?: boolean;
  debounce?: number;
}

const InputSearch = React.forwardRef<HTMLInputElement, InputSearchProps>(
  (
    {
      className,
      value = '',
      onChange,
      onBlur,
      resource,
      placeholder = 'Search...',
      disabled,
      debounce = 300,
      ...props
    },
    ref
  ) => {
    const [suggestions, setSuggestions] = React.useState<any[]>([]);
    const [loading, setLoading] = React.useState(false);
    const [showSuggestions, setShowSuggestions] = React.useState(false);
    const [inputValue, setInputValue] = React.useState(value || '');
    const timeoutRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);

    // Синхронизируем внутреннее значение с внешним
    React.useEffect(() => {
      setInputValue(value || '');
    }, [value]);

    const handleInputChange = (event: React.ChangeEvent<HTMLInputElement>) => {
      const newValue = event.target.value;
      setInputValue(newValue);
      onChange?.(newValue || null);

      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }

      if (resource && newValue.trim()) {
        timeoutRef.current = setTimeout(async () => {
          setLoading(true);
          try {
            const response = await resource.load({ search: newValue });
            setSuggestions(response.items);
            setShowSuggestions(true);
          } catch (error) {
            setSuggestions([]);
          } finally {
            setLoading(false);
          }
        }, debounce);
      } else {
        setSuggestions([]);
        setShowSuggestions(false);
      }
    };

    const handleSuggestionClick = (suggestion: any) => {
      const selectedValue = suggestion.label || suggestion.value;
      setInputValue(selectedValue);
      onChange?.(selectedValue);
      setShowSuggestions(false);
      setSuggestions([]);
    };

    const handleClear = () => {
      setInputValue('');
      onChange?.(null);
      setSuggestions([]);
      setShowSuggestions(false);
    };

    const handleBlur = () => {
      setTimeout(() => setShowSuggestions(false), 200);
      onBlur?.();
    };

    return (
      <div className="relative">
        <div className="relative">
          <SearchIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground size-4" />
          <input
            ref={ref}
            type="text"
            value={inputValue}
            disabled={disabled}
            placeholder={placeholder}
            data-slot="input"
            className={cn(
              'pl-10 pr-10 py-2 h-9 w-full rounded-md border border-input bg-transparent text-sm shadow-xs transition-colors',
              'placeholder:text-muted-foreground',
              'focus-visible:outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]',
              'disabled:cursor-not-allowed disabled:opacity-50',
              'aria-invalid:border-destructive aria-invalid:ring-destructive/20',
              className
            )}
            onChange={handleInputChange}
            onFocus={() => {
              if (suggestions.length > 0) setShowSuggestions(true);
            }}
            onBlur={handleBlur}
            {...props}
          />

          {/* Clear button */}
          {inputValue && !loading && (
            <button
              type="button"
              className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors bg-transparent border-none p-0 cursor-pointer focus:outline-none"
              onClick={handleClear}
              disabled={disabled}
              aria-label="Clear search"
              style={{ background: 'transparent', border: 'none', padding: 0 }}
            >
              <XIcon className="size-4" />
            </button>
          )}

          {/* Loading spinner */}
          {loading && (
            <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-primary"></div>
            </div>
          )}
        </div>

        {showSuggestions && suggestions.length > 0 && (
          <div className="absolute z-50 w-full mt-1 bg-white border border-gray-300 rounded-md shadow-md max-h-60 overflow-auto">
            {suggestions.map((suggestion, index) => (
              <div
                key={suggestion.id || index}
                className="px-3 py-2 hover:bg-gray-100 hover:text-gray-900 cursor-pointer text-sm"
                onMouseDown={(e) => {
                  e.preventDefault(); // Prevent input blur
                  handleSuggestionClick(suggestion);
                }}
              >
                <div className="font-medium">{suggestion.label}</div>
                {suggestion.description && (
                  <div className="text-xs text-gray-500">{suggestion.description}</div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }
);

InputSearch.displayName = 'InputSearch';

export { InputSearch };
