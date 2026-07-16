import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  ChartLegend,
  ChartLegendContent,
  type ChartConfig,
} from '@reformer/ui-kit/chart';
import { Bar, BarChart, CartesianGrid, Line, LineChart, XAxis } from 'recharts';
import type { ComponentDocConfig } from '../types';

/**
 * Chart — не form-control: тонкая обёртка над recharts (shadcn chart). ChartContainer
 * задаёт ResponsiveContainer + инъектит CSS-переменные цвета из `config` (ChartConfig),
 * ChartTooltip / ChartTooltipContent и ChartLegend / ChartLegendContent — оформленные
 * tooltip и легенда. Тяжёлая зависимость recharts (optional peer) — компонент живёт вне
 * главного barrel и импортируется через `@reformer/ui-kit/chart`.
 */

const chartData = [
  { month: 'Январь', desktop: 186, mobile: 80 },
  { month: 'Февраль', desktop: 305, mobile: 200 },
  { month: 'Март', desktop: 237, mobile: 120 },
  { month: 'Апрель', desktop: 73, mobile: 190 },
  { month: 'Май', desktop: 209, mobile: 130 },
  { month: 'Июнь', desktop: 214, mobile: 140 },
];

const chartConfig = {
  desktop: { label: 'Десктоп', color: 'var(--chart-1)' },
  mobile: { label: 'Мобильные', color: 'var(--chart-2)' },
} satisfies ChartConfig;

