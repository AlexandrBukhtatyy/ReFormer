import * as React from 'react';
import { cn } from '@/lib/utils';

export interface InputFilesProps
  extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'onChange' | 'type'> {
  className?: string;
  onChange?: (value: File | File[] | null) => void;
  onBlur?: () => void;
  multiple?: boolean;
  accept?: string;
  disabled?: boolean;
  placeholder?: string;
  maxSize?: number;
  uploader?: {
    upload: (file: File) => Promise<unknown>;
  };
}

const InputFiles = React.forwardRef<HTMLInputElement, InputFilesProps>(
  (
    {
      className,
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
    const [error, setError] = React.useState<string | null>(null);
    const [uploading, setUploading] = React.useState(false);

    const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
      const files = event.target.files;
      setError(null);

      if (!files || files.length === 0) {
        onChange?.(null);
        return;
      }

      const fileArray = Array.from(files);

      // Validate file sizes
      if (maxSize) {
        const oversizedFiles = fileArray.filter((file) => file.size > maxSize);
        if (oversizedFiles.length > 0) {
          const maxSizeMB = (maxSize / (1024 * 1024)).toFixed(2);
          setError(`File size exceeds ${maxSizeMB} MB`);
          onChange?.(null);
          return;
        }
      }

      const result = multiple ? fileArray : fileArray[0];

      // Upload files if uploader is provided
      if (uploader) {
        setUploading(true);
        try {
          if (Array.isArray(result)) {
            await Promise.all(result.map((file) => uploader.upload(file)));
          } else {
            await uploader.upload(result);
          }
          onChange?.(result);
        } catch (err) {
          setError(err instanceof Error ? err.message : 'Upload failed');
          onChange?.(null);
        } finally {
          setUploading(false);
        }
      } else {
        onChange?.(result);
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
          disabled={disabled || uploading}
          data-slot="input"
          className={cn(
            'file:text-foreground file:bg-muted file:border-0 file:rounded-sm file:px-3 file:py-1 file:text-sm file:font-medium',
            'border-input placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-ring/50',
            'h-9 w-full rounded-md border bg-transparent px-3 py-1 text-sm shadow-xs transition-colors',
            'focus-visible:outline-none focus-visible:ring-[3px]',
            'disabled:cursor-not-allowed disabled:opacity-50',
            'aria-invalid:border-destructive aria-invalid:ring-destructive/20',
            error && 'border-destructive',
            className
          )}
          onChange={handleFileChange}
          onBlur={onBlur}
          {...props}
        />
        {error && <p className="text-sm text-destructive">{error}</p>}
        {uploading && <p className="text-sm text-muted-foreground">Uploading...</p>}
      </div>
    );
  }
);

InputFiles.displayName = 'InputFiles';

export { InputFiles };
