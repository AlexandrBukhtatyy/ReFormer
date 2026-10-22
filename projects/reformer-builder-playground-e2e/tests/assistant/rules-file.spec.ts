import { call, lastUserText, say } from './shared/model-mock';
import { FORM_A, savedText } from './shared/forms';
import { expect, test } from './shared/fixtures';

/**
 * Ассистент: правила формы — файлом рядом с документом. Каталог сценариев — `SCENARIOS.md`,
 * группа T.
 *
 * Правила структурного режима (валидация, поведение) раньше жили в памяти моста и не доходили
 * ни до генерации, ни до следующего запуска. Теперь ход пишет их в `form.rules.json` рядом с
 * документом, а генерация печатает из него `validation/form.ts`.
 */

const RULES_FILE = 'forms/contact/form.rules.json';

test.describe('Ассистент: файл правил формы', () => {
  test.setTimeout(150_000);

  test('[T12] правила хода — файл рядом с формой; генерация печатает их в валидацию', async ({
    builder,
    disk,
    model,
    page,
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

    // Файл правил лёг в рабочую копию рядом с документом и сохраняется, как любой файл.
    await builder.openFile(RULES_FILE);
    const rules = JSON.parse(await savedText(builder, disk, RULES_FILE)) as {
      validation: { target: string; rules: string[] }[];
    };
    expect(rules.validation).toEqual([{ target: 'email', rules: ['required', 'email'] }]);

    // Следующий ход видит правила из файла.
    await builder.activateTab(FORM_A);
    model.reply(say('Правило одно.'));
    await panel.ask('Какие правила?');
    expect(lastUserText(model.requests[2])).toContain('validate email: required, email');

    // Генерация печатает правило в валидацию модуля, а не заготовку.
    await page.getByRole('button', { name: 'Экспорт формы' }).click();
    await page.getByRole('button', { name: 'Сгенерировать', exact: true }).click();
    await expect
      .poll(() => disk.readText('forms/contact/validation/form.ts').catch(() => ''), {
        timeout: 30_000,
      })
      .toContain('email');
    expect(await disk.readText('forms/contact/validation/form.ts')).toMatch(/required/);
  });

  test('[T13] значения источника данных из хода — варианты живой формы', async ({
    builder,
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

    await page
      .getByRole('main', { name: 'Редактор' })
      .getByRole('button', { name: 'Форма', exact: true })
      .click();
    await page.getByRole('combobox', { name: 'Как связаться' }).click();
    // Превью показывает значения из правил, а не выдуманные «Channels 1, 2, 3».
    await expect(page.getByRole('option', { name: 'Телеграм' })).toBeVisible();
    await expect(page.getByRole('option', { name: 'Почта' })).toBeVisible();
  });
});
