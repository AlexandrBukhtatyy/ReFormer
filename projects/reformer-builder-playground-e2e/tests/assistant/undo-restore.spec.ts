import { call, say } from './shared/model-mock';
import { FORM_A, inputNode, savedText } from './shared/forms';
import { expect, test } from './shared/fixtures';

/** Ассистент: отмена хода, «Восстановить», новый разговор. Каталог — `SCENARIOS.md`, группа U. */

test.describe('Ассистент: отмена и восстановление', () => {
  test.setTimeout(120_000);

  test('[U5] «Новый разговор» сбрасывает отмену хода прошлого разговора', async ({
    builder,
    model,
    panel,
  }) => {
    await builder.openPlayground({ plugins: ['reformer/ai'] });
    await builder.openFile(FORM_A);
    await panel.connect();

    model.reply(
      call('insert_node', { parent: '/root', nodes: [inputNode('phone', 'Телефон')] }),
      say('Добавил.')
    );
    await panel.ask('Добавь телефон.');
    await expect(panel.undoTurnButton).toBeEnabled();

    await panel.newConversationButton.click();
    await expect(panel.entries).toHaveCount(0);
    // Отменять из нового разговора ход старого нельзя: его реплик уже не видно (D7).
    await expect(panel.undoTurnButton).toBeDisabled();
  });
});

test.describe('Ассистент: отмена хода и «Восстановить»', () => {
  test.setTimeout(120_000);

  test.beforeEach(async ({ builder, panel }) => {
    await builder.openPlayground({ plugins: ['reformer/ai'] });
    await builder.openFile(FORM_A);
    await panel.connect();
  });

  test('[U1] «Отменить ход» доступна сразу после хода и возвращает форму', async ({
    builder,
    disk,
    model,
    page,
    panel,
  }) => {
    model.reply(
      call('insert_node', { parent: '/root', nodes: [inputNode('extraPhone', 'Телефон E2E')] }),
      say('Добавил.')
    );
    await panel.ask('Добавь телефон.');
    await expect(page.getByText('Телефон E2E', { exact: true })).toBeVisible();

    // Доступна без всякой перерисовки со стороны — по состоянию сессии (D11).
    await expect(panel.undoTurnButton).toBeEnabled();
    await panel.undoTurnButton.click();
    await expect(page.getByText('Телефон E2E', { exact: true })).toHaveCount(0);
    await expect(panel.undoTurnButton).toBeDisabled();

    expect(await savedText(builder, disk, FORM_A)).not.toContain('Телефон E2E');
  });

  test('[U3] «Восстановить» на реплике: форма до запроса, лента обрезана', async ({
    builder,
    disk,
    model,
    page,
    panel,
  }) => {
    model.reply(
      call('insert_node', { parent: '/root', nodes: [inputNode('extraPhone', 'Телефон E2E')] }),
      say('Добавил телефон.'),
      call('insert_node', { parent: '/root', nodes: [inputNode('city', 'Город')] }),
      say('Добавил город.')
    );
    await panel.ask('Добавь телефон.');
    await panel.ask('Добавь город.');
    await expect(page.getByText('Город', { exact: true })).toBeVisible();

    await panel.restoreButton(panel.request(1)).click();
    await expect(panel.entries).toHaveCount(2);
    await expect(page.getByText('Город', { exact: true })).toHaveCount(0);
    await expect(page.getByText('Телефон E2E', { exact: true })).toBeVisible();

    const saved = await savedText(builder, disk, FORM_A);
    expect(saved).toContain('Телефон E2E');
    expect(saved).not.toContain('Город');
  });
});
