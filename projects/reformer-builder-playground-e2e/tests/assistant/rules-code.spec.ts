import { call, lastUserText, say } from './shared/model-mock';
import { FORM_A, savedText } from './shared/forms';
import { expect, test } from './shared/fixtures';

/**
 * Ассистент: правила формы — в коде её модуля. Каталог сценариев — `SCENARIOS.md`, группа T.
 *
 * Правила структурного режима (валидация, поведение, значения источников) ход пишет генерацией
 * кода прямо в файлы модуля: `validation/form.ts`, `behavior/index.ts`, `constants/<каталог>.ts`.
 * Отдельного файла правил рядом с документом нет. У формы A кода ещё нет — первый же ход с
 * правилами генерирует модуль целиком.
 */

const MODULE = 'forms/contact';
const RULES_CODE = `${MODULE}/validation/form.ts`;
const CONSTANTS = `${MODULE}/constants/contact.ts`;

test.describe('Ассистент: правила формы в коде модуля', () => {
  test.setTimeout(150_000);

  test('[T12] правила хода — в validation/form.ts; следующий ход их видит, отмена снимает', async ({
    builder,
    disk,
    model,
    panel,
  }) => {
    await builder.openPlayground({ plugins: ['reformer/ai'] });
    await builder.openFile(FORM_A);
    await panel.connect();

    model.reply(
      call('set_form_rules', { validation: [{ target: 'email', rules: ['required', 'email'] }] }),
      say('Почта теперь обязательна.')
    );
    await panel.ask('Сделай почту обязательной.');

    // Правило легло в код модуля, и файл сохраняется, как любой файл.
    await builder.openFile(RULES_CODE);
    const code = await savedText(builder, disk, RULES_CODE);
    expect(code).toContain('validate(model.$.email');
    expect(code).toContain('required()');
    expect(code).toContain('email()');
    // Файла правил рядом с документом нет.
    await builder.expandFolder(MODULE);
    await expect(builder.treeItem(`${MODULE}/form.rules.json`)).toHaveCount(0);

    // Следующий ход видит правила из кода.
    await builder.activateTab(FORM_A);
    model.reply(say('Правил два.'));
    await panel.ask('Какие правила?');
    expect(lastUserText(model.requests[2])).toContain('validate email: required, email');

    // Отмена хода с правилами возвращает файл правил к тексту без них.
    model.reply(
      call('set_form_rules', { validation: [{ target: 'name', rules: ['required'] }] }),
      say('Имя обязательно.')
    );
    await panel.ask('Сделай имя обязательным.');
    await expect.poll(() => savedText(builder, disk, RULES_CODE)).toContain('model.$.name');
    await builder.activateTab(FORM_A);
    await panel.undoTurnButton.click();
    await expect.poll(() => savedText(builder, disk, RULES_CODE)).not.toContain('model.$.name');
    expect(await savedText(builder, disk, RULES_CODE)).toContain('validate(model.$.email');
  });

  test('[T13] значения источника данных из хода — в константах модуля и в живой форме', async ({
    builder,
    disk,
    model,
    page,
    panel,
  }) => {
    await builder.openPlayground({ plugins: ['reformer/ai'] });
    await builder.openFile(FORM_A);
    await panel.connect();

    // «Как связаться» берёт варианты из именованного источника, а его значения — в правилах.
    model.reply(
      call('set_node_prop', {
        refs: ['/root/children/2'],
        props: { options: '$dataSource(CHANNELS)' },
      }),
      call('set_form_rules', {
        dataSources: {
          CHANNELS: [
            { value: 'tg', label: 'Телеграм' },
            { value: 'mail', label: 'Почта' },
          ],
        },
      }),
      say('Варианты связи — источник CHANNELS.')
    );
    await panel.ask('Вынеси варианты связи в источник.');

    // Значения легли в константы модуля.
    await builder.openFile(CONSTANTS);
    expect(await savedText(builder, disk, CONSTANTS)).toContain("label: 'Телеграм'");

    await builder.activateTab(FORM_A);
    await page
      .getByRole('main', { name: 'Редактор' })
      .getByRole('button', { name: 'Форма', exact: true })
      .click();
    await page.getByRole('combobox', { name: 'Как связаться' }).click();
    // Превью показывает значения из констант, а не выдуманные «Channels 1, 2, 3».
    await expect(page.getByRole('option', { name: 'Телеграм' })).toBeVisible();
    await expect(page.getByRole('option', { name: 'Почта' })).toBeVisible();
  });
});
