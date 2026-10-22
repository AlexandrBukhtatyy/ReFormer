import { call, say } from './shared/model-mock';
import { FORM_A, inputNode } from './shared/forms';
import { expect, test } from './shared/fixtures';

/**
 * Ассистент: новая форма по просьбе пользователя. Каталог сценариев — `SCENARIOS.md`, группа T.
 *
 * `create_form` кладёт модуль через шаблоны (тем же путём, что окно «Создать форму»), мост
 * открывает новую форму и продолжает тот же ход на ней. Без открытой формы ход начинается с одного
 * создания: править ещё нечего.
 */

test.describe('Ассистент: новая форма', () => {
  test.setTimeout(150_000);

  test('[T16] без открытой формы: форма создаётся и заполняется тем же ходом', async ({
    builder,
    disk,
    model,
    page,
    panel,
  }) => {
    const created = 'forms/credit/schema/form.schema.json';
    await builder.openPlayground({ plugins: ['reformer/ai'] });
    await panel.connect();

    model.reply(
      call('create_form', { name: 'credit' }),
      call('insert_node', { parent: '/root', nodes: [inputNode('email', 'Почта')] }),
      say('Анкета готова.')
    );
    await panel.ask('Сделай анкету на кредит с полем «Почта».');

    // Новая форма открыта и правится: вкладка активна, поле — в дереве структуры.
    await expect(builder.tabByPath(created)).toHaveAttribute('aria-selected', 'true');
    await expect(page.getByText('Почта', { exact: true })).toBeVisible();
    const lines = panel.toolLines(panel.answer(-1));
    await expect(lines.filter({ hasText: `Создана форма ${created}` })).toHaveCount(1);
    await expect(panel.message(panel.answer(-1))).toHaveText('Анкета готова.');

    // Первая попытка видела только создание; продолжение — карту новой формы.
    expect(JSON.stringify(model.requests[0])).toContain('No form is open');
    expect(JSON.stringify(model.requests[1])).toContain(`Active form: ${created}`);

    // Модуль положили шаблоны — он на диске; правка хода — в рабочей копии поверх него.
    expect(await disk.readText(created)).toContain('"format": 2');
  });

  test('[T17] при открытой форме: новая — из шаблона, прежняя не тронута', async ({
    builder,
    model,
    panel,
  }) => {
    const created = 'forms/loan/schema/form.schema.json';
    await builder.openPlayground({ plugins: ['reformer/ai'] });
    await builder.openFile(FORM_A);
    await panel.connect();

    model.reply(
      call('create_form', { name: 'loan', template: 'builtin-simple-form' }),
      say('Форма создана по шаблону.')
    );
    await panel.ask('Сделай новую форму «loan» по простому шаблону.');

    await expect(builder.tabByPath(created)).toHaveAttribute('aria-selected', 'true');
    const lines = panel.toolLines(panel.answer(-1));
    await expect(lines.filter({ hasText: `Создана форма ${created}` })).toHaveCount(1);
    // Прежняя форма осталась как была: ход её не правил.
    expect(await builder.dirtyMark(FORM_A).count()).toBe(0);
  });
});
