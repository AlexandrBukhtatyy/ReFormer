import { describe, it, expect } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { Progress } from './index';

describe('Progress (base)', () => {
  it('рендерит Root+Indicator с их data-slot', () => {
    const html = renderToStaticMarkup(<Progress value={50} />);
    expect(html).toContain('data-slot="progress"');
    expect(html).toContain('data-slot="progress-indicator"');
  });

  it('Root несёт role="progressbar" (Radix Progress)', () => {
    const html = renderToStaticMarkup(<Progress value={50} />);
    expect(html).toContain('role="progressbar"');
  });

  it('value отражается в transform индикатора: сдвиг на -(100 - value)%', () => {
    const html = renderToStaticMarkup(<Progress value={40} />);
    expect(html).toContain('translateX(-60%)');
  });

  it('без value индикатор полностью скрыт (translateX(-100%))', () => {
    const html = renderToStaticMarkup(<Progress />);
    expect(html).toContain('translateX(-100%)');
  });

  it('value доходит до Radix Root: aria-valuenow, процент в aria-valuetext, data-state', () => {
    const html = renderToStaticMarkup(<Progress value={40} />);
    expect(html).toContain('aria-valuenow="40"');
    expect(html).toContain('aria-valuemax="100"');
    expect(html).toContain('aria-valuetext="40%"');
    expect(html).toContain('data-state="loading"');
    expect(renderToStaticMarkup(<Progress value={100} />)).toContain('data-state="complete"');
  });

  it('без value прогресс неопределённый: без aria-valuenow, data-state="indeterminate"', () => {
    const html = renderToStaticMarkup(<Progress />);
    expect(html).not.toContain('aria-valuenow');
    expect(html).toContain('data-state="indeterminate"');
  });

  it('max задаёт шкалу: заливка и aria считаются от max, а не от 100', () => {
    const html = renderToStaticMarkup(<Progress value={3} max={4} />);
    expect(html).toContain('aria-valuemax="4"');
    expect(html).toContain('aria-valuenow="3"');
    expect(html).toContain('aria-valuetext="75%"');
    expect(html).toContain('translateX(-25%)');
  });

  it('className мёржится на Root (tailwind-merge, caller wins)', () => {
    const html = renderToStaticMarkup(<Progress value={10} className="h-4" />);
    expect(html).toContain('h-4');
    expect(html).not.toContain('h-2');
  });

  it('прокидывает произвольные props (напр. data-testid) на Root', () => {
    const html = renderToStaticMarkup(<Progress value={10} data-testid="progress-x" />);
    expect(html).toContain('data-testid="progress-x"');
  });
});
