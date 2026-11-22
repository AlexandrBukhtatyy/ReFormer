import path from 'path';
import type { Locator } from '@playwright/test';
import { call, say, textOf } from './shared/model-mock';
import { FORM_A } from './shared/forms';
import { expect, test } from './shared/fixtures';

/**
 * Ассистент: рассуждение модели в ленте. Каталог сценариев — `SCENARIOS.md`, группа Z.
 *
 * Раскладка проверяется геометрией, а не снимками: высота блока, наложение на ответ,
 * горизонтальное переполнение ленты — то, что пользователь описывает словом «криво».
 */

/** Скриншоты — в общий каталог e2e-скриншотов репозитория (он в .gitignore). */
const SCREENSHOTS = path.resolve(
  __dirname,
  '../../../react-playground-e2e/screenshots/assistant-reasoning'
);

/** Длинное рассуждение: восемьдесят строк и неразрывный токен — так думают локальные модели. */
const LONG_REASONING = [
  ...Array.from({ length: 80 }, (_, i) => `Строка рассуждения номер ${String(i + 1)}.`),
  `Аргументы: ${'x'.repeat(400)}`,
].join('\n');

/** Вьюпорт области прокрутки кита — тот, что прокручивается. */
const viewportOf = (scrollArea: Locator): Locator =>
  scrollArea.locator(':scope > [data-slot="scroll-area-viewport"]');

test.describe('Ассистент: рассуждение', () => {
  test.setTimeout(120_000);

  test('[Z1] развёрнутое длинное рассуждение ограничено по высоте и не наползает на ответ', async ({
    builder,
    model,
    page,
    panel,
  }) => {
    await builder.openPlayground({ plugins: ['reformer/ai'] });
    await builder.openFile(FORM_A);
    await panel.connect();

    model.reply({
      reasoning: LONG_REASONING,
      reasoningChunks: 20,
      text: 'Ответ после рассуждения.',
    });
    await panel.ask('Подумай подольше.');

    const answer = panel.answer(0);
    const block = await panel.expandReasoning(answer);
    const viewport = viewportOf(block);

    // Блок не выше своего предела и прокручивается внутри себя.
    const box = await viewport.boundingBox();
    expect(box?.height ?? 0).toBeLessThanOrEqual(161);
    expect(await viewport.evaluate((element) => element.scrollHeight > element.clientHeight)).toBe(
      true
    );

    // Ответ начинается ниже блока рассуждения, а не под ним.
    const blockBox = await block.boundingBox();
    const answerBox = await panel.message(answer).boundingBox();
    expect(answerBox?.y ?? 0).toBeGreaterThanOrEqual(
      (blockBox?.y ?? 0) + (blockBox?.height ?? 0) - 1
    );

    // Длинный токен переносится, а не расширяет ленту: правый край реплик виден.
    const feed = viewportOf(panel.feed);
    expect(await feed.evaluate((element) => element.scrollWidth <= element.clientWidth + 1)).toBe(
      true
    );
    const feedBox = await feed.boundingBox();
    const requestBox = await panel.message(panel.request(0)).boundingBox();
    expect((requestBox?.x ?? 0) + (requestBox?.width ?? 0)).toBeLessThanOrEqual(
      (feedBox?.x ?? 0) + (feedBox?.width ?? 0) + 1
    );

    await page.screenshot({ path: path.join(SCREENSHOTS, 'expanded.png'), fullPage: true });
  });

  test('[Z2] рассуждения разных шагов разделены, без ведущей пустой строки', async ({
    builder,
    model,
    panel,
  }) => {
    await builder.openPlayground({ plugins: ['reformer/ai'] });
    await builder.openFile(FORM_A);
    await panel.connect();

    model.reply(
      { reasoning: '\nСмотрю форму.', ...call('get_form_outline', {}) },
      { reasoning: 'Поле уже есть.', text: 'В форме уже есть Email.' }
    );
    await panel.ask('Есть ли в форме Email?');

    const block = await panel.expandReasoning(panel.answer(0));
    expect(await block.innerText()).toBe('Смотрю форму.\n\nПоле уже есть.');
  });

  test('[Z4] лента не прыгает к концу, пока пользователь читает выше', async ({
    builder,
    model,
    page,
    panel,
  }) => {
    await builder.openPlayground({ plugins: ['reformer/ai'] });
    await builder.openFile(FORM_A);
    await panel.connect();

    // Ленту наполняют три хода с длинными ответами — ей есть куда прокручиваться.
    const long = Array.from({ length: 30 }, (_, i) => `Строка ответа ${String(i + 1)}.`).join('\n');
    for (const question of ['Раз.', 'Два.', 'Три.']) {
      model.reply(say(long));
      await panel.ask(question);
    }
    const feed = viewportOf(panel.feed);
    const atBottom = (): Promise<boolean> =>
      feed.evaluate(
        (element) => element.scrollHeight - element.scrollTop - element.clientHeight <= 24
      );
    // Предусловие: прокручивается сама лента, а не панель вокруг неё.
    expect(
      await feed.evaluate((element) => element.scrollHeight > element.clientHeight + 100)
    ).toBe(true);
    expect(await atBottom()).toBe(true);

    // Пользователь ушёл читать начало, а ход тем временем дописывает ответ.
    const gate = model.held({ reasoning: 'Думаю.', text: long });
    await panel.send('Четыре.');
    await gate.reached;
    // Колесом, как человек: событие прокрутки браузер доставляет на кадре, и лента узнаёт, что
    // её увели от низа, — программная запись `scrollTop` до кадра этого не сообщила бы.
    await feed.hover();
    await page.mouse.wheel(0, -20_000);
    await expect.poll(() => feed.evaluate((element) => element.scrollTop)).toBe(0);
    await feed.evaluate(
      () => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)))
    );
    gate.release();
    await panel.waitIdle();
    expect(await feed.evaluate((element) => element.scrollTop)).toBeLessThan(24);

    // Новый запрос возвращает к концу: человек смотрит на то, что спросил.
    model.reply(say('Пятый ответ.'));
    await panel.ask('Пять.');
    expect(await atBottom()).toBe(true);
  });
});

test.describe('Ассистент: рассуждение между попытками и ходами', () => {
  test.setTimeout(120_000);

  test.beforeEach(async ({ builder, panel }) => {
    await builder.openPlayground({ plugins: ['reformer/ai'] });
    await builder.openFile(FORM_A);
    await panel.connect();
  });

  test('[Z3] рассуждение второй попытки отделено от первой', async ({ model, panel }) => {
    model.reply(
      { reasoning: 'Первая попытка.', finish: 'length' },
      { reasoning: 'Вторая попытка.', text: 'Готово.' }
    );
    await panel.ask('Подумай.');

    const block = await panel.expandReasoning(panel.answer(0));
    expect(await block.innerText()).toBe('Первая попытка.\n\nВторая попытка.');
  });

  test('[Z5] рассуждение не уходит модели в историю следующего хода', async ({ model, panel }) => {
    model.reply({ reasoning: 'ЧЕРНОВИК-МЫСЛИ-E2E', text: 'Первый ответ.' }, say('Второй ответ.'));
    await panel.ask('Раз.');
    await panel.ask('Два.');

    const history = textOf(model.requests[1]);
    expect(history).toContain('Первый ответ.');
    expect(history).not.toContain('ЧЕРНОВИК-МЫСЛИ-E2E');
  });
});
