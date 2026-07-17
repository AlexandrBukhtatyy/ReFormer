import { describe, it, expect } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { sliderAdapter } from '@/fields/adapters';
import { Slider, SliderField } from './index';

describe('Slider (base, pure shadcn Radix)', () => {
  it('рендерит Root (span data-slot=slider) + track/range/thumb (role=slider)', () => {
    const html = renderToStaticMarkup(<Slider />);
    expect(html).toContain('data-slot="slider"');
    expect(html).toContain('data-slot="slider-track"');
    expect(html).toContain('data-slot="slider-range"');
    expect(html).toContain('data-slot="slider-thumb"');
    expect(html).toContain('role="slider"');
    expect(html).toContain('data-orientation="horizontal"');
  });

  it('без value → два thumb (_values = [min, max])', () => {
    const html = renderToStaticMarkup(<Slider />);
    expect(html.match(/role="slider"/g)).toHaveLength(2);
  });

  it('value=[50] (max=100) → один thumb, range заполнен на 50% (right:50%)', () => {
    const html = renderToStaticMarkup(<Slider value={[50]} min={0} max={100} />);
    expect(html.match(/role="slider"/g)).toHaveLength(1);
    expect(html).toContain('right:50%');
  });
});

describe('SliderField (field, скалярный value: number | null)', () => {
  it('НЕ inline: reformerLayout не выставлен (FormField рисует верхнюю подпись)', () => {
    expect((SliderField as { reformerLayout?: string }).reformerLayout).toBeUndefined();
  });

  it('value=30 (min=0, max=100) → один thumb, range заполнен на 30% (right:70%)', () => {
    const html = renderToStaticMarkup(<SliderField value={30} min={0} max={100} />);
    expect(html.match(/role="slider"/g)).toHaveLength(1);
    expect(html).toContain('right:70%');
  });

  it('min/max прокидываются на thumb (aria-valuemin/aria-valuemax)', () => {
    const html = renderToStaticMarkup(<SliderField value={15} min={10} max={20} />);
    expect(html).toContain('aria-valuemin="10"');
    expect(html).toContain('aria-valuemax="20"');
  });

  it('value=null → без падения (адаптер отдаёт [0]), один thumb', () => {
    const html = renderToStaticMarkup(<SliderField value={null} min={0} max={100} />);
    expect(html).toContain('data-slot="slider"');
    expect(html.match(/role="slider"/g)).toHaveLength(1);
  });

  it('data-testid ложится на Root примитива (span data-slot=slider), НЕ на wrapper/thumb', () => {
    const html = renderToStaticMarkup(<SliderField value={30} data-testid="input-loan" />);
    const rootTag = html.slice(0, html.indexOf('>') + 1);
    expect(rootTag).toContain('data-slot="slider"'); // первый тег — Root
    expect(rootTag).toContain('data-testid="input-loan"'); // testid на Root
    expect(html.match(/data-testid="input-loan"/g)).toHaveLength(1); // единственное вхождение
  });

  it('strip control: renderer-путь не течёт в DOM', () => {
    const html = renderToStaticMarkup(<SliderField value={5} control={{ id: 1 } as never} />);
    expect(html).not.toContain('[object Object]');
    expect(html).not.toContain('control=');
  });

  it('прокидывает aria-labelledby/aria-describedby/aria-invalid на Root (seam-контракт)', () => {
    const html = renderToStaticMarkup(
      <SliderField value={30} aria-labelledby="label-a" aria-describedby="desc-a" aria-invalid />
    );
    expect(html).toContain('aria-labelledby="label-a"');
    expect(html).toContain('aria-describedby="desc-a"');
  });
});

describe('sliderAdapter — одно-thumb контракт (value→primitive, emit→onChange)', () => {
  it('toValue: скаляр → массив Radix ([v]); null → [0]', () => {
    expect(sliderAdapter.toValue(42)).toEqual([42]);
    expect(sliderAdapter.toValue(0)).toEqual([0]);
    expect(sliderAdapter.toValue(null)).toEqual([0]);
  });

  it('fromEmit: массив Radix → первое число; пустой → null', () => {
    expect(sliderAdapter.fromEmit([42], {})).toBe(42);
    expect(sliderAdapter.fromEmit([7, 9], {})).toBe(7);
    expect(sliderAdapter.fromEmit([], {})).toBeNull();
  });
});
