import { call, say } from './shared/model-mock';
import { FORM_A, inputNode } from './shared/forms';
import { expect, test } from './shared/fixtures';

/** Ассистент: ход структурного режима. Каталог сценариев — `SCENARIOS.md`, группа T. */

test.describe('Ассистент: структурный ход', () => {
  test.setTimeout(120_000);

  test('[T2] вставка поля: узел в дереве, строка журнала, «Восстановить» на реплике', async ({
    builder,
    model,
    page,
    panel,
  }) => {
    await builder.openPlayground({ plugins: ['reformer/ai'] });
    await builder.openFile(FORM_A);
    await panel.connect();

    model.reply(
      call('insert_node', { parent: '/root', nodes: [inputNode('phone', 'Телефон')] }),
      say('Добавил поле «Телефон».')
    );
    await panel.ask('Добавь телефон.');

    await expect(panel.message(panel.answer(0))).toHaveText('Добавил поле «Телефон».');
    await expect(panel.toolLines(panel.answer(0))).toHaveCount(1);
    await expect(panel.failedToolLines(panel.answer(0))).toHaveCount(0);
    await expect(panel.restoreButton(panel.request(0))).toBeVisible();
    await expect(page.getByText('Телефон', { exact: true })).toBeVisible();
    await expect(builder.dirtyMark(FORM_A)).toHaveCount(1);
  });

  test('[T5] все правки хода упали, а модель «отчиталась» — предупреждение', async ({
    builder,
    model,
    panel,
  }) => {
    await builder.openPlayground({ plugins: ['reformer/ai'] });
    await builder.openFile(FORM_A);
    await panel.connect();

    // Адрес из чужой формы: в форме A у корня нет столько детей.
    model.reply(
      call('insert_node', { parent: '/root/children/9', nodes: [inputNode('lost', 'Пропало')] }),
      say('Готово, добавил поле.')
    );
    await panel.ask('Добавь поле.');

    await expect(panel.failedToolLines(panel.answer(0))).toHaveCount(1);
    await expect(builder.dirtyMark(FORM_A)).toHaveCount(0);
    // Ход выглядит успешным по тексту модели — предупреждение обязано это опровергнуть (D5).
    await expect(panel.errorAlert).toBeVisible();
  });
});

test.describe('Ассистент: структурный ход — ответы и пакеты', () => {
  test.setTimeout(120_000);

  test.beforeEach(async ({ builder, panel }) => {
    await builder.openPlayground({ plugins: ['reformer/ai'] });
    await builder.openFile(FORM_A);
    await panel.connect();
  });

  test('[T1] ответ только текстом — форма не меняется, замечаний нет', async ({
    builder,
    model,
    panel,
  }) => {
    model.reply(say('В форме три поля: имя, email и способ связи.'));
    await panel.ask('Что в форме?');

    await expect(panel.message(panel.answer(0))).toHaveText(
      'В форме три поля: имя, email и способ связи.'
    );
    await expect(panel.toolLines(panel.answer(0))).toHaveCount(0);
    await expect(builder.dirtyMark(FORM_A)).toHaveCount(0);
    await expect(panel.errorAlert).toHaveCount(0);
    await expect(panel.undoTurnButton).toBeDisabled();
  });

  test('[T3] несколько вызовов в одном шаге применяются по порядку', async ({
    builder,
    model,
    page,
    panel,
  }) => {
    model.reply(
      {
        tools: [
          {
            tool: 'insert_node',
            args: { parent: '/root', nodes: [inputNode('phone', 'Телефон')] },
          },
          { tool: 'insert_node', args: { parent: '/root', nodes: [inputNode('city', 'Город')] } },
        ],
      },
      say('Добавил два поля.')
    );
    await panel.ask('Добавь телефон и город.');

    await expect(panel.toolLines(panel.answer(0))).toHaveCount(2);
    await expect(panel.failedToolLines(panel.answer(0))).toHaveCount(0);
    await expect(page.getByText('Телефон', { exact: true })).toBeVisible();
    await expect(page.getByText('Город', { exact: true })).toBeVisible();
    await expect(builder.dirtyMark(FORM_A)).toHaveCount(1);
  });

  test('[T9] ответ несколькими кусками складывается в одну реплику', async ({ model, panel }) => {
    const text = 'Сначала добавлю поле, потом сделаю его обязательным и подпишу.';
    model.reply(say(text, 6));
    await panel.ask('Что будешь делать?');

    await expect(panel.message(panel.answer(0))).toHaveText(text);
  });
});
