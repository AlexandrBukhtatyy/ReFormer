import { readFileSync } from 'node:fs';
import type { Locator, Page } from '@playwright/test';
import type { BuilderApp } from './shared/builder-app.pom';
import { expect, test } from './shared/fixtures';
import type { PlaygroundDisk } from './shared/playground-disk';

/**
 * Превью мастера, шаги которого лежат в своих файлах и подключены ссылками `$ref`.
 *
 * Оболочка собирает форму из корня и файлов шагов (способность `composition` провайдера схемы),
 * и превью рисует собранную. Ссылки бывают записаны тремя способами — и все три обязаны дать
 * одну и ту же форму: формат 2 (ссылки в `children` мастера), прежний формат (в
 * `componentProps.steps`) и смесь — формат 2 объявлен, а ссылки лежат по-старому. Смесь пишет
 * модель в режиме файлов; её перевод пропускал, и превью рисовало ссылки пустыми шагами.
 */

/** Файл шага «Данные» из проектного шаблона «Пошаговая форма». */
const STEP = readFileSync(
  '../reformer-builder-playground/forms/templates/reformer-multi-step-form/schema/steps/dannye/form.schema.json',
  'utf8'
);
const REF = './steps/personal/form.schema.json';

const ROOTS = {
  'формат 2: ссылки в children': {
    format: 2,
    version: '1.0',
    root: { component: '$component(Wizard)', children: [{ $ref: REF }] },
  },
  'прежний формат: ссылки в componentProps.steps': {
    version: '1.0',
    root: { component: '$component(Wizard)', componentProps: { steps: [{ $ref: REF }] } },
  },
  'формат 2 со ссылками по-старому': {
    format: 2,
    version: '1.0',
    root: { component: '$component(Wizard)', componentProps: { steps: [{ $ref: REF }] } },
  },
} as const;

test.describe('Превью мастера с шагами в отдельных файлах', () => {
  for (const [name, root] of Object.entries(ROOTS)) {
    test(name, async ({ builder, disk, page }) => {
      test.setTimeout(120_000);
      const dir = 'forms/wizard-refs/schema';
      await builder.goto();
      await disk.seed();
      await disk.writeText(`${dir}/form.schema.json`, `${JSON.stringify(root, null, 2)}\n`);
      await disk.writeText(`${dir}/steps/personal/form.schema.json`, STEP);
      await builder.openFolder();
      await builder.openFile(`${dir}/form.schema.json`);

      const editor = page.getByRole('main', { name: 'Редактор' });
      await editor.getByRole('button', { name: 'Форма', exact: true }).click();

      // Шаг собран из своего файла: его заголовок и поля, а не пустая ссылка.
      await expect(editor.getByRole('textbox', { name: 'Фамилия' })).toBeVisible({
        timeout: 30_000,
      });
      await expect(
        editor
          .getByRole('navigation', { name: 'Form steps' })
          .getByRole('button', { name: /Данные/ })
      ).toBeVisible();
    });
  }
});

test('файла шага нет: корень открывается текстом, а с появившимся шагом — формой', async ({
  builder,
  disk,
  page,
}) => {
  test.setTimeout(120_000);
  const dir = 'forms/wizard-refs/schema';
  await builder.goto();
  await disk.seed();
  await disk.writeText(
    `${dir}/form.schema.json`,
    `${JSON.stringify(ROOTS['формат 2: ссылки в children'], null, 2)}\n`
  );
  await builder.openFolder();
  await builder.openFile(`${dir}/form.schema.json`);

  // Собрать форму нечем — документ текстовый. Раньше вкладка навсегда оставалась в «Документ
  // открывается», с выключенными видами и без исходника: корень нельзя было даже поправить.
  const editor = page.getByRole('main', { name: 'Редактор' });
  await expect(editor.getByText(/Форма не собирается — документ открыт текстом/)).toBeVisible({
    timeout: 30_000,
  });
  await expect(
    page.locator('[data-rb-plugin="reformer.editor-monaco"] .monaco-editor .view-lines')
  ).toContainText('steps/personal');

  // Шаг появился — переоткрытая вкладка собирает форму.
  await disk.writeText(`${dir}/steps/personal/form.schema.json`, STEP);
  await editor.getByRole('button', { name: 'Закрыть «form.schema.json»' }).click();
  await builder.openFile(`${dir}/form.schema.json`);
  await editor.getByRole('button', { name: 'Форма', exact: true }).click();
  await expect(editor.getByRole('textbox', { name: 'Фамилия' })).toBeVisible({ timeout: 30_000 });
});

