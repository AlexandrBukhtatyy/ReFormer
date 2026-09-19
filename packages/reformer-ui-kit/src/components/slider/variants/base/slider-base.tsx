import * as React from 'react';
import { Slider as SliderPrimitive } from 'radix-ui';

import { cn } from '@/lib/utils';
import { defineFieldControl } from '@/fields/field-control';
import { sliderAdapter } from '@/fields/adapters';
import { withFieldTooltip, OUTSIDE_FILL } from '@/fields/field-tooltip';

// Дословный порт shadcn/ui (new-york-v4) slider. Правки только: снят 'use client'
// (unified `radix-ui` (Slider.Root/Track/Range/Thumb) и `@/lib/utils` уже в upstream-исходнике).
// data-slot сохранён. data-testid/aria-* приходят через spread `...props` и ложатся на
// SliderPrimitive.Root. Одно-thumb режим (форма, value: number|null) даёт _values.length === 1.
function SliderBase({
  className,
  defaultValue,
  value,
  min = 0,
  max = 100,
  ...props
}: React.ComponentProps<typeof SliderPrimitive.Root>) {
  const _values = React.useMemo(
    () => (Array.isArray(value) ? value : Array.isArray(defaultValue) ? defaultValue : [min, max]),
    [value, defaultValue, min, max]
  );

  return (
    <SliderPrimitive.Root
      data-slot="slider"
      defaultValue={defaultValue}
      value={value}
      min={min}
      max={max}
      className={cn(
        'relative flex w-full touch-none items-center select-none data-[disabled]:opacity-50 data-[orientation=vertical]:h-full data-[orientation=vertical]:min-h-44 data-[orientation=vertical]:w-auto data-[orientation=vertical]:flex-col',
        className
      )}
      {...props}
    >
      <SliderPrimitive.Track
        data-slot="slider-track"
        className={cn(
          'relative grow overflow-hidden rounded-full bg-muted data-[orientation=horizontal]:h-1.5 data-[orientation=horizontal]:w-full data-[orientation=vertical]:h-full data-[orientation=vertical]:w-1.5'
        )}
      >
        <SliderPrimitive.Range
          data-slot="slider-range"
          className={cn(
            'absolute bg-primary data-[orientation=horizontal]:h-full data-[orientation=vertical]:w-full'
          )}
        />
      </SliderPrimitive.Track>
      {Array.from({ length: _values.length }, (_, index) => (
        <SliderPrimitive.Thumb
          data-slot="slider-thumb"
          key={index}
          className="block size-4 shrink-0 rounded-full border border-primary bg-white shadow-sm ring-ring/50 transition-[color,box-shadow] hover:ring-4 focus-visible:ring-4 focus-visible:outline-hidden disabled:pointer-events-none disabled:opacity-50"
        />
      ))}
    </SliderPrimitive.Root>
  );
}

/**
 * Value-based контракт Slider в форме. Значение — `number | null`; форма резолвит
 * `value`/`onChange`/`onBlur`/`disabled`, автор задаёт `min`/`max`/`step`/`className` в
 * `componentProps`. Служит типом для стража props-схемы: сам компонент — Radix `value: number[]` /
 * `onValueChange`, а контракт формы скалярный (`sliderAdapter`, одно-thumb режим).
 */
export interface SliderFormProps {
  value?: number | null;
  onChange?: (value: number | null) => void;
  onBlur?: () => void;
  disabled?: boolean;
  min?: number;
  max?: number;
  step?: number;
  className?: string;
}

/**
 * Slider кита: порт shadcn + проп `tooltip` (иконка справа). В форме — скалярный контракт
 * `value: number | null`: {@link sliderAdapter} (статика) сводит его к Radix-массиву
 * (`[v ?? 0]` ↔ `arr[0]`, одно-thumb режим). Подпись поля — сверху, от FormField.
 */
const Slider = defineFieldControl(withFieldTooltip(SliderBase, OUTSIDE_FILL), {
  adapter: sliderAdapter,
});
Slider.displayName = 'Slider';

export { Slider };
