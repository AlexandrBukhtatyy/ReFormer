import { readFileSync } from 'node:fs';
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

test.describe('Ассистент: режим файлов — шаги в своих файлах', () => {
  /** Шаг «Данные» из проектного шаблона «Пошаговая форма». */
  const STEP = readFileSync(
    '../reformer-builder-playground/forms/templates/reformer-multi-step-form/schema/steps/dannye/form.schema.json',
    'utf8'
  );
  const STEP_FILE = 'forms/e2e-b/schema/steps/personal/form.schema.json';
  /**
   * Корень так, как его пишет модель: формат 2 объявлен, а ссылка на шаг лежит по-старому, в
   * `componentProps.steps`. Такой корень не считался составным документом, и Ctrl+S сохранял
   * только его: файл шага оставался рабочей копией, а строка состояния говорила «Всё сохранено».
   */
  const ROOT = `${JSON.stringify(
    {
      format: 2,
      version: '1.0',
      root: {
        component: '$component(Wizard)',
        componentProps: { steps: [{ $ref: './steps/personal/form.schema.json' }] },
      },
    },
    null,
    2
  )}\n`;

  test('[F10] файл шага, созданный ходом, сохраняется вместе с корнем', async ({
    builder,
    disk,
    model,
    panel,
  }) => {
    test.setTimeout(150_000);
    await builder.goto();
    await disk.seed({ plugins: ['reformer/ai'] });
    await seedFormB(disk);
    await builder.openFolder();
    await builder.openFile(FORM_B);
    await panel.connect({ mode: 'files' });

    model.reply(
      call('read_file', { path: 'schema/form.schema.json' }),
      call('write_file', { path: 'schema/steps/personal/form.schema.json', content: STEP }),
      call('write_file', { path: 'schema/form.schema.json', content: ROOT }),
      say('Готово: мастер с шагом.')
    );
    await panel.ask('Сделай мастер.');
    await expect(panel.message(panel.answer(0))).toHaveText('Готово: мастер с шагом.');

    await builder.activateTab(FORM_B);
    await builder.save();
    await expect(builder.dirtyMark(FORM_B)).toHaveCount(0);

    await expect.poll(() => disk.exists(STEP_FILE)).toBe(true);
    expect(await disk.readText(STEP_FILE)).toContain('$model(lastName)');
    // Корень ушёл на диск форматом 2: ссылка на шаг — в children мастера.
    expect(JSON.parse(await disk.readText(FORM_B))).toMatchObject({
      root: { children: [{ $ref: './steps/personal/form.schema.json' }] },
    });
  });
});
