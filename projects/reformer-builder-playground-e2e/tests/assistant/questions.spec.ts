import path from 'path';
import { call, say, toolResults } from './shared/model-mock';
import { FORM_A, inputNode } from './shared/forms';
import { expect, test } from './shared/fixtures';

/** Скриншоты — в общий каталог e2e-скриншотов репозитория (он в .gitignore). */
const SCREENSHOTS = path.resolve(
  __dirname,
  '../../../react-playground-e2e/screenshots/assistant-questions'
);

/**
 * Ассистент: вопросы модели (`ask_user`). Каталог сценариев — `SCENARIOS.md`, группа Q.
 *
 * Модель спрашивает вызовом инструмента; ход ждёт, пока человек ответит в карточке, и продолжается
 * тем же ходом — ответ уходит модели результатом вызова в следующем запросе.
 */

const REQUIRED = {
  question: 'Сделать поле обязательным?',
  options: [
    { label: 'Обязательное' },
    { label: 'Необязательное', description: 'Можно пропустить' },
  ],
};
const KIND = {
  question: 'Какой тип у поля?',
  options: [{ label: 'Телефон' }, { label: 'Почта' }],
};

test.describe('Ассистент: вопросы модели', () => {
  test.setTimeout(120_000);

  test.beforeEach(async ({ builder }) => {
    await builder.openPlayground({ plugins: ['reformer/ai'] });
    await builder.openFile(FORM_A);
  });

  test('[Q1] выбор варианта продолжает тот же ход: правка после ответа применяется', async ({
    builder,
    model,
    panel,
  }) => {
    await panel.connect();
    model.reply(
      call('ask_user', { questions: [REQUIRED] }),
      call('insert_node', { parent: '/root', nodes: [inputNode('phone', 'Телефон')] }),
      say('Добавил обязательное поле «Телефон».')
    );
    await panel.send('Добавь поле телефона.');

    const card = panel.questionCard();
    await expect(card).toContainText('Сделать поле обязательным?');
    await expect(card).toContainText('Можно пропустить');
    await expect(panel.submitAnswer()).toBeDisabled();
    await panel.option('Обязательное').click();
    await panel.submitAnswer().click();
    await panel.waitIdle();

    await expect(panel.message(panel.answer(0))).toHaveText('Добавил обязательное поле «Телефон».');
    await expect(card.getByTestId('ai-question-answer')).toHaveText('Ответ: Обязательное');
    await expect(panel.userEntries).toHaveCount(1);
    await expect(builder.dirtyMark(FORM_A)).toHaveCount(1);
    // Ответ ушёл модели результатом вызова — в следующем запросе того же хода.
    expect(toolResults(model.requests[1]).join('\n')).toContain(
      '1) "Сделать поле обязательным?" → "Обязательное"'
    );
  });

  test('[Q2] несколько вопросов: «Ответить» доступна, когда отвечено на все', async ({
    model,
    page,
    panel,
  }) => {
    await panel.connect();
    model.reply(call('ask_user', { questions: [REQUIRED, KIND] }), say('Понял.'));
    await panel.send('Добавь поле.');

    await expect(panel.questionCard().getByTestId('ai-question-item')).toHaveCount(2);
    await panel.option('Обязательное').click();
    await expect(panel.submitAnswer()).toBeDisabled();
    await page.screenshot({ path: path.join(SCREENSHOTS, 'card-open.png') });
    await panel.option('Почта').click();
    await panel.submitAnswer().click();
    await panel.waitIdle();

    const result = toolResults(model.requests[1]).join('\n');
    expect(result).toContain('1) "Сделать поле обязательным?" → "Обязательное"');
    expect(result).toContain('2) "Какой тип у поля?" → "Почта"');
    await page.screenshot({ path: path.join(SCREENSHOTS, 'card-answered.png') });
  });

  test('[Q3] мультивыбор: несколько вариантов одного вопроса', async ({ model, panel }) => {
    await panel.connect();
    model.reply(
      call('ask_user', {
        questions: [
          {
            question: 'Какие поля добавить?',
            multiSelect: true,
            options: [{ label: 'Телефон' }, { label: 'Почта' }, { label: 'Адрес' }],
          },
        ],
      }),
      say('Добавлю два поля.')
    );
    await panel.send('Добавь контакты.');

    await expect(panel.option('Телефон')).toHaveRole('checkbox');
    await panel.option('Телефон').click();
    await panel.option('Адрес').click();
    await panel.submitAnswer().click();
    await panel.waitIdle();

    expect(toolResults(model.requests[1]).join('\n')).toContain(
      '1) "Какие поля добавить?" → "Телефон", "Адрес"'
    );
  });

  test('[Q4] «Свой вариант»: ответ словами человека', async ({ model, panel }) => {
    await panel.connect();
    model.reply(call('ask_user', { questions: [KIND] }), say('Сделаю поле ИНН.'));
    await panel.send('Добавь поле.');

    await panel.option('Свой вариант').click();
    await expect(panel.submitAnswer()).toBeDisabled();
    await panel.questionCard().getByTestId('ai-question-own').fill('ИНН организации');
    await panel.submitAnswer().click();
    await panel.waitIdle();

    expect(toolResults(model.requests[1]).join('\n')).toContain(
      '1) "Какой тип у поля?" → own words: "ИНН организации"'
    );
    await expect(panel.questionCard().getByTestId('ai-question-answer')).toHaveText(
      'Ответ: ИНН организации'
    );
  });

  test('[Q5] «Остановить» при открытой карточке снимает вопросы', async ({ model, panel }) => {
    await panel.connect();
    model.reply(call('ask_user', { questions: [REQUIRED] }));
    await panel.send('Добавь поле.');

    await expect(panel.questionCard()).toBeVisible();
    await panel.stop();
    await panel.waitIdle();

    await expect(panel.questionCard()).toContainText('Вопросы сняты');
    await expect(panel.submitAnswer()).toHaveCount(0);
    await expect(panel.errorAlert).toHaveCount(0);
  });

  test('[Q8] режим файлов: вопрос, ответ, правка файла', async ({ model, page, panel }) => {
    await panel.connect({ mode: 'files' });
    const anchor = '"placeholder": "Как к вам обращаться"';
    model.reply(
      call('ask_user', { questions: [KIND] }),
      call('edit_file', {
        path: 'form.schema.json',
        edits: [{ old_string: anchor, new_string: '"placeholder": "Почта для связи"' }],
      }),
      say('Готово.')
    );
    await panel.send('Поменяй подсказку.');

    await panel.option('Почта').click();
    await panel.submitAnswer().click();
    await panel.waitIdle();
    await expect(page.getByText('form.schema.json (+1 −1)')).toBeVisible();
  });

  test('[Q9] пока карточка открыта, новый ход не начинается', async ({ model, panel }) => {
    await panel.connect();
    model.reply(call('ask_user', { questions: [REQUIRED] }), say('Хорошо.'));
    await panel.send('Добавь поле.');

    await expect(panel.questionCard()).toBeVisible();
    await expect(panel.composer).toBeDisabled();
    await expect(panel.composer).toHaveAttribute('placeholder', /ждёт ответа/);
    await expect(panel.restoreButton(panel.request(0))).toBeDisabled();
    await expect(panel.newConversationButton).toBeDisabled();

    await panel.option('Необязательное').click();
    await panel.submitAnswer().click();
    await panel.waitIdle();
    await expect(panel.composer).toBeEnabled();
  });

  test('[Q10] вопрос не по схеме — отказ модели, карточки нет', async ({ model, panel }) => {
    await panel.connect();
    model.reply(
      call('ask_user', { questions: [{ question: 'Да?', options: [{ label: 'Да' }] }] }),
      say('Тогда без вопросов.')
    );
    await panel.ask('Добавь поле.');

    await expect(panel.message(panel.answer(0))).toHaveText('Тогда без вопросов.');
    await expect(panel.page.getByTestId('ai-question')).toHaveCount(0);
    expect(toolResults(model.requests[1]).join('\n').length).toBeGreaterThan(0);
  });
});
