import path from 'path';
import type { Locator, Page } from '@playwright/test';
import { test, expect } from '../shared/fixtures';
import type { BuilderApp } from '../shared/builder-app.pom';
import type { PlaygroundDisk } from '../shared/playground-disk';
import { dropKnownKitNoise, KIT_PLUGIN, selectHexaKit } from '../shared/hexa-kit';
import { test as assistantTest } from '../assistant/shared/fixtures';
import { call, say } from '../assistant/shared/model-mock';
import { inputNode } from '../assistant/shared/forms';

/**
 * Скриншоты для раздела «Билдер» сайта документации (`projects/reformer-doc/docs/builder`).
 *
 * Не проверка, а съёмка: каждый тест приводит билдер в состояние, которое описывает страница,
 * и снимает его. Отобранные снимки копируются руками в `projects/reformer-doc/static/img/builder/`
 * — это уже контент сайта.
 *
 * Набор включается переменной `BUILDER_DOCS_SCREENSHOTS=1`: в обычном прогоне e2e и в CI снимать
 * незачем, а копия проекта с ассистентом и китом HexaUI стоит секунд.
 *
 * ```bash
 * cd projects/reformer-builder-playground-e2e
 * BUILDER_DOCS_SCREENSHOTS=1 npx playwright test tests/docs
 * ```
 *
 * Снимки — `projects/react-playground-e2e/screenshots/builder-docs/<имя>.png`: светлая тема
 * (её закрепляет конфиг playground) и окно 1440×900 из конфига Playwright.
 */

const SHOTS = path.resolve(__dirname, '../../../react-playground-e2e/screenshots/builder-docs');

/** Форма ReFormer на снимках — копия формы playground, без черновых полей. */
const FORM = 'forms/contact/form.schema.json';

/** Форма RJSF из playground. */
const RJSF_FORM = 'forms/contact.rjsf.json';

const ENABLED = process.env.BUILDER_DOCS_SCREENSHOTS === '1';

/** Опрятная форма обращения: снимки показывают её, а не рабочую копию фикстуры e2e. */
const DEMO_FORM = `${JSON.stringify(
  {
    $schema: './form-schema.schema.json',
    format: 2,
    version: '1.0',
    root: {
      $nodeId: 'demoroot',
      component: '$html(div)',
      componentProps: { className: 'space-y-4' },
      children: [
        {
          $nodeId: 'demorows',
          component: '$html(div)',
          componentProps: { className: 'flex gap-4' },
          children: [
            {
              $nodeId: 'demoname',
              selector: 'name',
              model: '$model(name)',
              component: '$component(Input)',
              componentProps: { label: 'Имя', placeholder: 'Как к вам обращаться' },
            },
            {
              $nodeId: 'demomail',
              selector: 'email',
              model: '$model(email)',
              component: '$component(Input)',
              componentProps: { label: 'Email' },
            },
          ],
        },
        {
          $nodeId: 'demochan',
          selector: 'channel',
          model: '$model(channel)',
          component: '$component(Select)',
          componentProps: {
            label: 'Как связаться',
            options: [
              { value: 'email', label: 'Email' },
              { value: 'phone', label: 'Телефон' },
            ],
          },
        },
        {
          $nodeId: 'democomm',
          selector: 'comment',
          model: '$model(comment)',
          component: '$component(Textarea)',
          componentProps: { label: 'Комментарий' },
        },
        {
          $nodeId: 'demoagre',
          selector: 'agree',
          model: '$model(agree)',
          component: '$component(Checkbox)',
          componentProps: { label: 'Согласен на обработку данных' },
        },
      ],
    },
  },
  null,
  2
)}\n`;

/**
 * Открывает копию playground с опрятной формой. Старт оболочки ждём дольше обычного: прогон
 * идёт в несколько потоков, а кит HexaUI и ассистент делают копию проекта тяжелее.
 */
async function openDemo(
  builder: BuilderApp,
  disk: PlaygroundDisk,
  page: Page,
  plugins: readonly string[] = []
): Promise<void> {
  await page.goto('/');
  await expect(builder.statusBar).toBeVisible({ timeout: 60_000 });
  await disk.seed({ plugins });
  await disk.writeText(FORM, DEMO_FORM);
  await builder.openFolder();
}

