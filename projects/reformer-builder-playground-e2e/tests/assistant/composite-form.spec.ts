import { call, say } from './shared/model-mock';
import { inputNode, savedText } from './shared/forms';
import { expect, test } from './shared/fixtures';

/**
 * Ассистент и форма, шаги которой лежат в отдельных файлах (`schema/steps/<шаг>/`). Каталог
 * сценариев — `SCENARIOS.md`, группа T.
 *
 * Ход видит форму собранной — с шагами на месте ссылок `$ref`, — а запись раскладывается обратно
 * по файлам: правка шага ложится в файл шага, корень остаётся со ссылками.
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
});
