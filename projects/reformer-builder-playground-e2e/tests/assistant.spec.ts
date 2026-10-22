import type { Page } from '@playwright/test';
import { test, expect } from './shared/fixtures';

/**
 * Ассистент: настройки канала и ход в режиме файлов. Модель для этих тестов не нужна — список
 * моделей и ответы локального сервера отдаёт подмена запросов, поэтому тесты не зависят от того,
 * запущен ли Ollama.
 */

/** Один ответ модели: вызов инструмента либо текст. */
type ScriptedStep = { readonly tool: string; readonly args: unknown } | { readonly text: string };

/** Ответ модели потоком OpenAI-совместимого сервера — так его отдаёт Ollama. */
function streamOf(step: ScriptedStep): string {
  const chunk = (body: Record<string, unknown>): string =>
    `data: ${JSON.stringify({ id: 'e2e', object: 'chat.completion.chunk', created: 0, model: 'e2e-model', ...body })}\n\n`;
  const delta =
    'tool' in step
      ? {
          role: 'assistant',
          tool_calls: [
            {
              index: 0,
              id: `call_${step.tool}`,
              type: 'function',
              function: { name: step.tool, arguments: JSON.stringify(step.args) },
            },
          ],
        }
      : { role: 'assistant', content: step.text };
  return (
    chunk({ choices: [{ index: 0, delta, finish_reason: null }] }) +
    chunk({
      choices: [{ index: 0, delta: {}, finish_reason: 'tool' in step ? 'tool_calls' : 'stop' }],
    }) +
    chunk({ choices: [], usage: { prompt_tokens: 10, completion_tokens: 5, total_tokens: 15 } }) +
    'data: [DONE]\n\n'
  );
}

/** Подменяет локальный сервер: список из одной модели и ответы по сценарию, по одному на запрос. */
async function scriptModel(page: Page, steps: readonly ScriptedStep[]): Promise<void> {
  await page.route('**/localhost:11434/v1/models', (route) =>
    route.fulfill({ json: { data: [{ id: 'e2e-model' }] } })
  );
  let call = 0;
  await page.route('**/localhost:11434/v1/chat/completions', (route) => {
    if (route.request().method() !== 'POST') return route.continue();
    const step = steps[Math.min(call, steps.length - 1)];
    call += 1;
    return route.fulfill({
      status: 200,
      headers: { 'content-type': 'text/event-stream', 'access-control-allow-origin': '*' },
      body: streamOf(step),
    });
  });
}

test.describe('Ассистент', () => {
  test('режим правки выбирается в настройках канала и переживает переподключение', async ({
    builder,
    page,
  }) => {
    test.setTimeout(120_000);
    await page.route('**/localhost:11434/v1/models', (route) =>
      route.fulfill({ json: { data: [{ id: 'e2e-model' }] } })
    );
    await builder.openPlayground({ plugins: ['reformer/ai'] });

    // Плагины проекта поднимаются отдельной цепочкой после открытия — вкладка ассистента
    // появляется на рейле не сразу.
    const rail = page.getByRole('navigation', { name: 'Панели справа' });
    await expect(rail.getByRole('button', { name: 'Ассистент' })).toBeVisible({ timeout: 60_000 });
    await rail.getByRole('button', { name: 'Ассистент' }).click();
    await page.getByRole('button', { name: 'Настройки канала' }).click();

    await page.getByRole('combobox', { name: 'Провайдер' }).click();
    await page.getByRole('option', { name: 'Локальный (OpenAI-совместимый)' }).click();
    await page.getByRole('button', { name: 'Загрузить список моделей' }).click();
    await expect(page.getByRole('combobox', { name: 'Модель' })).toHaveText('e2e-model');

    // По умолчанию — прежний режим: настройки без поля режима читаются как structured.
    const mode = page.getByRole('combobox', { name: 'Как ассистент правит форму' });
    await expect(mode).toHaveText('Операциями редактора');
    await mode.click();
    await page.getByRole('option', { name: 'Напрямую в файлах формы' }).click();
    await expect(
      page.getByText(/В режиме файлов модель сама правит файлы модуля формы/)
    ).toBeVisible();

    await page.getByRole('button', { name: 'Подключить' }).click();
    // Подключение закрывает настройки; открытые снова, они показывают сохранённый режим.
    await expect(mode).toBeHidden();
    await page.getByRole('button', { name: 'Настройки канала' }).click();
    await expect(page.getByRole('combobox', { name: 'Как ассистент правит форму' })).toHaveText(
      'Напрямую в файлах формы'
    );
  });

  test('правка файла ассистентом видна в дереве открытой формы', async ({ builder, page }) => {
    // Ход ассистента в режиме файлов пишет файл формы службой документов, мимо модели
    // редактора. Открытие вкладки зовёт `open` рабочей области несколько раз подряд, и пока
    // одновременные открытия не сводились в одно, каждое заводило свой буфер: модель
    // редактора смотрела в первый, а запись попадала в последний. Файл менялся, дерево — нет.
    test.setTimeout(120_000);
    const email = '"label": "Email"\n            }\n          }';
    const phone =
      `${email},\n          {\n            "$nodeId": "e2ephone",\n            "selector": "phone",\n` +
      '            "model": "$model(phone)",\n            "component": "$component(Input)",\n' +
      '            "componentProps": {\n              "label": "Телефон"\n            }\n          }';
    await scriptModel(page, [
      { tool: 'read_file', args: { path: 'form.schema.json' } },
      {
        tool: 'edit_file',
        args: { path: 'form.schema.json', edits: [{ old_string: email, new_string: phone }] },
      },
      { text: 'Готово: поле «Телефон» добавлено.' },
    ]);
    await builder.openPlayground({ plugins: ['reformer/ai'] });
    await builder.openFile('forms/contact/form.schema.json');

    const rail = page.getByRole('navigation', { name: 'Панели справа' });
    await expect(rail.getByRole('button', { name: 'Ассистент' })).toBeVisible({ timeout: 60_000 });
    await rail.getByRole('button', { name: 'Ассистент' }).click();
    await page.getByRole('button', { name: 'Настройки канала' }).click();
    await page.getByRole('combobox', { name: 'Провайдер' }).click();
    await page.getByRole('option', { name: 'Локальный (OpenAI-совместимый)' }).click();
    await page.getByRole('button', { name: 'Загрузить список моделей' }).click();
    await expect(page.getByRole('combobox', { name: 'Модель' })).toHaveText('e2e-model');
    await page.getByRole('combobox', { name: 'Как ассистент правит форму' }).click();
    await page.getByRole('option', { name: 'Напрямую в файлах формы' }).click();
    await page.getByRole('button', { name: 'Подключить' }).click();

    const input = page.getByPlaceholder('Что сделать с формой?');
    await input.fill('Добавь поле «Телефон».');
    await input.press('Enter');
    await expect(page.getByText('Готово: поле «Телефон» добавлено.')).toBeVisible();
    await expect(page.getByText('form.schema.json (+9 −0)')).toBeVisible();

    // Узел нового поля — строкой дерева, с подписью и путём модели.
    await expect(page.getByText('Телефон', { exact: true })).toBeVisible();
    await expect(page.getByText('phone', { exact: true })).toBeVisible();
  });
});