async function shot(page: Page, name: string): Promise<void> {
  // Уведомления живут несколько секунд и закрывали бы угол снимка — ждём, пока уйдут.
  await expect(page.locator('[data-sonner-toast]')).toHaveCount(0, { timeout: 15_000 });
  // Двойной щелчок по строке дерева выделяет слово в имени файла — на снимке это шум.
  await page.evaluate(() => window.getSelection()?.removeAllRanges());
  await page.screenshot({
    path: path.join(SHOTS, `${name}.png`),
    fullPage: true,
    animations: 'disabled',
  });
}

function leftRail(page: Page, name: string): Locator {
  return page.getByRole('navigation', { name: 'Панели слева' }).getByRole('button', { name });
}

function rightRail(page: Page, name: string): Locator {
  return page.getByRole('navigation', { name: 'Панели справа' }).getByRole('button', { name });
}

/** Кнопка вида в полосе вкладки формы ReFormer: «Дерево», «Схема», «Форма», «Исходный код». */
function view(page: Page, name: string): Locator {
  return page.getByRole('main', { name: 'Редактор' }).getByRole('button', { name, exact: true });
}

function schemaTree(page: Page): Locator {
  return page.getByRole('tree', { name: 'Дерево схемы формы' });
}

test.describe('Скриншоты документации: билдер', () => {
  test.skip(!ENABLED, 'съёмка для сайта — только с BUILDER_DOCS_SCREENSHOTS=1');
  test.use({ colorScheme: 'light' });
  test.describe.configure({ timeout: 300_000 });

  test('стартовая страница', async ({ builder, page }) => {
    // Первый тест прогона встречает dev-сервер холодным: ждём оболочку дольше обычного.
    await page.goto('/');
    await expect(builder.statusBar).toBeVisible({ timeout: 60_000 });
    await expect(builder.openFolderButton).toBeVisible();
    await shot(page, 'welcome');
  });

  test('оболочка с открытой формой: дерево, свойства, журнал', async ({ builder, disk, page }) => {
    await openDemo(builder, disk, page);
    await builder.projectPluginsReady();
    await builder.openFile(FORM);
    await schemaTree(page).getByRole('treeitem', { name: 'Email' }).click();
    await rightRail(page, 'Свойства').click();
    await expect(page.getByLabel('Привязка к модели', { exact: true })).toHaveText('email');
    await shot(page, 'shell');
  });

  test('виды формы: схема, форма с моделью, быстрое добавление', async ({
    builder,
    disk,
    page,
  }) => {
    await openDemo(builder, disk, page);
    await builder.openFile(FORM);
    await leftRail(page, 'Компоненты').click();

    await view(page, 'Схема').click();
    await expect(page.getByLabel('Схема формы')).toBeVisible();
    await shot(page, 'editor-schematic');

    await view(page, 'Форма').click();
    const editor = page.getByRole('main', { name: 'Редактор' });
    const name = editor.getByRole('textbox', { name: 'Имя' });
    await expect(name).toBeVisible({ timeout: 30_000 });
    await name.fill('Анна');
    await page.getByRole('button', { name: 'Модель', exact: true }).click();
    // Панель модели показывает значение полем ввода, а тронутое поле — меткой.
    await expect(page.getByText('touched', { exact: true })).toBeVisible();
    await shot(page, 'editor-form');

    // Enter на выделенном узле дерева открывает быстрое добавление компонента.
    await view(page, 'Дерево').click();
    await schemaTree(page).getByRole('treeitem', { name: 'Комментарий' }).click();
    await page.keyboard.press('Enter');
    const quickAdd = page.getByRole('dialog', { name: 'Добавить компонент' });
    await expect(quickAdd).toBeVisible();
    await quickAdd.getByPlaceholder('Название компонента или тег').fill('date');
    await shot(page, 'quick-add');
    await page.keyboard.press('Escape');
  });

  test('палитра команд', async ({ builder, disk, page }) => {
    await openDemo(builder, disk, page);
    await builder.openFile(FORM);
    await builder.openPalette();
    await expect(builder.palette.getByRole('option').first()).toBeVisible();
    await shot(page, 'command-palette');
  });

  test('экспорт формы в код', async ({ builder, disk, page }) => {
    await openDemo(builder, disk, page);
    await builder.openFile(FORM);
    await rightRail(page, 'Экспорт формы').click();
    await page.getByRole('button', { name: 'Сгенерировать', exact: true }).click();
    await expect(builder.treeItem('forms/contact/index.ts')).toBeVisible({ timeout: 30_000 });
    await shot(page, 'codegen');
  });

  test('шаблоны форм: создание формы по шаблону', async ({ builder, disk, page }) => {
    await openDemo(builder, disk, page);
    await leftRail(page, 'Шаблоны форм').click();
    await page.getByRole('button', { name: 'Простая форма', exact: true }).click();
    const dialog = page.getByRole('dialog', { name: 'Создать форму по шаблону' });
    await dialog.getByLabel('Имя формы').fill('feedback');
    await shot(page, 'template-dialog');

    await dialog.getByRole('button', { name: 'Создать форму' }).click();
    await expect(builder.tab('form.schema.json')).toHaveAttribute('aria-selected', 'true');
    await expect(schemaTree(page)).toBeVisible();
    await shot(page, 'template-created');
  });

  test('настройки: плагины', async ({ builder, disk, page }) => {
    await openDemo(builder, disk, page);
    await builder.projectPluginsReady();
    await builder.openPalette('Настройки');
    await builder.palette.getByRole('option').first().click();
    await page.getByRole('dialog').getByRole('button', { name: 'Плагины' }).click();
    await expect(page.getByTestId('settings-plugins')).toContainText('Playground Hello');
    await shot(page, 'settings-plugins');
  });

  test('форма RJSF', async ({ builder, disk, page }) => {
    await openDemo(builder, disk, page);
    await builder.openFile(RJSF_FORM);
    await expect(page.getByTestId('rjsf-editor')).toBeVisible();
    await rightRail(page, 'Свойства').click();
    await shot(page, 'rjsf');
  });

  test.describe('кит HexaUI', () => {
    test.afterEach(({ pageErrors }) => {
      dropKnownKitNoise(pageErrors);
    });

    test('форма, нарисованная китом HexaUI', async ({ builder, disk, page }) => {
      await openDemo(builder, disk, page, [KIT_PLUGIN]);
      await selectHexaKit(builder, page);
      await builder.openFile(FORM);
      await view(page, 'Форма').click();
      await expect(
        page
          .locator('[data-rb-plugin="kit-hexa-ui"]')
          .getByRole('textbox', { name: 'Как к вам обращаться' })
      ).toBeVisible({ timeout: 30_000 });
      // Ячейка кита в строке состояния — по щелчку список китов.
      await builder.statusBar.getByRole('button', { name: 'Kaspersky HexaUI' }).click();
      await expect(page.getByRole('menuitemradio', { name: /ReFormer UI Kit/ })).toBeVisible();
      await shot(page, 'kit-hexa');
      await page.keyboard.press('Escape');
    });
  });
});

