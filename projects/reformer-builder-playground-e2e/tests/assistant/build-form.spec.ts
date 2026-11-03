import { call, say, toolNames, toolResults } from './shared/model-mock';
import { FORM_A } from './shared/forms';
import { expect, test } from './shared/fixtures';

/**
 * Ассистент: форма, шаг или блок одним intent — `build_form`. Каталог сценариев — `SCENARIOS.md`,
 * группа B.
 *
 * Модель сценарная. Проверяется то, чего не видят юнит-тесты инструмента: сборка доходит до
 * редактора так же, как правки остальных инструментов, — узлы в дереве структуры, одна запись хода
 * для отмены, отказ без следа в документе. Сама сборка intent — в `build-form.test.ts`, оба кита —
 * в `assistant-build-form-kits.test.ts`.
 */

const EMAIL = { name: 'email', component: 'Input', label: 'Почта E2E', required: true };
const PHONE = { name: 'phone', component: 'Input', label: 'Телефон E2E' };

test.describe('Ассистент: build_form', () => {
  test.setTimeout(150_000);

  test('[B1] новая форма одним build_form: поля в дереве, грамматика — в затравке', async ({
    builder,
    model,
    page,
    panel,
  }) => {
    const created = 'forms/contacts/schema/form.schema.json';
    await builder.openPlayground({ plugins: ['reformer/ai'] });
    await panel.connect();

    model.reply(
      call('create_form', { name: 'contacts' }),
      call('build_form', {
        intent: {
          fields: [EMAIL, PHONE],
          validation: [{ target: 'phone', rules: ['minLength(5)'] }],
        },
      }),
      say('Форма собрана.')
    );
    await panel.ask('Сделай форму контактов: почта и телефон.');

    await expect(builder.tabByPath(created)).toHaveAttribute('aria-selected', 'true');
    await expect(page.getByText('Почта E2E', { exact: true })).toBeVisible();
    await expect(page.getByText('Телефон E2E', { exact: true })).toBeVisible();
    await expect(panel.failedToolLines(panel.answer(-1))).toHaveCount(0);
    await expect(panel.message(panel.answer(-1))).toHaveText('Форма собрана.');
    // Продолжение на пустой новой форме несёт грамматику сразу: вызов без intent не нужен.
    expect(JSON.stringify(model.requests[1])).toContain('# build_form intent');
    expect(toolNames(model.requests[1])).toContain('build_form');
  });

  test('[B2] мастер по шагам: сначала шаги, затем поля каждого шага в адрес из ответа', async ({
    builder,
    model,
    page,
    panel,
  }) => {
    await builder.openPlayground({ plugins: ['reformer/ai'] });
    await panel.connect();

    model.reply(
      call('create_form', { name: 'steps' }),
      call('build_form', { intent: { steps: [{ title: 'Клиент E2E' }, { title: 'Связь E2E' }] } }),
      call('build_form', { parent: '/root/children/0/children/0', intent: { fields: [EMAIL] } }),
      call('build_form', { parent: '/root/children/0/children/1', intent: { fields: [PHONE] } }),
      say('Мастер собран.')
    );
    await panel.ask('Сделай мастер из двух шагов: клиент и связь.');

    await expect(page.getByText('Клиент E2E', { exact: true }).first()).toBeVisible();
    await expect(page.getByText('Связь E2E', { exact: true }).first()).toBeVisible();
    await expect(page.getByText('Почта E2E', { exact: true })).toBeVisible();
    await expect(panel.failedToolLines(panel.answer(-1))).toHaveCount(0);
    // Ответ первой сборки называет адреса шагов — по ним модель и наполняет шаги.
    expect(toolResults(model.requests[2]).join('\n')).toContain(
      'Steps: "Клиент E2E" /root/children/0/children/0; "Связь E2E" /root/children/0/children/1.'
    );
  });

  test('[B3] мастер с полями одним вызовом — отказ с первым вызовом по шагам, форма цела', async ({
    builder,
    model,
    panel,
  }) => {
    await builder.openPlayground({ plugins: ['reformer/ai'] });
    await builder.openFile(FORM_A);
    await panel.connect();

    model.reply(
      call('build_form', {
        parent: '/root',
        intent: {
          fields: [EMAIL, PHONE],
          steps: [
            { title: 'A', fields: ['email'] },
            { title: 'B', fields: ['phone'] },
          ],
        },
      }),
      say('Не вышло.')
    );
    await panel.ask('Добавь мастер из двух шагов.');

    await expect(panel.failedToolLines(panel.answer(0))).toHaveCount(1);
    await expect(builder.dirtyMark(FORM_A)).toHaveCount(0);
    expect(toolResults(model.requests[1]).join('\n')).toContain(
      '{"steps":[{"title":"A"},{"title":"B"}]}'
    );
  });

  test('[B4] «Отменить ход» снимает всю сборку одним шагом', async ({
    builder,
    model,
    page,
    panel,
  }) => {
    await builder.openPlayground({ plugins: ['reformer/ai'] });
    await builder.openFile(FORM_A);
    await panel.connect();

    model.reply(
      call('build_form', {
        parent: '/root',
        intent: {
          fields: [
            { ...EMAIL, name: 'extraEmail' },
            { ...PHONE, name: 'extraPhone' },
          ],
          validation: [{ target: 'extraPhone', rules: ['minLength(5)'] }],
        },
      }),
      say('Добавил блок.')
    );
    await panel.ask('Добавь почту и телефон.');
    await expect(page.getByText('Телефон E2E', { exact: true })).toBeVisible();
    await expect(builder.dirtyMark(FORM_A)).toHaveCount(1);

    await panel.undoTurnButton.click();
    await expect(page.getByText('Почта E2E', { exact: true })).toHaveCount(0);
    await expect(page.getByText('Телефон E2E', { exact: true })).toHaveCount(0);
    await expect(panel.undoTurnButton).toBeDisabled();
  });
});
