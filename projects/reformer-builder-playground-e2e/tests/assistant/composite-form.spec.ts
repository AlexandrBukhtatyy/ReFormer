import { call, say } from './shared/model-mock';
import { FORM_A, inputNode, savedText } from './shared/forms';
import { expect, test } from './shared/fixtures';

/**
 * Ассистент и форма, шаги которой лежат в отдельных файлах (`schema/steps/<шаг>/`). Каталог
 * сценариев — `SCENARIOS.md`, группа T.
 *
 * Ход видит форму собранной — с шагами на месте ссылок `$ref`, — а запись раскладывается обратно
 * по файлам: правка шага ложится в файл шага, корень остаётся со ссылками. Визард, собранный самим
 * ходом, ложится по файлам шагов сразу — как у шаблона «Пошаговая форма».
 */

const MODULE = 'forms/templates/reformer-multi-step-form/schema';
const ROOT = `${MODULE}/form.schema.json`;
const CONTACTS_STEP = `${MODULE}/steps/kontakty/form.schema.json`;

test.describe('Ассистент: шаги в отдельных файлах', () => {
  test.setTimeout(150_000);

  test('[T14] поле, вставленное в шаг, ложится в файл шага, а не в корень', async ({
    builder,
    disk,
    model,
    panel,
  }) => {
    await builder.openPlayground({ plugins: ['reformer/ai'] });
    await builder.openFile(ROOT);
    await panel.connect();

    // Собранная форма: корень → мастер → шаг «Контакты» (второй) → его блок полей.
    model.reply(
      call('insert_node', {
        parent: '/root/children/0/children/1/children/0',
        nodes: [inputNode('telegram', 'Телеграм')],
      }),
      say('Добавил поле в шаг «Контакты».')
    );
    await panel.ask('Добавь в контакты поле Телеграм.');

    await builder.openFile(CONTACTS_STEP);
    expect(await savedText(builder, disk, CONTACTS_STEP)).toContain('Телеграм');
    const root = await savedText(builder, disk, ROOT);
    expect(root).not.toContain('Телеграм');
    expect(root).toContain('"$ref": "./steps/kontakty/form.schema.json"');
  });

  test('[T18] визард, собранный ходом, ложится по файлам шагов; отмена — одним шагом', async ({
    builder,
    disk,
    model,
    panel,
  }) => {
    await builder.openPlayground({ plugins: ['reformer/ai'] });
    await builder.openFile(FORM_A);
    await panel.connect();

    model.reply(
      call('insert_node', {
        parent: '/root',
        nodes: [
          {
            component: 'Wizard',
            children: [
              {
                component: 'Step',
                props: { title: 'First' },
                children: [inputNode('telegramE2e', 'Телеграм E2E')],
              },
              {
                component: 'Step',
                props: { title: 'Second' },
                children: [inputNode('cityE2e', 'Город E2E')],
              },
            ],
          },
        ],
      }),
      say('Собрал мастер из двух шагов.')
    );
    await panel.ask('Сделай мастер из двух шагов: телефон и город.');
    await expect(panel.failedToolLines(panel.answer(-1))).toHaveCount(0);

    // Корень — со ссылками на файлы шагов, поля — в файлах шагов, а не в корне.
    const root = await savedText(builder, disk, FORM_A);
    const refs = [...root.matchAll(/"\$ref": "\.\/(steps\/[^"]+)"/g)].map((match) => match[1]);
    expect(refs).toHaveLength(2);
    expect(root).not.toContain('Телеграм E2E');
    const firstStep = `forms/contact/${refs[0]}`;
    await builder.openFile(firstStep);
    expect(await savedText(builder, disk, firstStep)).toContain('Телеграм E2E');

    // Отмена хода возвращает форму одним шагом: ссылок на шаги в корне больше нет.
    await panel.undoTurnButton.click();
    await expect(panel.undoTurnButton).toBeDisabled();
    expect(await savedText(builder, disk, FORM_A)).not.toContain('$ref');
  });
});
