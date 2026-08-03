import * as React from 'react';
import { icons, type LucideProps } from 'lucide-react';

import { cn } from '@/lib/utils';

/**
 * Презентационная иконка: рендерит иконку lucide по имени (`iconName`, PascalCase — напр. `Home`,
 * `ArrowRight`). Имя сериализуемо (строка в `componentProps`), поэтому компонент годится для
 * JSON-DSL/renderer-json и билдера. Неизвестное имя → ничего не рисуется (без падения).
 *
 * ВНИМАНИЕ: импорт `icons` тянет весь набор lucide — компонент opt-in (бандлится только у
 * потребителей, которые его используют; tree-shaking отбрасывает у остальных).
 */
const REGISTRY = icons as unknown as Record<string, React.ComponentType<LucideProps>>;

export interface IconProps {
  /** Имя иконки lucide (PascalCase, напр. `Home`, `ArrowRight`). */
  iconName?: string;
  /** Размер в пикселях. */
  size?: number;
  /** Цвет обводки (любой CSS-цвет; по умолчанию `currentColor`). */
  color?: string;
  /** Толщина линий. */
  strokeWidth?: number;
  /** Доп. CSS-класс. */
  className?: string;
}

function Icon({ iconName = 'Circle', size = 24, color, strokeWidth = 2, className }: IconProps) {
  const Cmp = REGISTRY[iconName];
  if (!Cmp) return null;
  return (
    <Cmp
      data-slot="icon"
      size={size}
      color={color}
      strokeWidth={strokeWidth}
      className={cn(className)}
    />
  );
}

export { Icon };
