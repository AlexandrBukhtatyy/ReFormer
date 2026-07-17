import { describe, it, expect } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import * as Recharts from 'recharts';
import {
  ChartContainer,
  ChartStyle,
  ChartTooltip,
  ChartTooltipContent,
  ChartLegend,
  ChartLegendContent,
  useChart,
  type ChartConfig,
} from './index';

// Chart — тяжёлый презентационный compound на recharts. ResponsiveContainer/сами графики
// в SSR не измеряются (нет ResizeObserver), поэтому тестируем СТАТИКУ, которую ChartContainer
// и ChartStyle рендерят синхронно: data-slot, data-chart, инъекцию CSS-переменных цвета,
// merge className, страж useChart и идентичность recharts-примитивов.

const config = {
  desktop: { label: 'Десктоп', color: '#2563eb' },
  mobile: { label: 'Мобильные', color: '#60a5fa' },
} satisfies ChartConfig;

const data = [
  { month: 'Январь', desktop: 186, mobile: 80 },
  { month: 'Февраль', desktop: 305, mobile: 200 },
];

function renderContainer(props?: { id?: string; className?: string }) {
  return renderToStaticMarkup(
    <ChartContainer config={config} id={props?.id} className={props?.className}>
      <Recharts.BarChart data={data}>
        <Recharts.Bar dataKey="desktop" fill="var(--color-desktop)" />
        <Recharts.Bar dataKey="mobile" fill="var(--color-mobile)" />
      </Recharts.BarChart>
    </ChartContainer>
  );
}

describe('Chart (base, recharts compound)', () => {
  it('ChartContainer несёт data-slot="chart"', () => {
    expect(renderContainer()).toContain('data-slot="chart"');
  });

  it('ChartContainer генерирует стабильный data-chart из явного id', () => {
    expect(renderContainer({ id: 'sales' })).toContain('data-chart="chart-sales"');
  });

  it('ChartContainer без id всё равно проставляет data-chart="chart-..."', () => {
    expect(renderContainer()).toMatch(/data-chart="chart-[^"]+"/);
  });

  it('ChartContainer инъектит <style> с CSS-переменными цвета из config', () => {
    const html = renderContainer({ id: 'sales' });
    expect(html).toContain('--color-desktop: #2563eb');
    expect(html).toContain('--color-mobile: #60a5fa');
    expect(html).toContain('[data-chart=chart-sales]');
  });

  it('ChartContainer мёржит пользовательский className (tailwind-merge)', () => {
    expect(renderContainer({ className: 'my-custom-chart' })).toContain('my-custom-chart');
  });

  it('ChartStyle отдельно рендерит темизацию (light + .dark селекторы)', () => {
    const html = renderToStaticMarkup(<ChartStyle id="chart-x" config={config} />);
    expect(html).toContain('[data-chart=chart-x]');
    expect(html).toContain('.dark [data-chart=chart-x]');
    expect(html).toContain('--color-desktop: #2563eb');
  });

  it('ChartStyle возвращает null при config без цветов (пустая разметка)', () => {
    const html = renderToStaticMarkup(
      <ChartStyle id="chart-empty" config={{ views: { label: 'Просмотры' } }} />
    );
    expect(html).toBe('');
  });

  it('useChart бросает вне <ChartContainer />', () => {
    function BadConsumer() {
      useChart();
      return null;
    }
    expect(() => renderToStaticMarkup(<BadConsumer />)).toThrow(
      'useChart must be used within a <ChartContainer />'
    );
  });

  it('ChartTooltip / ChartLegend — это recharts-примитивы (реэкспорт)', () => {
    expect(ChartTooltip).toBe(Recharts.Tooltip);
    expect(ChartLegend).toBe(Recharts.Legend);
  });

  it('ChartTooltipContent / ChartLegendContent экспортируются как компоненты', () => {
    expect(typeof ChartTooltipContent).toBe('function');
    expect(typeof ChartLegendContent).toBe('function');
  });

  it('ChartTooltipContent требует контекст useChart (страж вне контейнера)', () => {
    expect(() => renderToStaticMarkup(<ChartTooltipContent active payload={[]} />)).toThrow(
      'useChart must be used within a <ChartContainer />'
    );
  });
});