test.describe('Правка файла шага доходит до превью корня', () => {
  const DIR = 'forms/wizard-refs/schema';
  const ROOT_FILE = `${DIR}/form.schema.json`;
  const STEP_FILE = `${DIR}/steps/personal/form.schema.json`;
  const MONACO = '[data-rb-plugin="reformer.editor-monaco"] .monaco-editor';

  /** Шаг с другой подписью поля «Фамилия» — правка «снаружи», как из IDE. */
  const relabeled = (label: string): string => STEP.replace('"Фамилия"', `"${label}"`);

  /** Открывает корень мастера формой; превью показывает поле шага. */
  async function openRootAsForm(
    builder: BuilderApp,
    disk: PlaygroundDisk,
    page: Page
  ): Promise<Locator> {
    await builder.goto();
    await disk.seed();
    await disk.writeText(
      ROOT_FILE,
      `${JSON.stringify(ROOTS['формат 2: ссылки в children'], null, 2)}\n`
    );
    await disk.writeText(STEP_FILE, STEP);
    await builder.openFolder();
    await builder.openFile(ROOT_FILE);
    const editor = page.getByRole('main', { name: 'Редактор' });
    await editor.getByRole('button', { name: 'Форма', exact: true }).click();
    await expect(editor.getByRole('textbox', { name: 'Фамилия' })).toBeVisible({
      timeout: 30_000,
    });
    return editor;
  }

  test('правка шага в его вкладке', async ({ builder, disk, page }) => {
    test.setTimeout(120_000);
    const editor = await openRootAsForm(builder, disk, page);

    await builder.openFile(STEP_FILE);
    const monaco = page.locator(MONACO).filter({ visible: true }).first();
    await monaco.locator('.view-line', { hasText: '"Фамилия"' }).first().click();
    await page.keyboard.press('End');
    // Курсор — перед закрывающей кавычкой: строка `"label": "Фамилия",` кончается запятой.
    await page.keyboard.press('ArrowLeft');
    await page.keyboard.press('ArrowLeft');
    // Латиницей: символы вне латиницы Playwright шлёт мимо Monaco.
    await page.keyboard.type('XYZ', { delay: 50 });
    await expect(builder.statusBar).toContainText('1 несохранённый файл');

    await builder.activateTab(ROOT_FILE);
    await expect(editor.getByRole('textbox', { name: 'ФамилияXYZ' })).toBeVisible();
  });

  test('правка шага снаружи — при возврате фокуса', async ({ builder, disk, page }) => {
    test.setTimeout(120_000);
    const editor = await openRootAsForm(builder, disk, page);

    // Файл шага вкладкой не открыт: проверка источника раньше о нём не спрашивала.
    await disk.writeText(STEP_FILE, relabeled('Фамилия снаружи'));
    await page.evaluate(() => {
      window.dispatchEvent(new Event('focus'));
    });

    await expect(editor.getByRole('textbox', { name: 'Фамилия снаружи' })).toBeVisible();
    await expect(builder.statusBar).toContainText('Всё сохранено');
  });

  test('правка шага снаружи, пока вкладка закрыта, — при открытии', async ({
    builder,
    disk,
    page,
  }) => {
    test.setTimeout(120_000);
    const editor = await openRootAsForm(builder, disk, page);

    await editor.getByRole('button', { name: 'Закрыть «form.schema.json»' }).click();
    await disk.writeText(STEP_FILE, relabeled('Фамилия после закрытия'));
    await builder.openFile(ROOT_FILE);
    await editor.getByRole('button', { name: 'Форма', exact: true }).click();

    // Без возврата фокуса: части сверяются с источником при открытии документа. Раньше вкладка
    // к тому же показывала сеанс закрытого документа и не обновлялась уже ничем.
    await expect(editor.getByRole('textbox', { name: 'Фамилия после закрытия' })).toBeVisible();
  });
});
