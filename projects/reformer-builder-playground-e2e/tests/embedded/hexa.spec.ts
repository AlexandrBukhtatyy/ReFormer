/**
 * Приложение-образец рисует форму и на втором ките — Kaspersky HexaUI.
 *
 * Модуль `forms/contact-hexa` напечатан кодогеном под HexaUI: реестр импортирует кит
 * `@reformer/kit-hexa-ui`, страница оборачивает форму его провайдером. Страница грузится лениво,
 * а CSS дизайн-системы (ресет antd на `html`, `body`, теги) ограничен провайдером Vite-плагином
 * кита (`hexaUiStyles()` в `vite.config.ts` приложения). Проверяется то, что из модульных тестов
 * не видно: в настоящем приложении на Tailwind переход на страницу HexaUI и обратно не меняет
 * вида остальных страниц, а встроенный билдер с китом из плагина проекта показывает эту форму
 * в виде «Форма».
 *
 * @module tests/embedded/hexa.spec
 */

import type { Locator, Page } from '@playwright/test';
import { dropKnownKitNoise, KIT_PLUGIN, selectHexaKit } from '../shared/hexa-kit';
import { test, expect } from './shared/fixtures';

const SCHEMA = 'src/forms/contact-hexa/schema/form.schema.json';
const FORM_MODULE = 'src/forms/contact-hexa/index.ts';
const TITLE = 'Обратная связь на HexaUI';

/** Вычисленные стили узлов приложения вне формы — то, что ресет antd перекрасил бы первым. */
async function appLook(page: Page): Promise<unknown> {
  return page.evaluate(() => {
    const look = (selector: string) => {
      const element = document.querySelector(selector);
      if (element === null) return null;
      const style = getComputedStyle(element);
      return [style.fontFamily, style.fontSize, style.fontWeight, style.color, style.margin];
    };
    return {
      body: [look('body'), getComputedStyle(document.body).backgroundColor],
      brand: look('.app-header__brand'),
      link: look('.app-header__nav a'),
      heading: look('main h1'),
      paragraph: look('main p'),
    };
  });
}

const fontOf = (locator: Locator): Promise<string> =>
  locator.evaluate((element) => getComputedStyle(element).fontFamily);

test.describe('форма на ките HexaUI', () => {
  // Известный шум HexaUI под React 19 отсеивается до проверки консоли фикстурой.
  test.afterEach(({ pageErrors }) => {
    dropKnownKitNoise(pageErrors);
  });

  test('страница формы на HexaUI не перекрашивает приложение', async ({ host, page }) => {
    await host.goto('/');
    const before = await appLook(page);
    const navigation = page.getByRole('navigation', { name: 'Разделы приложения' });

    await navigation.getByRole('link', { name: 'Форма на HexaUI' }).click();
    await expect(page.getByRole('heading', { name: TITLE })).toBeVisible();
    const form = page.locator('[data-hexa-root]');
    await expect(form.getByRole('button', { name: 'Отправить' })).toBeVisible();

    // Внутри провайдера — шрифт дизайн-системы, у шапки приложения на той же странице — свой.
    expect(await fontOf(form.getByRole('textbox').first())).toContain('Kaspersky');
    expect(await fontOf(host.appHeader)).not.toContain('Kaspersky');

    // Назад — без загрузки документа: CSS HexaUI остался на странице, а вид прежний.
    await navigation.getByRole('link', { name: 'Главная' }).click();
    await expect(page.getByRole('heading', { name: 'Сервис доставки' })).toBeVisible();
    await expect(page.locator('style.hexa-ui-fonts')).toHaveCount(1);
    expect(await appLook(page)).toEqual(before);
  });

  test('кит из плагина проекта: вид «Форма» рисует модуль на HexaUI', async ({
    host,
    disk,
    page,
  }) => {
    test.setTimeout(120_000);
    await host.goto('/');
    await host.openBuilder();
    await disk.seed({ plugins: [KIT_PLUGIN] });
    await host.builder.openFolder();
    // Конфиг запуска прогона — пресет ui-kit: кит HexaUI выбирается в строке состояния.
    await selectHexaKit(host.builder, page, host.shell);

    await host.builder.openFile(SCHEMA);
    await host.showForm();

    await expect(host.form.getByRole('heading', { name: TITLE })).toBeVisible();
    // Провайдер кита напечатан в странице формы — граница стилей на стенде есть.
    await expect(host.form.locator('[data-hexa-root]')).toHaveCount(1);
    await expect(
      host.form.locator('[data-hexa-root]').getByRole('button', { name: 'Отправить' })
    ).toBeVisible();
    await host.expectFormOf(FORM_MODULE);
  });
});
