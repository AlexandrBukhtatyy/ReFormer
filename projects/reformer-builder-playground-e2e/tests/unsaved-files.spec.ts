import type { Locator, Page } from '@playwright/test';
import { FORM_A } from './assistant/shared/forms';
import { call, say, type Gate, type ModelMock } from './assistant/shared/model-mock';
import type { AssistantPanel } from './assistant/shared/assistant-panel.pom';
import type { BuilderApp } from './shared/builder-app.pom';
import { expect, test } from './assistant/shared/fixtures';

/**
 * Операции над несохранённым: дерево показывает диск вместе с рабочей копией, и переименование,
 * копирование и сохранение обязаны видеть обе.
 *
 * - ReFormer-bvsl: переименование файла с правкой теряло правку;
 * - ReFormer-13j2: F2 и копирование не работали на файлах, которых на диске ещё нет;
 * - ReFormer-obou: сохранение такого файла молча затирало тёзку, появившегося на диске.
 *
 * Файлы без диска даёт ход ассистента ПОСРЕДИ хода: файл, записанный `write_file` в режиме
 * файлов, лежит только в рабочей копии — на диск ход уносит свои файлы лишь в конце
 * (ReFormer-v5f1). С медленной локальной моделью это минуты, и человек работает с деревом, пока
 * ход идёт.
 */

const MODULE = 'forms/contact';
const DRAFTS = `${MODULE}/drafts`;
const DRAFT = `${DRAFTS}/draft.ts`;
const DRAFT_TEXT = 'export const draft = 1;\n';

const NOTES = 'notes.ts';
const ORIGINAL = ['// notes', 'export const first = 1;', ''].join('\n');

const MONACO_SCOPE = '[data-rb-plugin="reformer.editor-monaco"]';

const editorOf = (page: Page): Locator =>
  page.locator(`${MONACO_SCOPE} .monaco-editor`).filter({ visible: true }).first();

/** F2 в дереве и новое имя в диалоге — как человек. */
async function rename(builder: BuilderApp, path: string, name: string): Promise<void> {
  await builder.treeItem(path).click();
  await builder.page.keyboard.press('F2');
  const dialog = builder.page.getByRole('dialog', { name: 'Переименовать' });
  await expect(dialog).toBeVisible();
  await dialog.getByRole('textbox').fill(name);
  await dialog.getByRole('textbox').press('Enter');
  await expect(dialog).toBeHidden();
}

/**
 * Ход ассистента записал черновик в модуль формы A и ждёт следующего ответа модели: черновик —
 * только в рабочей копии. Шлюз отпускает ход; тест обязан его отпустить.
 */
async function draftMidTurn(
  builder: BuilderApp,
  model: ModelMock,
  panel: AssistantPanel
): Promise<Gate> {
  await builder.openPlayground({ plugins: ['reformer/ai'] });
  await builder.openFile(FORM_A);
  await panel.connect({ mode: 'files' });
  model.reply(call('write_file', { path: 'drafts/draft.ts', content: DRAFT_TEXT }));
  const gate = model.held(say('Черновик готов.'));
  await panel.send('Сделай черновик.');
  await gate.reached;
  await expect(builder.statusBar).toContainText('несохранённ');
  await builder.expandFolder(DRAFTS);
  await expect(builder.treeItem(DRAFT)).toBeVisible();
  return gate;
}

/** Ход отпущен и закончился — после проверок, чтобы его сохранение их не задело. */
async function finishTurn(gate: Gate, panel: AssistantPanel): Promise<void> {
  gate.release();
  await panel.waitIdle();
}

test.describe('Несохранённое в дереве', () => {
  test('переименование файла с правкой уносит правку на новый адрес', async ({
    builder,
    disk,
    page,
  }) => {
    await builder.goto();
    await disk.seed();
    await disk.writeText(NOTES, ORIGINAL);
    await builder.openFolder();
    await builder.openFile(NOTES);
    await editorOf(page).locator('.view-line', { hasText: 'first = 1' }).click();
    await page.keyboard.press('End');
    await page.keyboard.type(' // ours');
    await expect(builder.statusBar).toContainText('1 несохранённый файл');

    await rename(builder, NOTES, 'renamed.ts');

    await expect(builder.treeItem('renamed.ts')).toBeVisible();
    await expect(builder.treeItem(NOTES)).toHaveCount(0);
    // Правка не исчезла: счётчик тот же, на диске под новым именем — сохранённая версия.
    await expect(builder.statusBar).toContainText('1 несохранённый файл');
    expect(await disk.readText('renamed.ts')).toBe(ORIGINAL);

    await builder.openFile('renamed.ts');
    await expect(builder.dirtyMark('renamed.ts')).toHaveCount(1);
    await builder.save();
    await expect(builder.statusBar).toContainText('Всё сохранено');
    expect(await disk.readText('renamed.ts')).toContain('first = 1; // ours');
  });

  test('F2 на файле, которого на диске ещё нет', async ({ builder, disk, model, panel }) => {
    test.setTimeout(150_000);
    const gate = await draftMidTurn(builder, model, panel);

    await rename(builder, DRAFT, 'renamed.ts');

    await expect(builder.treeItem(`${DRAFTS}/renamed.ts`)).toBeVisible();
    await expect(builder.treeItem(DRAFT)).toHaveCount(0);
    expect(await disk.exists(`${DRAFTS}/renamed.ts`)).toBe(false);
    await finishTurn(gate, panel);
  });

  test('копия каталога, которого на диске ещё нет', async ({
    builder,
    disk,
    model,
    page,
    panel,
  }) => {
    test.setTimeout(150_000);
    const gate = await draftMidTurn(builder, model, panel);

    await builder.treeItem(DRAFTS).click();
    await page.keyboard.press('ControlOrMeta+c');
    // Щелчок по каталогу сворачивает его — вставка уходит в него же.
    await builder.treeItem(MODULE).click();
    await page.keyboard.press('ControlOrMeta+v');

    await builder.expandFolder(`${MODULE}/drafts-2`);
    await expect(builder.treeItem(`${MODULE}/drafts-2/draft.ts`)).toBeVisible();
    expect(await disk.exists(`${MODULE}/drafts-2/draft.ts`)).toBe(false);
    await finishTurn(gate, panel);
  });

  test('сохранение не затирает тёзку, появившегося на диске: вопрос о слиянии', async ({
    builder,
    disk,
    model,
    page,
    panel,
  }) => {
    test.setTimeout(150_000);
    const gate = await draftMidTurn(builder, model, panel);
    const theirs = '// написано снаружи\n';
    await disk.writeText(DRAFT, theirs);

    await page.keyboard.press('ControlOrMeta+Alt+s');

    const dialog = page.getByRole('dialog', { name: 'Файл «draft.ts» изменился в источнике' });
    await expect(dialog).toBeVisible();
    expect(await disk.readText(DRAFT)).toBe(theirs);

    await dialog.getByRole('button', { name: 'Переписать своей версией' }).click();
    await expect(dialog).toBeHidden();
    await expect.poll(() => disk.readText(DRAFT)).toBe(DRAFT_TEXT);
    await finishTurn(gate, panel);
  });
});
