/**
 * Запросы к человеку в настоящем браузере.
 *
 * Правила очереди и отмены проверяются без браузера — [prompt.test.ts](../services/prompt.test.ts).
 * Здесь то, чего компиляция не видит: модальное окно кита, автофокус поля, выделение имени
 * без расширения, Escape как отмена и кнопка, погашенная проверкой.
 *
 * @module shell/platform/ui/dialogs/PromptHost.browser.test
 */

import { describe, expect, it, vi } from 'vitest';
import { page, userEvent } from 'vitest/browser';
import { createI18nService } from '@/shell/platform/services/i18n/i18n';
import { createPromptService } from '@/shell/platform/services/prompt';
import { type PromptService } from '@reformer/builder-plugin-api/internal';
import { renderReact } from '@/testing/render';
import { PromptHost } from './PromptHost';

const MESSAGES: Readonly<Record<string, string>> = {
  'shell.prompt.confirm': 'Готово',
  'shell.prompt.cancel': 'Отмена',
  'shell.prompt.value': 'Значение',
  'rename.title': 'Переименовать',
  'rename.label': 'Имя',
  'delete.title': 'Удалить безвозвратно?',
  'delete.message': 'Отменить это нельзя.',
  'name.empty': 'Имя не может быть пустым',
  'shell.prompt.pick.empty': 'Ничего не найдено',
  'shell.prompt.pick.remove': 'Убрать из списка',
  'recent.title': 'Недавно открытые',
  'recent.placeholder': 'Имя проекта…',
  'recent.empty': 'Недавних проектов нет',
  'recent.remove': 'Убрать из недавних',
};

/** Словарь плагина-заказчика: его ключи и ТОЛЬКО его — кнопок оболочки в нём нет. */
const PLUGIN_MESSAGES: Readonly<Record<string, string>> = {
  'menu.generate.title': 'Форма по шаблону',
  'menu.generate.label': 'Имя формы',
};

async function mountPrompt(): Promise<{ prompt: PromptService; unmount: () => void }> {
  const i18n = createI18nService({
    loadHostMessages: () => Promise.resolve(MESSAGES),
    dev: false,
  });
  await i18n.setLocale('ru');
  i18n.forPlugin('templates').contribute('ru', PLUGIN_MESSAGES);
  const prompt = createPromptService();
  const mounted = renderReact(<PromptHost prompt={prompt} i18n={i18n} />);
  return { prompt, unmount: mounted.unmount };
}

describe('запрос имени', () => {
  it('показывает окно, принимает ввод и отдаёт значение спрашивающему', async () => {
    const { prompt, unmount } = await mountPrompt();

    const answer = prompt.input({ titleKey: 'rename.title', labelKey: 'rename.label' });
    await expect.element(page.getByText('Переименовать')).toBeVisible();

    await userEvent.fill(page.getByRole('textbox'), 'model.ts');
    await userEvent.click(page.getByRole('button', { name: 'Готово' }));

    await expect(answer).resolves.toBe('model.ts');
    unmount();
  });

  it('Enter в поле подтверждает — до кнопки тянуться не надо', async () => {
    const { prompt, unmount } = await mountPrompt();

    const answer = prompt.input({ titleKey: 'rename.title', value: 'a.ts' });
    await expect.element(page.getByRole('textbox')).toBeVisible();
    await userEvent.fill(page.getByRole('textbox'), 'b.ts');
    await userEvent.keyboard('{Enter}');

    await expect(answer).resolves.toBe('b.ts');
    unmount();
  });

  it('Escape отменяет: передумать — законный исход, а не ошибка', async () => {
    const { prompt, unmount } = await mountPrompt();

    const answer = prompt.input({ titleKey: 'rename.title' });
    await expect.element(page.getByRole('textbox')).toBeVisible();
    await userEvent.keyboard('{Escape}');

    await expect(answer).resolves.toBeNull();
    unmount();
  });

  it('негодное значение гасит подтверждение и объясняет причину', async () => {
    const { prompt, unmount } = await mountPrompt();

    void prompt.input({
      titleKey: 'rename.title',
      value: 'a.ts',
      validate: (value) => (value.trim() === '' ? 'name.empty' : null),
    });
    await expect.element(page.getByRole('textbox')).toBeVisible();

    await userEvent.clear(page.getByRole('textbox'));

    await expect.element(page.getByText('Имя не может быть пустым')).toBeVisible();
    await expect.element(page.getByRole('button', { name: 'Готово' })).toBeDisabled();
    unmount();
  });

  it('запрос плагина: его ключи — из его словаря, кнопки — из словаря Host', async () => {
    // Отказ был ровно здесь: словарь заказчика брался и для УМОЛЧАНИЙ оболочки, поэтому
    // запрос без своих `confirmKey`/`cancelKey` показывал на кнопках ⟦templates.shell.
    // prompt.confirm⟧ — при переведённых заголовке и подписи поля рядом.
    const { prompt, unmount } = await mountPrompt();

    void prompt.input({
      titleKey: 'menu.generate.title',
      labelKey: 'menu.generate.label',
      pluginId: 'templates',
    });

    await expect.element(page.getByText('Форма по шаблону')).toBeVisible();
    await expect.element(page.getByText('Имя формы')).toBeVisible();
    await expect.element(page.getByRole('button', { name: 'Готово' })).toBeVisible();
    await expect.element(page.getByRole('button', { name: 'Отмена' })).toBeVisible();
    unmount();
  });

  it('выделяет имя БЕЗ расширения: меняют обычно основу', async () => {
    const { prompt, unmount } = await mountPrompt();

    void prompt.input({ titleKey: 'rename.title', value: 'schema.json', select: 'stem' });
    await expect.element(page.getByRole('textbox')).toBeVisible();

    await vi.waitFor(() => {
      const input = document.querySelector<HTMLInputElement>('#prompt-value');
      expect(input?.selectionStart).toBe(0);
      expect(input?.selectionEnd).toBe('schema'.length);
    });
    unmount();
  });
});

