import { call, say, textOf } from './shared/model-mock';
import { FORM_A, inputNode } from './shared/forms';
import { expect, test } from './shared/fixtures';

/**
 * Ассистент: вторая попытка хода. Каталог сценариев — `SCENARIOS.md`, группа R.
 *
 * Мост повторяет ход ровно один раз, если модель знала, что делать, а правка не состоялась:
 * ответ ушёл в рассуждение и оборвался, вызов написан текстом. У локального канала обрыв
 * узнаётся по шагу из одного рассуждения с концом по пределу длины.
 */

/** Шаг, оборванный пределом длины посреди рассуждения. */
const cutOff = (reasoning: string) => ({ reasoning, finish: 'length' as const });

test.describe('Ассистент: вторая попытка', () => {
  test.setTimeout(120_000);

  test.beforeEach(async ({ builder, panel }) => {
    await builder.openPlayground({ plugins: ['reformer/ai'] });
    await builder.openFile(FORM_A);
    await panel.connect();
  });

  test('[R1] оборванный ответ — ровно одна повторная попытка, реплика одна', async ({
    builder,
    model,
    panel,
  }) => {
    model.reply(
      cutOff('Думаю, куда поставить поле…'),
      call('insert_node', { parent: '/root', nodes: [inputNode('phone', 'Телефон')] }),
      say('Готово.')
    );
    await panel.ask('Добавь телефон.');

    expect(model.requests).toHaveLength(3);
    expect(textOf(model.requests[1])).toContain('was cut off');
    await expect(panel.userEntries).toHaveCount(1);
    await expect(panel.message(panel.answer(0))).toHaveText('Готово.');
    await expect(builder.dirtyMark(FORM_A)).toHaveCount(1);
    await expect(panel.errorAlert).toHaveCount(0);
  });

  test('[R2] вызов, написанный текстом, — повтор с подсказкой вызвать инструмент', async ({
    builder,
    model,
    panel,
  }) => {
    const written =
      '<tool_call>\n' +
      JSON.stringify({
        name: 'insert_node',
        arguments: { parent: '/root', nodes: [inputNode('phone', 'Телефон')] },
      }) +
      '\n</tool_call>';
    model.reply(
      say(written),
      call('insert_node', { parent: '/root', nodes: [inputNode('phone', 'Телефон')] }),
      say('Теперь добавил.')
    );
    await panel.ask('Добавь телефон.');

    expect(model.requests).toHaveLength(3);
    expect(textOf(model.requests[1])).toContain('written as text');
    await expect(builder.dirtyMark(FORM_A)).toHaveCount(1);
  });

  test('[R3] обе попытки оборваны — третьей нет, ошибка видна', async ({ model, panel }) => {
    model.reply(cutOff('Думаю…'), cutOff('Снова думаю…'));
    await panel.ask('Добавь телефон.');

    expect(model.requests).toHaveLength(2);
    await expect(panel.errorAlert).toContainText('пределе длины');
  });

  test('[R4] «Остановить» на первой попытке — повтора нет', async ({ model, panel }) => {
    const gate = model.held(cutOff('Думаю…'));
    await panel.send('Добавь телефон.');
    await gate.reached;
    await panel.stop();
    await panel.waitIdle();
    gate.release();

    expect(model.requests).toHaveLength(1);
    await expect(panel.errorAlert).toHaveCount(0);
  });
});
