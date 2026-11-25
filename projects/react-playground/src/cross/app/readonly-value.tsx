/**
 * Вычисляемое значение — компонент приложения, а не кита: подпись и `<output>`, контрола нет.
 * Роль DOM-контракта — `computed-{path}`.
 */
import type { ReactNode } from 'react';

export interface ReadonlyValueProps {
  /** Путь DOM-контракта: `computed-{path}`. */
  path: string;
  label: string;
  /** Уже вычисленное значение; числа выводятся без разделителей разрядов. */
  value: string | number | null | undefined;
}

export function ReadonlyValue({ path, label, value }: ReadonlyValueProps): ReactNode {
  const labelId = `computed-label-${path}`;
  return (
    <div className="flex flex-col gap-1">
      <span id={labelId} className="text-sm font-medium">
        {label}
      </span>
      <output
        aria-labelledby={labelId}
        data-testid={`computed-${path}`}
        className="min-h-5 text-sm text-muted-foreground"
      >
        {value == null ? '' : String(value)}
      </output>
    </div>
  );
}
