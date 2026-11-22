import type { PropsSchema } from '@/fields/props-schema';

/**
 * Props-схема Chart (Root = ChartContainer, обёртка recharts ResponsiveContainer). Рендерит
 * реальный <div className={cn(..., className)} {...props}> — поэтому несёт className. Остальные
 * пропсы (config, initialDimension, children) — несериализуемые объекты/JSX, в статическую схему
 * не попадают. Enum/boolean/number-пропсов у Root нет — схема минимальна.
 */
export const chartBasePropsSchema = {
  type: 'object',
  additionalProperties: true,
  'x-registryName': 'Chart',
  properties: {
    className: {
      type: 'string',
      description: 'Доп. CSS-класс (Tailwind) — обычно задаёт высоту/ширину графика.',
      'x-doc': { group: 'Control', type: 'string', kind: 'readonly' },
    },
  },
} as const satisfies PropsSchema;