export const chartDocConfig: ComponentDocConfig = {
  name: 'Chart',
  importFrom: '@reformer/ui-kit/chart',
  description:
    'Обёртка над recharts (shadcn chart). ChartContainer оборачивает график в ResponsiveContainer и инъектит CSS-переменные цвета из ChartConfig (--color-<key>), которые график читает через fill/stroke="var(--color-<key>)". ChartTooltipContent и ChartLegendContent — стилизованные tooltip и легенда, читающие label/цвет из того же config. SUBPATH-ONLY: тяжёлый recharts — импорт из @reformer/ui-kit/chart.',
  variants: [
    {
      id: 'bar',
      title: 'Столбчатая диаграмма',
      description:
        'ChartContainer + BarChart. Цвета столбцов — через fill="var(--color-desktop)"; подписи и цвета берутся из ChartConfig. Tooltip и легенда — стилизованные компоненты ui-kit.',
      render: () => (
        <ChartContainer config={chartConfig} className="min-h-[220px] w-full">
          <BarChart accessibilityLayer data={chartData}>
            <CartesianGrid vertical={false} />
            <XAxis
              dataKey="month"
              tickLine={false}
              tickMargin={10}
              axisLine={false}
              tickFormatter={(value) => String(value).slice(0, 3)}
            />
            <ChartTooltip content={<ChartTooltipContent />} />
            <ChartLegend content={<ChartLegendContent />} />
            <Bar dataKey="desktop" fill="var(--color-desktop)" radius={4} />
            <Bar dataKey="mobile" fill="var(--color-mobile)" radius={4} />
          </BarChart>
        </ChartContainer>
      ),
      code: `const chartConfig = {
  desktop: { label: 'Десктоп', color: 'var(--chart-1)' },
  mobile: { label: 'Мобильные', color: 'var(--chart-2)' },
} satisfies ChartConfig;

<ChartContainer config={chartConfig} className="min-h-[220px] w-full">
  <BarChart accessibilityLayer data={chartData}>
    <CartesianGrid vertical={false} />
    <XAxis dataKey="month" tickLine={false} tickMargin={10} axisLine={false} />
    <ChartTooltip content={<ChartTooltipContent />} />
    <ChartLegend content={<ChartLegendContent />} />
    <Bar dataKey="desktop" fill="var(--color-desktop)" radius={4} />
    <Bar dataKey="mobile" fill="var(--color-mobile)" radius={4} />
  </BarChart>
</ChartContainer>`,
    },
    {
      id: 'line',
      title: 'Линейный график',
      description:
        'Тот же ChartContainer, но LineChart. Линии красятся через stroke="var(--color-desktop)". Один и тот же config переиспользуется для цвета и подписей.',
      render: () => (
        <ChartContainer config={chartConfig} className="min-h-[220px] w-full">
          <LineChart accessibilityLayer data={chartData}>
            <CartesianGrid vertical={false} />
            <XAxis
              dataKey="month"
              tickLine={false}
              tickMargin={10}
              axisLine={false}
              tickFormatter={(value) => String(value).slice(0, 3)}
            />
            <ChartTooltip content={<ChartTooltipContent />} />
            <Line
              dataKey="desktop"
              type="monotone"
              stroke="var(--color-desktop)"
              strokeWidth={2}
              dot={false}
            />
            <Line
              dataKey="mobile"
              type="monotone"
              stroke="var(--color-mobile)"
              strokeWidth={2}
              dot={false}
            />
          </LineChart>
        </ChartContainer>
      ),
      code: `<ChartContainer config={chartConfig} className="min-h-[220px] w-full">
  <LineChart accessibilityLayer data={chartData}>
    <CartesianGrid vertical={false} />
    <XAxis dataKey="month" tickLine={false} tickMargin={10} axisLine={false} />
    <ChartTooltip content={<ChartTooltipContent />} />
    <Line dataKey="desktop" type="monotone" stroke="var(--color-desktop)" strokeWidth={2} dot={false} />
    <Line dataKey="mobile" type="monotone" stroke="var(--color-mobile)" strokeWidth={2} dot={false} />
  </LineChart>
</ChartContainer>`,
    },
  ],
  examples: [
    {
      id: 'tooltip-no-indicator',
      title: 'Tooltip без индикатора',
      description:
        'ChartTooltipContent принимает hideIndicator и indicator ("dot" | "line" | "dashed") — управляет видом маркера строки в подсказке.',
      render: () => (
        <ChartContainer config={chartConfig} className="min-h-[220px] w-full">
          <BarChart accessibilityLayer data={chartData}>
            <CartesianGrid vertical={false} />
            <XAxis
              dataKey="month"
              tickLine={false}
              tickMargin={10}
              axisLine={false}
              tickFormatter={(value) => String(value).slice(0, 3)}
            />
            <ChartTooltip content={<ChartTooltipContent indicator="line" hideIndicator />} />
            <Bar dataKey="desktop" fill="var(--color-desktop)" radius={4} />
          </BarChart>
        </ChartContainer>
      ),
      code: `<ChartTooltip
  content={<ChartTooltipContent indicator="line" hideIndicator />}
/>`,
    },
    {
      id: 'single-series',
      title: 'Один ряд данных',
      description:
        'Минимальная конфигурация: один Bar и config с одним ключом. Легенда не обязательна — цвет и подпись всё равно берутся из config.',
      render: () => (
        <ChartContainer
          config={{ desktop: { label: 'Десктоп', color: 'var(--chart-1)' } }}
          className="min-h-[200px] w-full"
        >
          <BarChart accessibilityLayer data={chartData}>
            <XAxis
              dataKey="month"
              tickLine={false}
              tickMargin={10}
              axisLine={false}
              tickFormatter={(value) => String(value).slice(0, 3)}
            />
            <ChartTooltip content={<ChartTooltipContent hideLabel />} />
            <Bar dataKey="desktop" fill="var(--color-desktop)" radius={4} />
          </BarChart>
        </ChartContainer>
      ),
      code: `<ChartContainer
  config={{ desktop: { label: 'Десктоп', color: 'var(--chart-1)' } }}
  className="min-h-[200px] w-full"
>
  <BarChart accessibilityLayer data={chartData}>
    <XAxis dataKey="month" tickLine={false} axisLine={false} />
    <ChartTooltip content={<ChartTooltipContent hideLabel />} />
    <Bar dataKey="desktop" fill="var(--color-desktop)" radius={4} />
  </BarChart>
</ChartContainer>`,
    },
  ],
  props: [
    {
      name: 'ChartContainer',
      type: 'div + ResponsiveContainer',
      description:
        'Корень графика. Обязательный props config: ChartConfig. Оборачивает единственного recharts-ребёнка в ResponsiveContainer, задаёт data-chart и через ChartStyle инъектит CSS-переменные --color-<key>. initialDimension — начальный размер до измерения.',
    },
    {
      name: 'config',
      type: 'ChartConfig',
      description:
        'Карта ключ-ряда → { label, icon?, color | theme }. color даёт --color-<key> для fill/stroke; theme = { light, dark } задаёт цвет под тему. label и icon используются в tooltip и легенде.',
    },
    {
      name: 'ChartTooltip',
      type: 'Recharts.Tooltip',
      description: 'Реэкспорт recharts Tooltip. Обычно content={<ChartTooltipContent />}.',
    },
    {
      name: 'ChartTooltipContent',
      type: 'div',
      default: 'indicator="dot"',
      description:
        'Стилизованное тело подсказки. Props: indicator ("dot" | "line" | "dashed"), hideLabel, hideIndicator, nameKey / labelKey, labelFormatter, formatter. Label и цвета читает из config.',
    },
    {
      name: 'ChartLegend',
      type: 'Recharts.Legend',
      description: 'Реэкспорт recharts Legend. Обычно content={<ChartLegendContent />}.',
    },
    {
      name: 'ChartLegendContent',
      type: 'div',
      description:
        'Стилизованная легенда. Props: hideIcon, nameKey, verticalAlign. Подписи/иконки — из config.',
    },
    {
      name: 'ChartStyle',
      type: 'style',
      description:
        'Инъектит <style> с --color-<key> для light и .dark селекторов. Рендерится внутри ChartContainer; экспортируется для кастомных композиций.',
    },
    {
      name: 'useChart',
      type: '() => { config }',
      description:
        'Хук доступа к ChartConfig. Бросает, если вызван вне <ChartContainer />. Нужен для собственных tooltip/легенд.',
    },
    {
      name: 'className',
      type: 'string',
      description:
        'Доп. классы у ChartContainer (tailwind-merge). Обычно задают высоту/ширину (min-h-[220px] w-full).',
    },
  ],
};
