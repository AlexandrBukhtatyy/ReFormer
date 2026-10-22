import { call, say } from './shared/model-mock';
import { FORM_A, inputNode, savedText } from './shared/forms';
import { expect, test } from './shared/fixtures';

/** Ассистент: остановка хода и ошибки провайдера. Каталог — `SCENARIOS.md`, группы A и E. */

test.describe('Ассистент: остановка хода', () => {
  test.setTimeout(120_000);

  test('[A1] «Остановить» посреди запроса: ход закрыт без ложной заметки', async ({
    builder,
    model,
    panel,
  }) => {
    await builder.openPlayground({ plugins: ['reformer/ai'] });
    await builder.openFile(FORM_A);
    await panel.connect();

    const gate = model.held(
      call('insert_node', { parent: '/root', nodes: [inputNode('never', 'Не дойдёт')] })
    );
    await panel.send('Добавь поле.');
    await gate.reached;
    await panel.stop();
    await panel.waitIdle();
    gate.release();

    await expect(builder.dirtyMark(FORM_A)).toHaveCount(0);
    // Остановку заказал пользователь — «ассистент ничего не сделал» здесь ложь (D10).
    await expect(panel.errorAlert).toHaveCount(0);
  });
});

test.describe('Ассистент: остановка после записи и ошибки провайдера', () => {
  test.setTimeout(120_000);

  test('[A2] остановка после записи в режиме файлов — запись остаётся и отменяется', async ({
    builder,
    disk,
    model,
    page,
    panel,
  }) => {
    await builder.openPlayground({ plugins: ['reformer/ai'] });
    await builder.openFile(FORM_A);
    await panel.connect({ mode: 'files' });

    const anchor = '"placeholder": "Как к вам обращаться"';
    model.reply(
      call('read_file', { path: 'form.schema.json' }),
      call('edit_file', {
        path: 'form.schema.json',
        edits: [{ old_string: anchor, new_string: '"placeholder": "До остановки"' }],
      })
    );
    const gate = model.held(say('Не дойдёт.'));
    await panel.send('Поменяй подсказку.');
    await gate.reached;
    await panel.stop();
    await panel.waitIdle();
    gate.release();

    await expect(page.getByText('form.schema.json (+1 −1)')).toBeVisible();
    await expect(panel.errorAlert).toHaveCount(0);
    await expect(panel.undoTurnButton).toBeEnabled();
    await panel.undoTurnButton.click();
    await expect(panel.undoTurnButton).toBeDisabled();
    expect(await savedText(builder, disk, FORM_A)).toContain('Как к вам обращаться');
  });

  test('[E1] сервер отвечает 500 — повтор, затем ошибка в ленте', async ({
    builder,
    model,
    pageErrors,
    panel,
  }) => {
    await builder.openPlayground({ plugins: ['reformer/ai'] });
    await builder.openFile(FORM_A);
    await panel.connect();

    // Сколько раз повторить запрос, решает SDK (попытки запроса и потока); сценарию важно, что
    // повтор был и что ошибка в итоге видна, — ответов в очереди с запасом.
    model.reply(...Array.from({ length: 4 }, () => ({ status: 500 })));
    await panel.ask('Добавь поле.');

    expect(model.requests.length).toBeGreaterThanOrEqual(2);
    await expect(panel.errorAlert).toBeVisible();
    await expect(builder.dirtyMark(FORM_A)).toHaveCount(0);
    // Ошибки консоли здесь — по сценарию: браузер пишет каждый ответ 500 как неудачную загрузку.
    // Сам ассистент в консоль не пишет ничего: ошибку хода показывает лента.
    expect(pageErrors.every((error) => error.includes('status of 500'))).toBe(true);
    pageErrors.length = 0;
  });
});
