import { readFileSync } from 'node:fs';
import { expect, test } from './shared/fixtures';

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
