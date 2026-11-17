import { call, say } from './shared/model-mock';
import { FORM_A, inputNode } from './shared/forms';
import { expect, test } from './shared/fixtures';
import type { BuilderApp } from '../shared/builder-app.pom';
import type { PlaygroundDisk } from '../shared/playground-disk';

/**
 * Ассистент: генерация кода формы по просьбе пользователя. Каталог сценариев — `SCENARIOS.md`,
 * группы T и F.
 *
 * `generate_code` только заказывает генерацию: её проводит мост один раз, после правок хода, тем же
 * прогоном, что у панели экспорта, и дверью записи хода. Файлы модуля ход сохраняет на диск вместе
 * с формой (ReFormer-v5f1): чтобы код появился в файлах, Ctrl+S не нужен.
 */

const TYPES = 'forms/contact/types/contact.ts';

/** Файл вне формы, который человек правит в редакторе, — несохранённое человека. */
const NOTES = 'notes.ts';
const ORIGINAL = ['// notes', 'export const first = 1;', ''].join('\n');
const MONACO_SCOPE = '[data-rb-plugin="reformer.editor-monaco"]';

/**
 * Типы модуля — с диска сразу после хода. Генерация пишет в НОВЫЕ папки модуля (`types/`), и ход
 * сохраняет их сам: файл открывается без отметки несохранённого.
 */
async function typesOnDisk(builder: BuilderApp, disk: PlaygroundDisk): Promise<string> {
  await expect.poll(() => disk.exists(TYPES)).toBe(true);
  await builder.openFile(TYPES);
  await expect(builder.dirtyMark(TYPES)).toHaveCount(0);
  return disk.readText(TYPES);
}

test.describe('Ассистент: генерация кода', () => {
  test.setTimeout(150_000);

  test('[T15] модуль печатается после правок хода и сохраняется вместе с ними', async ({
    builder,
    disk,
    model,
    panel,
  }) => {
    await builder.openPlayground({ plugins: ['reformer/ai'] });
    await builder.openFile(FORM_A);
    await panel.connect();

    model.reply(
      call('insert_node', { parent: '/root', nodes: [inputNode('phone', 'Телефон')] }),
      call('generate_code', {}),
      say('Поле добавлено, код сгенерирован.')
    );
    await panel.ask('Добавь телефон и сгенерируй код формы.');

    // Строка журнала — одна: модуль напечатала запись хода, и заказ второго прогона не дал.
    const lines = panel.toolLines(panel.answer(-1));
    await expect(lines.filter({ hasText: 'Код модуля обновлён в forms/contact' })).toHaveCount(1);
    await expect(lines.filter({ hasText: 'Код формы сгенерирован' })).toHaveCount(0);
    await expect(lines.filter({ hasText: 'Сохранено на диск' })).toHaveCount(1);
    await expect(panel.failedToolLines(panel.answer(-1))).toHaveCount(0);

    // Модуль напечатан из формы ПОСЛЕ правки: в типах есть поле, добавленное этим же ходом.
    expect(await typesOnDisk(builder, disk)).toContain('phone');
  });

  test('[T19] ход сам уносит на диск форму и код модуля', async ({
    builder,
    disk,
    model,
    panel,
  }) => {
    const created = 'forms/saved/schema/form.schema.json';
    const code = [
      'forms/saved/types/saved.ts',
      'forms/saved/model/model.ts',
      'forms/saved/validation/form.ts',
    ];
    await builder.openPlayground({ plugins: ['reformer/ai'] });
    await panel.connect();

    model.reply(
      call('create_form', { name: 'saved' }),
      call('insert_node', { parent: '/root', nodes: [inputNode('email', 'Почта')] }),
      say('Анкета готова.')
    );
    await panel.ask('Сделай анкету с полем «Почта».');

    // Ход сохраняет свои файлы сам — без Ctrl+S (ReFormer-v5f1).
    const lines = panel.toolLines(panel.answer(-1));
    await expect(lines.filter({ hasText: 'Сохранено на диск' })).toHaveCount(1);
    await expect(builder.statusBar).toContainText('Всё сохранено');
    expect(await disk.readText(created)).toContain('email');
    for (const path of code) expect(await disk.exists(path)).toBe(true);
    expect(await disk.readText('forms/saved/types/saved.ts')).toContain('email');
  });

  test('[T20] ход сохраняет только свои файлы: несохранённое человека остаётся', async ({
    builder,
    disk,
    model,
    page,
    panel,
  }) => {
    const types = 'forms/single/types/single.ts';
    await builder.goto();
    await disk.seed({ plugins: ['reformer/ai'] });
    await disk.writeText(NOTES, ORIGINAL);
    await builder.openFolder();
    // Несохранённое человека — правка в редакторе файла вне формы.
    await builder.openFile(NOTES);
    const editor = page.locator(`${MONACO_SCOPE} .monaco-editor`).filter({ visible: true }).first();
    await editor.locator('.view-line', { hasText: 'first = 1' }).click();
    await page.keyboard.press('End');
    await page.keyboard.type(' // ours');
    await expect(builder.statusBar).toContainText('1 несохранённый файл');
    await panel.connect();

    model.reply(
      // Каталог назван: иначе форма ложится рядом с активным файлом — в корень проекта.
      call('create_form', { name: 'single', folder: 'forms' }),
      call('insert_node', { parent: '/root', nodes: [inputNode('email', 'Почта')] }),
      say('Анкета готова.')
    );
    await panel.ask('Сделай анкету с полем «Почта».');

    await expect.poll(() => disk.exists(types)).toBe(true);
    expect(await disk.readText('forms/single/schema/form.schema.json')).toContain('email');
    // Чужое ход не трогает: правка человека не на диске, строка состояния помнит о ней.
    expect(await disk.readText(NOTES)).toBe(ORIGINAL);
    await expect(builder.statusBar).toContainText('1 несохранённый файл');
  });

  test('[F11] режим файлов: модуль печатается из того, что модель записала', async ({
    builder,
    disk,
    model,
    panel,
  }) => {
    await builder.openPlayground({ plugins: ['reformer/ai'] });
    await builder.openFile(FORM_A);
    await panel.connect({ mode: 'files' });

    const email = '"label": "Email"\n            }\n          }';
    const phone =
      `${email},\n          {\n            "$nodeId": "e2ephone",\n            "selector": "phone",\n` +
      '            "model": "$model(phone)",\n            "component": "$component(Input)",\n' +
      '            "componentProps": {\n              "label": "Телефон"\n            }\n          }';
    model.reply(
      call('read_file', { path: 'form.schema.json' }),
      call('edit_file', {
        path: 'form.schema.json',
        edits: [{ old_string: email, new_string: phone }],
      }),
      call('generate_code', {}),
      say('Готово.')
    );
    await panel.ask('Добавь телефон и сгенерируй код формы.');

    const lines = panel.toolLines(panel.answer(-1));
    await expect(lines.filter({ hasText: 'Код формы сгенерирован в forms/contact' })).toHaveCount(
      1
    );
    expect(await typesOnDisk(builder, disk)).toContain('phone');
  });
});
