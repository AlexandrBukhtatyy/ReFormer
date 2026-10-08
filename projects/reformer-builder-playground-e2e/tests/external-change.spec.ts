import path from 'path';
import type { Locator, Page } from '@playwright/test';
import { test, expect } from './shared/fixtures';

/**
 * Файл проекта поправили мимо билдера — в IDE, генератором, git'ом.
 *
 * Билдер наблюдения за файлами не ведёт: о чужой правке он узнаёт, когда сам спросил источник, —
 * при сохранении и при возврате фокуса в окно. Проверяется, что узнав, он не оставляет
 * человека в тупике: правленый здесь файл при сохранении кончается вопросом (переписать, взять
 * версию источника, объединить), а не правленый просто перечитывается.
 */

/** Скриншоты — рядом с остальными снимками билдера (в git не едут). */
const SHOTS = path.resolve(
  __dirname,
  '../../react-playground-e2e/screenshots/builder-external-change'
);

const FILE = 'notes.ts';

const ORIGINAL = [
  '// notes',
  'export const first = 1;',
  'export const second = 2;',
  'export const third = 3;',
  '',
].join('\n');

/** Чужая правка ДРУГОЙ строки: с правкой билдера (строка `first`) не пересекается. */
const THEIRS_APART = ORIGINAL.replace('third = 3;', 'third = 30;');
/** Чужая правка ТОЙ ЖЕ строки, что правит билдер. */
const THEIRS_SAME = ORIGINAL.replace('first = 1;', 'first = 100;');

const MONACO_SCOPE = '[data-rb-plugin="reformer.editor-monaco"]';

/** Набор с паузой между знаками, как у человека: без неё редактор не успевает за вводом. */
const TYPING = { delay: 50 };

const editorOf = (page: Page): Locator =>
  page.locator(`${MONACO_SCOPE} .monaco-editor`).filter({ visible: true }).first();

/** Правка в билдере: строка `first` получает хвост `// ours`. */
async function editFirstLine(page: Page): Promise<void> {
  const editor = editorOf(page);
  await editor.locator('.view-line', { hasText: 'first = 1' }).click();
  await page.keyboard.press('End');
  await page.keyboard.type(' // ours', TYPING);
}

const mergeDialog = (page: Page): Locator =>
  page.getByRole('dialog', { name: 'Файл «notes.ts» изменился в источнике' });

test.describe('Файл изменён снаружи', () => {
  test.beforeEach(async ({ builder, disk }) => {
    await builder.goto();
    await disk.seed();
    await disk.writeText(FILE, ORIGINAL);
    await builder.openFolder();
    await builder.openFile(FILE);
    await expect(editorOf(builder.page).locator('.view-lines')).toContainText('first = 1');
  });

  test('сохранение спрашивает; «Переписать своей версией» пишет нашу поверх чужой', async ({
    builder,
    disk,
    page,
  }) => {
    await editFirstLine(page);
    await expect(builder.statusBar).toContainText('1 несохранённый файл');
    await disk.writeText(FILE, THEIRS_SAME);

    await builder.save();

    // Не тупик «файл изменён снаружи», а вопрос — с обеими версиями перед глазами.
    const dialog = mergeDialog(page);
    await expect(dialog).toBeVisible();
    await expect(dialog).toContainText('правки пересеклись');
    await expect(dialog).toContainText('first = 1; // ours');
    await expect(dialog).toContainText('first = 100;');
    // Пока человек не ответил, на диске лежит чужая версия: вопрос — не запись.
    expect(await disk.readText(FILE)).toBe(THEIRS_SAME);
    await page.screenshot({ path: path.join(SHOTS, '01-conflict.png') });

    await dialog.getByRole('button', { name: 'Переписать своей версией' }).click();

    await expect(dialog).toBeHidden();
    await expect(builder.statusBar).toContainText('Всё сохранено');
    expect(await disk.readText(FILE)).toBe(ORIGINAL.replace('first = 1;', 'first = 1; // ours'));
  });

  test('правки не пересеклись — «Объединить правки» сохраняет обе', async ({
    builder,
    disk,
    page,
  }) => {
    await editFirstLine(page);
    await disk.writeText(FILE, THEIRS_APART);

    await builder.save();

    // Спрашивают и здесь: чужую правку человек сделал сам, руками, и вправе её увидеть.
    const dialog = mergeDialog(page);
    await expect(dialog).toContainText('Правки не пересеклись');
    await page.screenshot({ path: path.join(SHOTS, '02-mergeable.png') });
    await dialog.getByRole('button', { name: 'Объединить правки' }).click();

    await expect(dialog).toBeHidden();
    await expect(builder.statusBar).toContainText('Всё сохранено');
    const merged = await disk.readText(FILE);
    expect(merged).toContain('first = 1; // ours');
    expect(merged).toContain('third = 30;');
    // Редактор показывает то же, что записано.
    await expect(editorOf(page).locator('.view-lines')).toContainText('third = 30;');
  });

  test('«Взять версию источника» меняет документ и на диск не пишет', async ({
    builder,
    disk,
    page,
  }) => {
    await editFirstLine(page);
    await disk.writeText(FILE, THEIRS_SAME);
    await builder.save();

    const dialog = mergeDialog(page);
    await dialog.getByRole('button', { name: 'Взять версию источника' }).click();

    await expect(dialog).toBeHidden();
    await expect(builder.statusBar).toContainText('Всё сохранено');
    await expect(editorOf(page).locator('.view-lines')).toContainText('first = 100;');
    await expect(editorOf(page).locator('.view-lines')).not.toContainText('// ours');
    expect(await disk.readText(FILE)).toBe(THEIRS_SAME);
  });

  test('отмена ничего не решает: файл не записан, вопрос вернётся при следующем сохранении', async ({
    builder,
    disk,
    page,
  }) => {
    await editFirstLine(page);
    await disk.writeText(FILE, THEIRS_SAME);
    await builder.save();
    const dialog = mergeDialog(page);
    await expect(dialog).toBeVisible();

    await dialog.getByRole('button', { name: 'Отмена' }).click();

    await expect(dialog).toBeHidden();
    await expect(builder.statusBar).toContainText('1 файл изменён снаружи');
    expect(await disk.readText(FILE)).toBe(THEIRS_SAME);

    await builder.save();
    await expect(dialog).toBeVisible();
  });

  test('не правленый здесь файл перечитывается сам — без вопроса', async ({
    builder,
    disk,
    page,
  }) => {
    await disk.writeText(FILE, THEIRS_APART);

    // Возврат фокуса в окно — момент, когда билдер спрашивает источник об открытых файлах.
    await page.evaluate(() => {
      window.dispatchEvent(new Event('focus'));
    });

    await expect(editorOf(page).locator('.view-lines')).toContainText('third = 30;');
    await expect(builder.statusBar).toContainText('Всё сохранено');
    await expect(mergeDialog(page)).toHaveCount(0);
    expect(await disk.readText(FILE)).toBe(THEIRS_APART);
  });
});
