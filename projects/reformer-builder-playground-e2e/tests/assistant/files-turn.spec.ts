import { call, say } from './shared/model-mock';
import { FORM_A, FORM_B, FORM_B_FIELD, seedFormB } from './shared/forms';
import { expect, test } from './shared/fixtures';

/** Ассистент: ход в режиме файлов. Каталог сценариев — `SCENARIOS.md`, группа F. */

test.describe('Ассистент: режим файлов', () => {
  test('[F1] правка файла ассистентом видна в дереве открытой формы', async ({
    builder,
    model,
    page,
    panel,
  }) => {
    // Ход ассистента в режиме файлов пишет файл формы службой документов, мимо модели
    // редактора. Открытие вкладки зовёт `open` рабочей области несколько раз подряд, и пока
    // одновременные открытия не сводились в одно, каждое заводило свой буфер: модель
    // редактора смотрела в первый, а запись попадала в последний. Файл менялся, дерево — нет.
    test.setTimeout(120_000);
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
      say('Готово: поле «Телефон» добавлено.')
    );
    await builder.openPlayground({ plugins: ['reformer/ai'] });
    await builder.openFile(FORM_A);
    await panel.connect({ mode: 'files' });

    await panel.ask('Добавь поле «Телефон».');
    await expect(panel.message(panel.answer(0))).toHaveText('Готово: поле «Телефон» добавлено.');
    await expect(page.getByText('form.schema.json (+9 −0)')).toBeVisible();

    // Узел нового поля — строкой дерева, с подписью и путём модели.
    await expect(page.getByText('Телефон', { exact: true })).toBeVisible();
    await expect(page.getByText('phone', { exact: true })).toBeVisible();
  });
});

test.describe('Ассистент: режим файлов — вложенная раскладка', () => {
  test('[F2] правка документа формы в schema/ вложенного модуля', async ({
    builder,
    disk,
    model,
    page,
    panel,
  }) => {
    test.setTimeout(120_000);
    await builder.goto();
    await disk.seed({ plugins: ['reformer/ai'] });
    await seedFormB(disk);
    await builder.openFolder();
    await builder.openFile(FORM_B);
    await panel.connect({ mode: 'files' });

    model.reply(
      call('edit_file', {
        path: 'schema/form.schema.json',
        edits: [{ old_string: FORM_B_FIELD, new_string: 'ФИО полностью' }],
      }),
      say('Переименовал поле.')
    );
    await panel.ask('Переименуй поле.');

    await expect(page.getByText('form.schema.json (+1 −1)')).toBeVisible();
    await builder.save();
    await expect(builder.dirtyMark(FORM_B)).toHaveCount(0);
    expect(await disk.readText(FORM_B)).toContain('ФИО полностью');
  });
});
