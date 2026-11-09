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
 * Chart — не поле формы: обёртка над recharts. ChartContainer растягивает график по ширине и
 * объявляет CSS-переменные цветов из `config`; ChartTooltipContent и ChartLegendContent —
 * оформленные подсказка и легенда. recharts — необязательная peer-зависимость, поэтому импорт
 * только из `@reformer/ui-kit/chart`. Variants — типы графиков, Examples — приёмы, API — части.
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
    'Графики recharts в стиле кита: цвета и подписи рядов — из ChartConfig. Импорт — @reformer/ui-kit/chart, нужен пакет recharts.',
  variants: [
    {
      id: 'bar',
      title: 'Столбчатая диаграмма',
      description:
        'ChartContainer + BarChart. Столбец красится fill="var(--color-desktop)" — переменную объявляет ChartContainer из config. Подсказка и легенда берут оттуда же подписи.',
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
      code: `import { Bar, BarChart, CartesianGrid, XAxis } from 'recharts';

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
</ChartContainer>`,
    },
    {
      id: 'line',
      title: 'Линейный график',
      description:
        'Тот же ChartContainer и config, но LineChart: линия красится stroke="var(--color-desktop)".',
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
      code: `// chartData и chartConfig — как в «Столбчатой диаграмме»
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
    <Line dataKey="desktop" type="monotone" stroke="var(--color-desktop)" strokeWidth={2} dot={false} />
    <Line dataKey="mobile" type="monotone" stroke="var(--color-mobile)" strokeWidth={2} dot={false} />
  </LineChart>
</ChartContainer>`,
    },
  ],
  examples: [
    {
      id: 'tooltip-indicator',
      title: 'Маркер в подсказке (indicator)',
      description:
        'indicator меняет маркер ряда в подсказке: "dot" (по умолчанию), "line" или "dashed". hideIndicator убирает его совсем.',
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
            <ChartTooltip content={<ChartTooltipContent indicator="line" />} />
            <Bar dataKey="desktop" fill="var(--color-desktop)" radius={4} />
            <Bar dataKey="mobile" fill="var(--color-mobile)" radius={4} />
          </BarChart>
        </ChartContainer>
      ),
      code: `<ChartContainer config={chartConfig} className="min-h-[220px] w-full">
  <BarChart accessibilityLayer data={chartData}>
    <CartesianGrid vertical={false} />
    <XAxis
      dataKey="month"
      tickLine={false}
      tickMargin={10}
      axisLine={false}
      tickFormatter={(value) => String(value).slice(0, 3)}
    />
    <ChartTooltip content={<ChartTooltipContent indicator="line" />} />
    <Bar dataKey="desktop" fill="var(--color-desktop)" radius={4} />
    <Bar dataKey="mobile" fill="var(--color-mobile)" radius={4} />
  </BarChart>
</ChartContainer>`,
    },
    {
      id: 'single-series',
      title: 'Один ряд данных',
      description:
        'Один Bar и config с одним ключом. Легенда не обязательна; hideLabel убирает заголовок (месяц) из подсказки.',
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
</ChartContainer>`,
    },
  ],
  props: [
    {
      name: 'ChartContainer',
      type: 'div + ResponsiveContainer',
      description:
        'Корень. Обязательный config. Кладёт единственный график recharts в ResponsiveContainer и объявляет --color-<ключ> для каждого ряда. initialDimension — размер до первого измерения (320×200).',
    },
    {
      name: 'config',
      type: 'ChartConfig',
      description:
        "Ряды: ключ → { label, icon?, color | theme }. color объявляет --color-<ключ>; label и icon показывают подсказка и легенда. theme = { light, dark } — свои цвета для светлой и тёмной темы; dark включается под .dark и под [data-theme='dark'].",
    },
    {
      name: 'ChartTooltip',
      type: 'Recharts.Tooltip',
      description: 'Tooltip из recharts без изменений. Обычно content={<ChartTooltipContent />}.',
    },
    {
      name: 'ChartTooltipContent',
      type: 'div',
      default: 'indicator="dot"',
      description:
        'Оформленная подсказка: indicator ("dot" | "line" | "dashed"), hideLabel, hideIndicator, nameKey / labelKey, labelFormatter, formatter. Подписи и цвета — из config.',
    },
    {
      name: 'ChartLegend',
      type: 'Recharts.Legend',
      description: 'Legend из recharts без изменений. Обычно content={<ChartLegendContent />}.',
    },
    {
      name: 'ChartLegendContent',
      type: 'div',
      description:
        'Оформленная легенда: hideIcon, nameKey, verticalAlign. Подписи и иконки — из config.',
    },
    {
      name: 'ChartStyle',
      type: 'style',
      description:
        'Тег <style> с переменными --color-<ключ>. ChartContainer рисует его сам; экспортирован для своих обёрток.',
    },
    {
      name: 'useChart',
      type: '() => { config }',
      description:
        'Хук: config ближайшего ChartContainer — для своей подсказки или легенды. Вне ChartContainer бросает ошибку.',
    },
    {
      name: 'className',
      type: 'string',
      description:
        'Классы ChartContainer. Задайте высоту (min-h-[220px] или h-*) — без неё график берёт пропорции 16:9.',
    },
  ],
};
