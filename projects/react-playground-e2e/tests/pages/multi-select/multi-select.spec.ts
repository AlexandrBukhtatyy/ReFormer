import { test, expect } from '@playwright/test';
import { MultiSelectPage } from './multi-select-page.pom';

/**
 * E2E множественного выбора. Покрывает ровно то, чего не видят юниты кита: они идут через
 * `renderToStaticMarkup`, а у поповерных контролов список живёт в Portal и в SSR отсутствует.
 * Здесь же проверяется главный инвариант контракта — пустой выбор доходит до модели как `null`.
 */
test.describe('Множественный выбор', () => {
  let po: MultiSelectPage;

  test.beforeEach(async ({ page }) => {
    po = new MultiSelectPage(page);
    await po.goto();
  });

  test('стартовое состояние: нетронутые поля null, префилл приехал массивом', async () => {
    const model = await po.modelSnapshot();
    expect(model.tags).toBeNull();
    expect(model.frameworks).toBeNull();
    expect(model.countries).toBeNull();
    expect(model.days).toBeNull();
    // Префилл кладётся в setup через signalAt — если бы он ушёл в initial, поля бы не было вовсе.
    expect(model.skills).toEqual(['ts', 'react']);
  });

  test('ToggleGroupMulti: несколько значений, снятие, пустой выбор → null', async () => {
    await po.toggle('tags', 'bug');
    await po.toggle('tags', 'docs');
    await po.expectValue('tags', ['bug', 'docs']);

    await po.toggle('tags', 'bug');
    await po.expectValue('tags', ['docs']);

    // Ключевой инвариант: снятие последнего даёт null, а НЕ [].
    await po.toggle('tags', 'docs');
    await po.expectValue('tags', null);
  });

  test('ComboboxMulti: список не закрывается между выборами, чипы показывают лейблы', async () => {
    await po.open('frameworks');
    await po.option('frameworks', 'next').click();
    // Именно это отличает мультивыбор от одиночного: popover остаётся открытым.
    await expect(po.page.locator('[data-slot="popover-content"]')).toBeVisible();
    await po.option('frameworks', 'remix').click();
    await po.close();

    await expect(po.chips('frameworks')).toHaveCount(2);
    await expect(po.trigger('frameworks')).toContainText('Next.js');
    await expect(po.trigger('frameworks')).toContainText('Remix');
    await po.expectValue('frameworks', ['next', 'remix']);
  });

  test('ComboboxMulti: галочка в отмеченном чекбоксе контрастна фону, а не сливается с ним', async ({
    page,
  }) => {
    // Регрессия: CommandItem красит ЛЮБУЮ вложенную иконку в text-muted-foreground через
    // `[&_svg:not([class*='text-'])]`, и галочка внутри Checkbox получала серый поверх
    // primary-foreground — на залитом primary квадрате её было почти не видно.
    // Юнитом это не поймать: список живёт в Portal и в renderToStaticMarkup отсутствует.
    await po.open('frameworks');
    await po.option('frameworks', 'next').click();

    const colors = await page.evaluate(() => {
      const item = document.querySelector('[data-testid="input-frameworks-next"]');
      const box = item?.querySelector('[data-slot="checkbox"]');
      const svg = item?.querySelector('svg');
      if (!box || !svg) return null;
      return {
        boxBg: getComputedStyle(box).backgroundColor,
        boxColor: getComputedStyle(box).color,
        svgColor: getComputedStyle(svg).color,
      };
    });

    expect(colors).not.toBeNull();
    // Галочка обязана взять цвет текста чекбокса (primary-foreground), а не свой собственный.
    expect(colors!.svgColor).toBe(colors!.boxColor);
    // И обязана отличаться от заливки — иначе она невидима.
    expect(colors!.svgColor).not.toBe(colors!.boxBg);
    await po.close();
  });

  test('ComboboxMulti: maxItems гасит невыбранные, но снять уже выбранное можно', async () => {
    await po.pickMany('frameworks', ['next', 'remix', 'astro']);
    await po.expectValue('frameworks', ['next', 'remix', 'astro']);

    await po.open('frameworks');
    // Потолок достигнут: четвёртая опция недоступна.
    await expect(po.option('frameworks', 'nuxt')).toHaveAttribute('data-disabled', /.*/);
    // А снять выбранное — по-прежнему можно, иначе из потолка не выйти.
    await po.option('frameworks', 'astro').click();
    await po.close();
    await po.expectValue('frameworks', ['next', 'remix']);
  });

  test('SelectMulti: свой listbox с aria-multiselectable, сводка вместо чипов', async () => {
    await po.open('countries');
    await expect(po.page.locator('[role="listbox"][aria-multiselectable="true"]')).toBeVisible();
    await po.option('countries', 'ru').click();
    await po.option('countries', 'de').click();
    await po.close();

    // summaryThreshold=2: два выбранных ещё показываются чипами.
    await expect(po.chips('countries')).toHaveCount(2);

    await po.pickMany('countries', ['fr']);
    // Третье значение перешагнуло порог — чипы схлопнулись в сводку.
    await expect(po.summary('countries')).toContainText('Выбрано: 3');
    await po.expectValue('countries', ['ru', 'de', 'fr']);
  });

  test('NativeSelectMulti: нативный множественный выбор, снятие всего → null', async () => {
    await po.selectNative('days', ['mon', 'wed', 'fri']);
    await po.expectValue('days', ['mon', 'wed', 'fri']);

    await po.selectNative('days', []);
    await po.expectValue('days', null);
  });

  test('required срабатывает на пустом выборе (minLength(1) бы не сработал)', async () => {
    await po.toggle('tags', 'bug');
    await po.toggle('tags', 'bug');
    await po.expectValue('tags', null);

    await po.validate();
    await expect(po.error('tags')).toContainText('Выберите хотя бы один вариант');
  });

  test('maxLength ограничивает сверху независимо от maxItems контрола', async () => {
    await po.pickMany('frameworks', ['next', 'remix', 'astro']);
    await po.validate();
    // Ровно на границе — ошибки нет: maxItems=3 и maxLength(3) согласованы.
    await expect(po.error('frameworks')).toBeHidden();
  });

  test('страница не даёт ошибок в консоли за весь сценарий', async () => {
    await po.toggle('tags', 'feat');
    await po.pickMany('frameworks', ['astro']);
    await po.pickMany('countries', ['kz']);
    await po.selectNative('days', ['tue']);
    await po.validate();
    await po.expectNoRuntimeErrors();
  });
});
