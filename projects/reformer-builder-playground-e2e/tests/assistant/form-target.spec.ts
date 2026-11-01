import type { BuilderApp } from '../shared/builder-app.pom';
import type { PlaygroundDisk } from '../shared/playground-disk';
import { call, lastUserText, say, textOf, toolResults } from './shared/model-mock';
import { FORM_A, FORM_B, inputNode, savedText, seedFormB } from './shared/forms';
import { expect, test } from './shared/fixtures';

/**
 * Форма хода — не только активная вкладка. Каталог сценариев — `SCENARIOS.md`, группа W.
 *
 * Ход берёт форму, закреплённую в «Правит: …», форму вкладки или форму файла её модуля; иначе
 * модель решает «новая или существующая», а какую существующую — выбирает человек карточкой. Форма
 * хода не по вкладке открывается в фоне: активной остаётся вкладка человека, а вкладку формы
 * помечает ассистент.
 */

/** Файл модуля формы A — не форма, но принадлежит ей. */
const MODULE_FILE = 'forms/contact/notes.md';

/** Подсказка пометки формы идущего хода. */
const TURN_MARK = 'Ассистент правит эту форму';

/** Открывает playground с формой B и файлом модуля A на «диске». */
async function openProject(builder: BuilderApp, disk: PlaygroundDisk): Promise<void> {
  await builder.goto();
  await disk.seed({ plugins: ['reformer/ai'] });
  await seedFormB(disk);
  await disk.writeText(MODULE_FILE, '# Заметки к форме\n');
  await builder.openFolder();
}

test.describe('Ассистент: форма хода не только по вкладке', () => {
  test.setTimeout(150_000);

  test('[W1/T8] вкладка не форма: карточка со всеми формами, выбор закрепляет форму', async ({
    builder,
    disk,
    model,
    panel,
  }) => {
    await openProject(builder, disk);
    await builder.openFile('README.md');
    await panel.connect();
    await expect(panel.composerTarget).toHaveText(/Форма не выбрана/);

    model.reply(call('choose_form', {}));
    await panel.send('Добавь поле телефона.');
    const card = panel.questionCard();
    await expect(card).toContainText('С какой формой работаем?');
    await expect(panel.option('contact')).toBeVisible();
    await expect(panel.option('e2e-b')).toBeVisible();

    model.reply(
      call('insert_node', { parent: '/root', nodes: [inputNode('smsPhone', 'Номер для СМС')] }),
      say('Добавил номер.')
    );
    await panel.option('e2e-b').click();
    await panel.submitAnswer().click();
    await panel.waitIdle();

    // Ход шёл в фоне: активной осталась вкладка человека.
    await expect(builder.tabByPath('README.md')).toHaveAttribute('aria-selected', 'true');
    // Подсказка продолжения стоит перед затравкой формы — ищется во всём запросе.
    expect(textOf(model.requests[1])).toContain(`The user chose the form ${FORM_B}`);
    // Выбор закрепил форму: вторая реплика с той же вкладки не спрашивает.
    await expect(panel.composerTarget).toHaveText(`Правит: ${FORM_B}`);
    await expect(panel.composerTarget).toHaveAttribute('data-pinned', 'true');

    model.reply(
      call('insert_node', {
        parent: '/root',
        nodes: [inputNode('backupEmail', 'Резервная почта')],
      }),
      say('Добавил почту.')
    );
    await panel.ask('И резервную почту.');
    // Первый ход — три запроса: выбор, вставка, ответ; второй начинается с четвёртого.
    expect(lastUserText(model.requests[3])).toContain('picked this form in the assistant panel');

    const b = await savedText(builder, disk, FORM_B);
    expect(b).toContain('Номер для СМС');
    expect(b).toContain('Резервная почта');
    // Форму A ход не открывал — она на «диске» как была.
    expect(await disk.readText(FORM_A)).not.toContain('Номер для СМС');
  });

  test('[W2] файл модуля на вкладке: ход правит его форму, вкладка формы помечена во время хода', async ({
    builder,
    disk,
    model,
    panel,
  }) => {
    await openProject(builder, disk);
    await builder.openFile(MODULE_FILE);
    await panel.connect();
    await expect(panel.composerTarget).toHaveText(`Правит: ${FORM_A}`);

    const gate = model.held(
      call('insert_node', { parent: '/root', nodes: [inputNode('note', 'Комментарий')] })
    );
    model.reply(say('Добавил комментарий.'));
    await panel.send('Добавь поле комментария.');
    await gate.reached;

    // Форма открыта в фоне и помечена; активна вкладка человека.
    await expect(builder.tabByPath(FORM_A).getByTitle(TURN_MARK)).toBeVisible();
    await expect(builder.tabByPath(MODULE_FILE)).toHaveAttribute('aria-selected', 'true');
    gate.release();
    await panel.waitIdle();

    await expect(builder.tabByPath(FORM_A).getByTitle(TURN_MARK)).toHaveCount(0);
    expect(lastUserText(model.requests[0])).toContain(`The user is looking at ${MODULE_FILE}`);
    expect(await savedText(builder, disk, FORM_A)).toContain('Комментарий');
  });

  test('[W3] выбор в «Правит»: закреплённая форма важнее вкладки, снять — снова по вкладке', async ({
    builder,
    disk,
    model,
    panel,
    page,
  }) => {
    await openProject(builder, disk);
    await builder.openFile(FORM_A);
    await panel.connect();

    await panel.composerTarget.click();
    await page.getByRole('option', { name: /e2e-b/ }).click();
    await expect(panel.composerTarget).toHaveText(`Правит: ${FORM_B}`);

    model.reply(
      call('insert_node', { parent: '/root', nodes: [inputNode('city', 'Город')] }),
      say('Добавил город.')
    );
    await panel.ask('Добавь город.');
    expect(await savedText(builder, disk, FORM_B)).toContain('Город');
    expect(await savedText(builder, disk, FORM_A)).not.toContain('Город');

    await page.getByRole('button', { name: /Снять закрепление/ }).click();
    await builder.activateTab(FORM_A);
    await expect(panel.composerTarget).toHaveText(`Правит: ${FORM_A}`);
    await expect(panel.composerTarget).not.toHaveAttribute('data-pinned', 'true');
  });

  test('[W4] пункт меню дерева закрепляет форму в ассистенте', async ({
    builder,
    disk,
    panel,
    page,
  }) => {
    await openProject(builder, disk);
    await builder.openFile(FORM_A);
    await panel.connect();

    await builder.expandFolder('forms/e2e-b/schema');
    await builder.treeItem(FORM_B).click({ button: 'right' });
    await page.getByRole('menuitem', { name: 'Работать с формой в ассистенте' }).click();

    await expect(panel.composerTarget).toHaveText(`Правит: ${FORM_B}`);
    await expect(panel.composerTarget).toHaveAttribute('data-pinned', 'true');
  });

  test('[W5] create_form с именем существующей формы — отказ, а не дубль', async ({
    builder,
    disk,
    model,
    panel,
  }) => {
    await openProject(builder, disk);
    await builder.openFile('README.md');
    await panel.connect();

    model.reply(call('create_form', { name: 'contact' }), say('Такая форма уже есть.'));
    await panel.ask('Сделай форму contact.');

    const result = toolResults(model.requests[1]).join('\n');
    expect(result).toContain('already exists');
    expect(result).toContain('choose_form');
    await builder.expandFolder('forms');
    await expect(builder.treeItem('forms/contact-2')).toHaveCount(0);
  });
});
