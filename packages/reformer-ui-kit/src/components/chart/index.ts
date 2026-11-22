// base — pure shadcn Chart (recharts): ChartContainer (обёртка ResponsiveContainer +
// инъекция CSS-переменных цвета), ChartTooltip / ChartTooltipContent, ChartLegend /
// ChartLegendContent, ChartStyle, хук useChart и тип ChartConfig. Не form-control.
// SUBPATH-ONLY: тяжёлая зависимость recharts (optional peer) — компонент живёт вне
// главного barrel, импортируется через `@reformer/ui-kit/chart`.
export {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  ChartLegend,
  ChartLegendContent,
  ChartStyle,
  useChart,
} from './variants/base/chart-base';
export type { ChartConfig } from './variants/base/chart-base';
