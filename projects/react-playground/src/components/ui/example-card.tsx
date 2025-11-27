import * as React from 'react';
import { useState, useCallback } from 'react';
import { cn } from '@/lib/utils';

export interface ExampleCardProps {
  title: string;
  description?: string;
  children: React.ReactNode;
  code: string;
  className?: string;
  bgColor?: string;
}

// Copy icon SVG
const CopyIcon = () => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width="16"
    height="16"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <rect width="14" height="14" x="8" y="8" rx="2" ry="2" />
    <path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2" />
  </svg>
);

// Check icon SVG (for copied state)
const CheckIcon = () => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width="16"
    height="16"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <polyline points="20 6 9 17 4 12" />
  </svg>
);

// Code icon SVG
const CodeIcon = () => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width="16"
    height="16"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <polyline points="16 18 22 12 16 6" />
    <polyline points="8 6 2 12 8 18" />
  </svg>
);

// Eye icon SVG
const EyeIcon = () => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width="16"
    height="16"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z" />
    <circle cx="12" cy="12" r="3" />
  </svg>
);

export function ExampleCard({
  title,
  description,
  children,
  code,
  className,
  bgColor = 'bg-white',
}: ExampleCardProps) {
  const [showCode, setShowCode] = useState(false);
  const [copied, setCopied] = useState(false);

  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  }, [code]);

  const toggleView = useCallback(() => {
    setShowCode((prev) => !prev);
  }, []);

  return (
    <div className={cn('p-4 border rounded-lg', bgColor, className)}>
      {/* Header */}
      <div className="flex items-start justify-between mb-2">
        <div className="flex-1 min-w-0 pr-2">
          <h3 className="text-lg font-semibold">{title}</h3>
          {description && <p className="text-sm text-gray-600 mt-1">{description}</p>}
        </div>

        {/* Buttons */}
        <div className="flex items-center gap-1 flex-shrink-0">
          {/* Copy button - only visible in code mode */}
          {showCode && (
            <button
              onClick={handleCopy}
              className={cn(
                'p-1.5 rounded transition-colors',
                copied
                  ? 'bg-green-100 text-green-600'
                  : 'hover:bg-gray-200 text-gray-600 hover:text-gray-800'
              )}
              title={copied ? 'Скопировано!' : 'Копировать код'}
            >
              {copied ? <CheckIcon /> : <CopyIcon />}
            </button>
          )}

          {/* Toggle view/code button */}
          <button
            onClick={toggleView}
            className={cn(
              'p-1.5 rounded transition-colors',
              showCode
                ? 'bg-blue-100 text-blue-600'
                : 'hover:bg-gray-200 text-gray-600 hover:text-gray-800'
            )}
            title={showCode ? 'Показать пример' : 'Показать код'}
          >
            {showCode ? <EyeIcon /> : <CodeIcon />}
          </button>
        </div>
      </div>

      {/* Content */}
      {showCode ? (
        <pre className="text-xs bg-gray-800 text-green-400 p-3 rounded overflow-x-auto whitespace-pre-wrap">
          {code}
        </pre>
      ) : (
        <div className="mt-4">{children}</div>
      )}
    </div>
  );
}
