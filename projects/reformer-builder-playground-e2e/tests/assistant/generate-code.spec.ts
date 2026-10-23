import { call, say } from './shared/model-mock';
import { FORM_A, inputNode, savedText } from './shared/forms';
import { expect, test } from './shared/fixtures';
import type { BuilderApp } from '../shared/builder-app.pom';
import type { PlaygroundDisk } from '../shared/playground-disk';

/**
 * Ассистент: генерация кода формы по просьбе пользователя. Каталог сценариев — `SCENARIOS.md`,
 * группы T и F.
 *
 * `generate_code` только заказывает генерацию: её проводит мост один раз, после правок хода, тем же
 * прогоном, что у панели экспорта, и дверью записи хода. Файлы модуля остаются несохранённой
 * рабочей копией — сохранить их решает человек.
 */

const TYPES = 'forms/contact/types/contact.ts';

/**
 * Типы модуля — из дерева ресурсов, и с диска после сохранения. Генерация пишет в НОВЫЕ папки
 * модуля (`types/`), которых на диске ещё нет: дерево показывает их рабочей копией, и файл
 * открывается до сохранения.
 */
async function typesFromTree(builder: BuilderApp, disk: PlaygroundDisk): Promise<string> {
  await builder.openFile(TYPES);
  await expect(builder.dirtyMark(TYPES)).toHaveCount(1);
  return savedText(builder, disk, TYPES);
}

test.describe('Ассистент: генерация кода', () => {
  test.setTimeout(150_000);

  test('[T15] модуль печатается после правок хода и лежит рабочей копией', async ({
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

    // Строка журнала — одна, с исходом прогона: заказ генерации отдельной строки не даёт.
    const lines = panel.toolLines(panel.answer(-1));
    await expect(lines.filter({ hasText: 'Код формы сгенерирован в forms/contact' })).toHaveCount(
      1
    );
    await expect(panel.failedToolLines(panel.answer(-1))).toHaveCount(0);

    // Модуль напечатан из формы ПОСЛЕ правки: в типах есть поле, добавленное этим же ходом.
    expect(await typesFromTree(builder, disk)).toContain('phone');
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
    expect(await typesFromTree(builder, disk)).toContain('phone');
  });
});
