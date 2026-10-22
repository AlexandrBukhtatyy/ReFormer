/**
 * Граница стилей HexaUI в приложении — в настоящем Chromium, рядом со стилями Tailwind.
 *
 * Прогон подключён к тому же Vite-плагину, что и приложение (`hexaUiStyles()` в
 * `vitest.browser.config.ts`), и к той же таблице, что у билдера: Tailwind с preflight. Ресет
 * antd и голые `h3` CSS-модулей HexaUI действуют внутри `KitProvider` и не задевают соседей:
 * ни шрифт, ни цвет ссылок, ни заголовки за пределами провайдера не меняются.
 *
 * @module reformer/kit-hexa-ui/styles-boundary.browser.test
 */

import { describe, expect, it, vi } from 'vitest';
// Импорт кнопки HexaUI вставляет её CSS-модуль — тот, что несёт голое `h3 { … }`.
import { Button } from '@kaspersky/hexa-ui/button';
import { renderReact } from '../../.shared/render';
import { HEXA_SCOPE_ATTRIBUTE, KitProvider } from './provider';

/** Монтирует приложение и форму рядом; ждёт, пока React отрисует обе (монтаж асинхронный). */
async function mount(): Promise<HTMLElement> {
  const { container } = renderReact(
    <div>
      <section data-testid="app">
        <h1>Приложение</h1>
        <h3>Раздел приложения</h3>
        <a href="#app">Ссылка приложения</a>
      </section>
      <KitProvider>
        <section data-testid="kit">
          <h3>Раздел формы</h3>
          <a href="#kit">Ссылка формы</a>
          <Button text="Отправить" />
        </section>
      </KitProvider>
    </div>
  );
  await vi.waitFor(() => {
    if (container.querySelector('[data-testid="kit"] button') === null)
      throw new Error('нет формы');
  });
  return container;
}

const style = (element: Element | null): CSSStyleDeclaration => {
  if (element === null) throw new Error('узел не найден');
  return getComputedStyle(element);
};

describe('граница стилей HexaUI', () => {
  it('провайдер ставит контейнер, под который Vite-плагин ограничивает CSS', async () => {
    const container = await mount();
    // Литерал атрибута тот же, что у плагина, — сверяет `vite/scope-css.test.ts`.
    const scope = container.querySelector(`[${HEXA_SCOPE_ATTRIBUTE}]`);
    expect(style(scope).display).toBe('contents');
    expect(scope?.querySelector('[data-hexa-popup-root]')).not.toBeNull();
  });

  it('ресет antd и шрифт HexaUI — внутри провайдера, приложение их не получает', async () => {
    const container = await mount();
    const app = container.querySelector('[data-testid="app"]');
    const kit = container.querySelector('[data-testid="kit"]');

    // Решающее правило ресета — `* { font-family: "Kaspersky Sans Text", … }`.
    expect(style(kit?.querySelector('a') ?? null).fontFamily).toContain('Kaspersky');
    for (const selector of ['h1', 'h3', 'a']) {
      expect(style(app?.querySelector(selector) ?? null).fontFamily, selector).not.toContain(
        'Kaspersky'
      );
    }
    // `a { color: #1890ff }` antd — только у ссылки формы; ссылка приложения наследует цвет.
    expect(style(kit?.querySelector('a') ?? null).color).toBe('rgb(24, 144, 255)');
    expect(style(app?.querySelector('a') ?? null).color).toBe(style(app).color);
  });

  it('голое h3 из CSS-модуля кнопки HexaUI не меняет заголовки приложения', async () => {
    const container = await mount();
    const appHeading = container.querySelector('[data-testid="app"] h3');
    const kitHeading = container.querySelector('[data-testid="kit"] h3');

    // В приложении `h3` — как у preflight Tailwind: размер и насыщенность наследуются.
    expect(style(appHeading).fontWeight).toBe(style(appHeading?.parentElement ?? null).fontWeight);
    expect(style(appHeading).fontSize).toBe(style(appHeading?.parentElement ?? null).fontSize);
    // Внутри провайдера — типографика HexaUI (`--text--h3--*`).
    expect(style(kitHeading).fontSize).not.toBe(style(appHeading).fontSize);
  });
});
