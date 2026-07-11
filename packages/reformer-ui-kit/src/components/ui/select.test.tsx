import { describe, it, expect } from 'vitest';
import * as React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { Select } from './select';

/**
 * Тесты рендера Select через SSR (`renderToStaticMarkup`) — в монорепо нет
 * jsdom/testing-library, но триггер Radix.Select рендерится статически, чего
 * достаточно для проверки проброса ARIA-атрибутов и токенов темы на кнопку.
 */

/** Вырезать открывающий тег `<button ...>` (фокусируемый триггер) из разметки. */
function triggerTag(html: string): string {
  const start = html.indexOf('<button');
  expect(start).toBeGreaterThanOrEqual(0);
  const end = html.indexOf('>', start);
  return html.slice(start, end + 1);
}

function renderSelect(extra: Record<string, unknown>): string {
  return renderToStaticMarkup(
    React.createElement(Select, {
      value: null,
      onChange: () => {},
      options: [{ value: 'a', label: 'A' }],
      ...extra,
    } as never)
  );
}

describe('Select — проброс ARIA-атрибутов на триггер (defect 105)', () => {
  // FormField.Control авто-рендерит контрол, заранее подключая id/aria-*.
  const a11yProps = {
    id: 'ctrl-1',
    'aria-labelledby': 'label-1',
    'aria-describedby': 'desc-1',
    'aria-errormessage': 'err-1',
    'aria-required': true,
    'aria-invalid': true,
  };

  it('пробрасывает id/aria-labelledby/aria-describedby/aria-errormessage/aria-required на кнопку-триггер', () => {
    const tag = triggerTag(renderSelect(a11yProps));
    expect(tag).toContain('id="ctrl-1"');
    expect(tag).toContain('aria-labelledby="label-1"');
    expect(tag).toContain('aria-describedby="desc-1"');
    expect(tag).toContain('aria-errormessage="err-1"');
    expect(tag).toContain('aria-required="true"');
    expect(tag).toContain('aria-invalid="true"');
  });

  it('не навешивает обобщённый aria-label="Select an option", когда есть aria-labelledby (метка берёт верх)', () => {
    const tag = triggerTag(renderSelect(a11yProps));
    expect(tag).not.toContain('aria-label="Select an option"');
  });

  it('standalone Select (без ассоциации метки) сохраняет запасное доступное имя', () => {
    const tag = triggerTag(renderSelect({}));
    expect(tag).toContain('aria-label="Select an option"');
  });
});

describe('Select — токены темы вместо жёстко зашитого белого (defect 58)', () => {
  it('триггер не форсит инлайновый белый фон и использует токены темы', () => {
    const tag = triggerTag(renderSelect({}));
    expect(tag).not.toContain('background-color:white');
    expect(tag).not.toContain('!bg-white');
    expect(tag).toContain('bg-background');
    expect(tag).toContain('border-input');
  });
});
