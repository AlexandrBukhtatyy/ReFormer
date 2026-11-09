import * as React from 'react';
import { icons, type LucideProps } from 'lucide-react';

import { cn } from '@/lib/utils';

/**
 * Презентационная иконка: рендерит иконку lucide по имени (`iconName`, PascalCase — напр. `House`,
 * `ArrowRight`). Имя сериализуемо (строка в `componentProps`), поэтому компонент годится для
 * JSON-DSL/renderer-json и билдера. Неизвестное имя → ничего не рисуется (без падения).
 *
 * ВНИМАНИЕ: импорт `icons` тянет весь набор lucide — компонент opt-in (бандлится только у
 * потребителей, которые его используют; tree-shaking отбрасывает у остальных).
 */
const REGISTRY = icons as unknown as Record<string, React.ComponentType<LucideProps>>;

export interface IconProps extends Omit<LucideProps, 'ref' | 'children' | 'title'> {
  /** Имя иконки lucide (PascalCase, напр. `House`, `ArrowRight`). */
  iconName?: string;
  /** Размер в пикселях. */
  size?: number;
  /** Цвет обводки (любой CSS-цвет; по умолчанию `currentColor`). */
  color?: string;
  /** Толщина линий. */
  strokeWidth?: number;
  /** Доп. CSS-класс. */
  className?: string;
  /**
   * Доступное имя иконки — рисуется элементом `<title>` внутри `svg`. Без него (и без
   * `aria-label`/`aria-labelledby`) иконка декоративная: `aria-hidden`, скринридер её пропускает.
   */
  title?: string;
}

function Icon({
  iconName = 'Circle',
  size = 24,
  color,
  strokeWidth = 2,
  className,
  title,
  ...props
}: IconProps) {
  const Cmp = REGISTRY[iconName];
  if (!Cmp) return null;
  // Иконка с именем — изображение, а не украшение. `aria-hidden` lucide снимает сам, увидев
  // `aria-*`/`role` или дочерний `<title>`; роль `img` нужна, чтобы имя `svg` надёжно дошло до
  // скринридера (без роли часть связок браузер/скринридер его не объявляет). Ключ `role` кладём
  // только при имени: lucide смотрит на наличие ключа, и `role: undefined` сняло бы `aria-hidden`
  // с декоративной иконки.
  const named = Boolean(title || props['aria-label'] || props['aria-labelledby']);
  return (
    <Cmp
      data-slot="icon"
      {...(named ? { role: 'img' } : {})}
      {...props}
      size={size}
      color={color}
      strokeWidth={strokeWidth}
      className={cn(className)}
    >
      {title ? <title>{title}</title> : null}
    </Cmp>
  );
}

export { Icon };
