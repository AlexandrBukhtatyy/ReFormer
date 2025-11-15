import * as React from 'react';
import { cn } from '@/lib/utils';

export interface InputFilesProps
  extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'value' | 'onChange' | 'type'> {
  className?: string;
  value?: File | File[] | null;
  onChange?: (value: File | File[] | null) => void;
  onBlur?: () => void;
  multiple?: boolean;
  accept?: string;
  disabled?: boolean;
  placeholder?: string;
  maxSize?: number;
  uploader?: {
    upload: (file: File) => Promise<any>;
  };
}

const InputFiles = React.forwardRef<HTMLInputElement, InputFilesProps>(
  (
    {
      className,
      value,
      onChange,
      onBlur,
      multiple = false,
      accept,
      disabled,
      placeholder,
      maxSize,
      uploader,
      ...props
    },
    ref
  ) => {
    const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
      const files = event.target.files;

      if (!files || files.length === 0) {
        onChange?.(null);
        return;
      }

      if (multiple) {
        onChange?.(Array.from(files));
      } else {
        onChange?.(files[0]);
      }
    };

    return (
      <div className="space-y-2">
        {placeholder && (
          <label className="text-sm font-medium text-foreground">{placeholder}</label>
        )}
        <input
          ref={ref}
          type="file"
          multiple={multiple}
          accept={accept}
          disabled={disabled}
          data-slot="input"
          className={cn(
            'file:text-foreground file:bg-muted file:border-0 file:rounded-sm file:px-3 file:py-1 file:text-sm file:font-medium',
            'border-input placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-ring/50',
            'h-9 w-full rounded-md border bg-transparent px-3 py-1 text-sm shadow-xs transition-colors',
            'focus-visible:outline-none focus-visible:ring-[3px]',
            'disabled:cursor-not-allowed disabled:opacity-50',
            'aria-invalid:border-destructive aria-invalid:ring-destructive/20',
            className
          )}
          onChange={handleFileChange}
          onBlur={onBlur}
          {...props}
        />
      </div>
    );
  }
);

InputFiles.displayName = 'InputFiles';

export { InputFiles };