describe('подтверждение', () => {
  it('согласие и отказ доходят до спрашивающего', async () => {
    const { prompt, unmount } = await mountPrompt();

    const agreed = prompt.confirm({
      titleKey: 'delete.title',
      descriptionKey: 'delete.message',
      tone: 'danger',
    });
    await expect.element(page.getByText('Удалить безвозвратно?')).toBeVisible();
    await userEvent.click(page.getByRole('button', { name: 'Готово' }));
    await expect(agreed).resolves.toBe(true);

    const refused = prompt.confirm({ titleKey: 'delete.title' });
    await expect.element(page.getByRole('button', { name: 'Отмена' })).toBeVisible();
    await userEvent.click(page.getByRole('button', { name: 'Отмена' }));
    await expect(refused).resolves.toBe(false);

    unmount();
  });
});

describe('выбор из списка', () => {
  const ITEMS = [
    { id: 'a', label: 'forms', description: '11 сент.' },
    { id: 'b', label: 'credit', description: '10 сент.' },
    { id: 'c', label: 'forms-old', description: '1 авг.' },
  ];

  it('Enter выбирает первый пункт: предыдущий проект — одним нажатием', async () => {
    const { prompt, unmount } = await mountPrompt();

    const answer = prompt.pick({
      titleKey: 'recent.title',
      placeholderKey: 'recent.placeholder',
      items: ITEMS,
    });
    await expect.element(page.getByPlaceholder('Имя проекта…')).toBeVisible();
    await userEvent.keyboard('{Enter}');

    await expect(answer).resolves.toBe('a');
    unmount();
  });

  it('набор сужает список правилами палитры, стрелка и Enter выбирают', async () => {
    const { prompt, unmount } = await mountPrompt();

    const answer = prompt.pick({
      titleKey: 'recent.title',
      placeholderKey: 'recent.placeholder',
      items: ITEMS,
    });
    await userEvent.fill(page.getByPlaceholder('Имя проекта…'), 'forms');
    await expect.element(page.getByText('credit')).not.toBeInTheDocument();
    await userEvent.keyboard('{ArrowDown}');
    await userEvent.keyboard('{Enter}');

    await expect(answer).resolves.toBe('c');
    unmount();
  });

  it('щелчок по пункту выбирает его', async () => {
    const { prompt, unmount } = await mountPrompt();

    const answer = prompt.pick({ titleKey: 'recent.title', items: ITEMS });
    await userEvent.click(page.getByText('credit'));

    await expect(answer).resolves.toBe('b');
    unmount();
  });

  it('Escape отменяет: закрыть список, ничего не выбрав, — законный исход', async () => {
    const { prompt, unmount } = await mountPrompt();

    const answer = prompt.pick({ titleKey: 'recent.title', items: ITEMS });
    await expect.element(page.getByText('credit')).toBeVisible();
    await userEvent.keyboard('{Escape}');

    await expect(answer).resolves.toBeNull();
    unmount();
  });

  it('«убрать» не выбирает пункт и оставляет окно открытым', async () => {
    const { prompt, unmount } = await mountPrompt();
    const removed: string[] = [];

    const answer = prompt.pick({
      titleKey: 'recent.title',
      items: ITEMS,
      remove: {
        labelKey: 'recent.remove',
        run: (id) => {
          removed.push(id);
        },
      },
    });
    await userEvent.click(page.getByRole('button', { name: 'Убрать из недавних' }).nth(1));

    await expect.element(page.getByText('credit')).not.toBeInTheDocument();
    expect(removed).toEqual(['b']);
    expect(prompt.current()?.kind).toBe('pick');

    await userEvent.keyboard('{Escape}');
    await expect(answer).resolves.toBeNull();
    unmount();
  });

  it('пустой список говорит словами спрашивающего', async () => {
    const { prompt, unmount } = await mountPrompt();

    void prompt.pick({ titleKey: 'recent.title', emptyKey: 'recent.empty', items: [] });

    await expect.element(page.getByText('Недавних проектов нет')).toBeVisible();
    unmount();
  });
});
