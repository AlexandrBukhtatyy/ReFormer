import { describe, it, expect } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { LoadingState, ErrorState } from './index';

describe('LoadingState a11y — объявление статуса скринридерам', () => {
  it('несёт role="status" и aria-live="polite"', () => {
    const html = renderToStaticMarkup(<LoadingState />);
    expect(html).toContain('role="status"');
    expect(html).toContain('aria-live="polite"');
  });
});

describe('ErrorState a11y — объявление ошибки скринридерам', () => {
  it('несёт role="alert" и aria-live="assertive"', () => {
    const html = renderToStaticMarkup(<ErrorState error="Не удалось загрузить" />);
    expect(html).toContain('role="alert"');
    expect(html).toContain('aria-live="assertive"');
  });
});