assistantTest.describe('Скриншоты документации: ассистент', () => {
  assistantTest.skip(!ENABLED, 'съёмка для сайта — только с BUILDER_DOCS_SCREENSHOTS=1');
  assistantTest.use({ colorScheme: 'light' });
  assistantTest.describe.configure({ timeout: 300_000 });

  assistantTest('настройки канала', async ({ builder, disk, page, panel }) => {
    // Список моделей — с правдоподобным именем вместо имени подмены e2e. Маршрут, заведённый
    // позже, сильнее маршрута фикстуры.
    await page.route('http://localhost:11434/v1/models', (route) =>
      route.request().method() === 'OPTIONS'
        ? route.fulfill({ status: 204, headers: { 'access-control-allow-origin': '*' } })
        : route.fulfill({
            json: { data: [{ id: 'qwen3:8b' }] },
            headers: { 'access-control-allow-origin': '*' },
          })
    );
    await openDemo(builder, disk, page, ['reformer/ai']);
    await builder.openFile(FORM);
    await panel.open();
    await panel.settingsButton.click();
    await page.getByRole('combobox', { name: 'Провайдер' }).click();
    await page.getByRole('option', { name: 'Локальный (OpenAI-совместимый)' }).click();
    await page.getByRole('button', { name: 'Загрузить список моделей' }).click();
    await expect(page.getByRole('combobox', { name: 'Модель' })).toHaveText('qwen3:8b');
    await shot(page, 'assistant-settings');
  });

  assistantTest('ход ассистента', async ({ builder, disk, model, page, panel }) => {
    await openDemo(builder, disk, page, ['reformer/ai']);
    await builder.openFile(FORM);
    await panel.connect();

    model.reply(
      call('insert_node', { parent: '/root', nodes: [inputNode('phone', 'Телефон')] }),
      say('Добавил поле «Телефон» в конец формы.')
    );
    await panel.ask('Добавь поле «Телефон».');
    await expect(schemaTree(page).getByRole('treeitem', { name: 'Телефон' })).toBeVisible();
    await shot(page, 'assistant-turn');
  });
});
