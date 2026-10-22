import type { BuilderApp } from '../shared/builder-app.pom';
import type { PlaygroundDisk } from '../shared/playground-disk';
import { call, lastUserText, say, toolResults } from './shared/model-mock';
import {
  FORM_A,
  FORM_B,
  FORM_B_FIELD,
  FORM_B_MODULE,
  inputNode,
  savedText,
  seedFormB,
} from './shared/forms';
import { AGENT_FIELD, HAND_EDIT, turnWithHandEdit } from './shared/hand-edit';
import { expect, test } from './shared/fixtures';

/**
 * Ассистент и несколько форм: куда ложатся правки, когда пользователь переключается между
 * формами — между ходами и посреди хода. Каталог сценариев — `SCENARIOS.md`, группа M.
 *
 * Где легла правка, проверяется по тексту документа: вкладка формы сохраняется, и текст
 * читается с «диска». Дерево структуры показывает только активную форму, а сохранённый текст
 * однозначен для обеих.
 */

/** Открывает playground с формой B на «диске». */
async function openWithFormB(builder: BuilderApp, disk: PlaygroundDisk): Promise<void> {
  await builder.goto();
  await disk.seed({ plugins: ['reformer/ai'] });
  await seedFormB(disk);
  await builder.openFolder();
}

test.describe('Ассистент: несколько форм', () => {
  test.setTimeout(150_000);

  test('[M1] структурный режим: ход на A, затем ход на B — каждая правка в своей форме', async ({
    builder,
    disk,
    model,
    panel,
  }) => {
    await openWithFormB(builder, disk);
    await builder.openFile(FORM_A);
    await panel.connect();

    model.reply(
      call('insert_node', { parent: '/root', nodes: [inputNode('fieldA', 'Поле хода A')] }),
      say('Добавил поле в форму A.')
    );
    await panel.ask('Добавь поле.');

    await builder.openFile(FORM_B);
    model.reply(
      call('insert_node', { parent: '/root', nodes: [inputNode('fieldB', 'Поле хода B')] }),
      say('Добавил поле в форму B.')
    );
    await panel.ask('Добавь ещё поле.');

    const a = await savedText(builder, disk, FORM_A);
    const b = await savedText(builder, disk, FORM_B);
    expect(a).toContain('Поле хода A');
    expect(a).not.toContain('Поле хода B');
    expect(b).toContain('Поле хода B');
    expect(b).not.toContain('Поле хода A');

    // Модели сказано, какая форма активна и что форма сменилась с прошлого хода (D4).
    const turn2 = lastUserText(model.requests[2]);
    expect(turn2).toContain(`Active form: ${FORM_B}`);
    expect(turn2).toContain(`switched to this form from ${FORM_A}`);
  });

  test('[M6] поле ввода и реплики называют форму, которую правит ход', async ({
    builder,
    disk,
    model,
    panel,
  }) => {
    await openWithFormB(builder, disk);
    await builder.openFile(FORM_A);
    await panel.connect();
    await expect(panel.composerTarget).toHaveText(`Правит: ${FORM_A}`);

    model.reply(say('Посмотрел A.'));
    await panel.ask('Посмотри.');
    model.reply(say('Ещё раз посмотрел A.'));
    await panel.ask('Ещё раз.');

    // Подпись поля ввода следует за активной вкладкой — до отправки запроса.
    await builder.openFile(FORM_B);
    await expect(panel.composerTarget).toHaveText(`Правит: ${FORM_B}`);
    model.reply(say('Посмотрел B.'));
    await panel.ask('А эту?');

    // Форма названа над первой репликой и там, где сменилась, — не над каждой.
    await expect(panel.entryTargets).toHaveText([`Форма: ${FORM_A}`, `Форма: ${FORM_B}`]);
    await expect(panel.entryTarget(panel.request(1))).toHaveCount(0);

    await builder.openFile('README.md');
    await expect(panel.composerTarget).toHaveText(/Нет открытой формы/);
  });

  test('[M2] режим файлов: путь из прошлой формы не создаёт файл в модуле B', async ({
    builder,
    disk,
    model,
    panel,
  }) => {
    await openWithFormB(builder, disk);
    await builder.openFile(FORM_A);
    await panel.connect({ mode: 'files' });

    model.reply(call('read_file', { path: 'form.schema.json' }), say('Форма A прочитана.'));
    await panel.ask('Прочитай форму.');

    await builder.openFile(FORM_B);
    // Модель помнит путь документа формы A и пишет по нему — в модуле B это чужой путь.
    model.reply(
      call('write_file', { path: 'form.schema.json', content: '{"format": 2}\n' }),
      say('Записал форму.')
    );
    await panel.ask('Перепиши форму.');

    // Отказ с названием активной формы, а не «Created …» (D3).
    const result = toolResults(model.requests[3]).join('\n');
    expect(result).toContain("is not this form's document");
    expect(result).toContain(`The active form is ${FORM_B}`);
    await builder.expandFolder(FORM_B_MODULE);
    await expect(builder.treeItem(`${FORM_B_MODULE}/form.schema.json`)).toHaveCount(0);
  });

  test('[M3] структурный режим: переключение на B посреди хода — вторая попытка правит A', async ({
    builder,
    disk,
    model,
    panel,
  }) => {
    await openWithFormB(builder, disk);
    await builder.openFile(FORM_B);
    await builder.openFile(FORM_A);
    await panel.connect();

    // Первая попытка — одно рассуждение, оборванное пределом: мост делает вторую.
    const gate = model.held({ reasoning: 'Думаю, куда поставить поле…', finish: 'length' });
    model.reply(
      call('insert_node', { parent: '/root', nodes: [inputNode('second', 'Поле второй попытки')] }),
      say('Готово.')
    );
    await panel.send('Добавь поле.');
    await gate.reached;
    await builder.activateTab(FORM_B);
    gate.release();
    await panel.waitIdle();

    expect(await savedText(builder, disk, FORM_A)).toContain('Поле второй попытки');
    expect(await savedText(builder, disk, FORM_B)).not.toContain('Поле второй попытки');
  });

  test('[M4] режим файлов: переключение на B посреди хода — правки остаются в модуле A', async ({
    builder,
    disk,
    model,
    page,
    panel,
  }) => {
    await openWithFormB(builder, disk);
    await builder.openFile(FORM_B);
    await builder.openFile(FORM_A);
    await panel.connect({ mode: 'files' });

    const anchor = '"placeholder": "Как к вам обращаться"';
    const gate = model.held(call('read_file', { path: 'form.schema.json' }));
    model.reply(
      call('edit_file', {
        path: 'form.schema.json',
        edits: [{ old_string: anchor, new_string: '"placeholder": "Правка посреди хода"' }],
      }),
      say('Готово.')
    );
    await panel.send('Поменяй подсказку имени.');
    await gate.reached;
    await builder.activateTab(FORM_B);
    gate.release();
    await panel.waitIdle();
    await expect(page.getByText('form.schema.json (+1 −1)')).toBeVisible();

    expect(await savedText(builder, disk, FORM_A)).toContain('Правка посреди хода');
    expect(await savedText(builder, disk, FORM_B)).not.toContain('Правка посреди хода');
  });

  test('[M5] структурный режим: A открыта временной вкладкой, клик по B посреди хода', async ({
    builder,
    disk,
    model,
    panel,
  }) => {
    await openWithFormB(builder, disk);
    await builder.previewFile(FORM_A);
    await panel.connect();

    const gate = model.held(
      call('insert_node', { parent: '/root', nodes: [inputNode('previewA', 'Поле временной A')] })
    );
    model.reply(say('Готово.'));
    await panel.send('Добавь поле.');
    await gate.reached;
    // Одиночный клик по другой форме заменяет временную вкладку A на B.
    await builder.previewFile(FORM_B);
    gate.release();
    await panel.waitIdle();

    // Вкладка цели закреплена на старте хода и получила правку (D2).
    await expect(builder.tabByPath(FORM_A)).toHaveCount(1);
    await expect.soft(panel.errorAlert).toBeHidden();
    expect(await savedText(builder, disk, FORM_A)).toContain('Поле временной A');
    expect(await savedText(builder, disk, FORM_B)).toContain(FORM_B_FIELD);
    expect(await savedText(builder, disk, FORM_B)).not.toContain('Поле временной A');
  });

  test('[M5f] режим файлов: A открыта временной вкладкой, клик по B посреди хода', async ({
    builder,
    disk,
    model,
    panel,
  }) => {
    await openWithFormB(builder, disk);
    await builder.previewFile(FORM_A);
    await panel.connect({ mode: 'files' });

    const anchor = '"placeholder": "Как к вам обращаться"';
    model.reply(call('read_file', { path: 'form.schema.json' }));
    const gate = model.held(
      call('edit_file', {
        path: 'form.schema.json',
        edits: [{ old_string: anchor, new_string: '"placeholder": "Правка во временной A"' }],
      })
    );
    model.reply(say('Готово.'));
    await panel.send('Поменяй подсказку имени.');
    await gate.reached;
    await builder.previewFile(FORM_B);
    gate.release();
    await panel.waitIdle();

    // Вкладка A осталась открытой — правку хода видно там, куда она легла.
    await expect(builder.tabByPath(FORM_A)).toHaveCount(1);
    expect(await savedText(builder, disk, FORM_A)).toContain('Правка во временной A');
  });

  test('[M7] висящий набор правок A отбрасывается новым запросом по B с видимой строкой', async ({
    builder,
    disk,
    model,
    page,
    panel,
  }) => {
    await openWithFormB(builder, disk);
    await builder.openFile(FORM_A);
    await panel.connect();

    // Форму A правили руками посреди хода — набор ждёт решения в превью.
    await turnWithHandEdit(builder, page, model, panel);
    await expect(panel.changePreview).toBeVisible();

    await builder.openFile(FORM_B);
    model.reply(say('Посмотрел форму B.'));
    await panel.ask('А что в этой форме?');

    // Набор не висит над чужим ходом и не применяется молча: отброс виден в реплике A (D6).
    await expect(panel.changePreview).toHaveCount(0);
    await expect(panel.failedToolLines(panel.answer(0))).toContainText(
      'Неприменённые правки этого хода отброшены новым запросом.'
    );
    const a = await savedText(builder, disk, FORM_A);
    expect(a).toContain(HAND_EDIT);
    expect(a).not.toContain(AGENT_FIELD);
    expect(await savedText(builder, disk, FORM_B)).not.toContain(AGENT_FIELD);
  });

  test('[M8] отмена хода после перехода на B откатывает A и называет её', async ({
    builder,
    disk,
    model,
    panel,
  }) => {
    await openWithFormB(builder, disk);
    await builder.openFile(FORM_A);
    await panel.connect();

    model.reply(
      call('insert_node', { parent: '/root', nodes: [inputNode('undoA', 'Поле для отмены')] }),
      say('Добавил.')
    );
    await panel.ask('Добавь поле.');
    await builder.openFile(FORM_B);
    await panel.undoTurnButton.click();

    expect(await savedText(builder, disk, FORM_A)).not.toContain('Поле для отмены');
    // Отмена правит не ту форму, что на экране, — об этом надо сказать (D7).
    await expect(panel.errorAlert).toContainText(FORM_A);
  });
});
