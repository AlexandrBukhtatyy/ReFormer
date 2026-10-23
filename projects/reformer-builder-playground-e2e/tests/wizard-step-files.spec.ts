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
