/**
 * Окно настроек — в настоящем браузере.
 *
 * Вне браузера здесь нечего проверять: окно рисует Radix в портале, а список вариантов —
 * `Select`, который открывается по нажатию и живёт вторым порталом. Проверяется то, из-за
 * чего окно вообще заведено:
 *
 * - **открывает КОМАНДА**, а не проп: значит доступно из меню, палитры и с клавиши;
 * - **разделы переключают содержимое** — иначе это не окно с разделами, а список полей;
 * - **выбор доходит до владельца настройки** и сразу виден в поле: значение читается
 *   у поля, а не хранится копией;
 * - **отказ записи объясняется**: молча не применившийся переключатель человек жмёт
 *   второй и третий раз.
 *
 * @module shell/platform/ui/dialogs/SettingsDialog.browser.test
 */

import { describe, expect, it, vi } from 'vitest';
import { page, userEvent } from 'vitest/browser';
import { createCommandRegistry } from '@/shell/platform/primitives/command';
import { createI18nService } from '@/shell/platform/services/i18n/i18n';
import { renderReact } from '@/testing/render';
import { SettingsDialog, SETTINGS_OPEN_COMMAND_ID } from './SettingsDialog';
import type { SettingsSection } from './settings-ui';

const MESSAGES: Readonly<Record<string, string>> = {
  'shell.settings.title': 'Настройки',
  'shell.settings.description': 'Параметры интерфейса',
  'shell.settings.sections': 'Разделы настроек',
  'shell.settings.failed': 'Не удалось применить',
  'shell.settings.search': 'Поиск настроек',
  'shell.settings.no-results': 'Ничего не найдено',
  'appearance.title': 'Внешний вид',
  'appearance.theme': 'Тема',
  'appearance.theme.light': 'Светлая',
  'appearance.theme.dark': 'Тёмная',
  'language.title': 'Язык',
  'language.locale': 'Язык интерфейса',
  'language.ru': 'Русский',
  'language.en': 'English',
};

interface Fixture {
  readonly written: string[];
  readonly open: () => Promise<unknown>;
  unmount(): void;
}

async function mountDialog(options: { failing?: boolean } = {}): Promise<Fixture> {
  const written: string[] = [];
  let theme = 'light';
  const sections: readonly SettingsSection[] = [
    {
      kind: 'fields',
      id: 'appearance',
      titleKey: 'appearance.title',
      fields: [
        {
          id: 'theme',
          titleKey: 'appearance.theme',
          choices: [
            { value: 'light', titleKey: 'appearance.theme.light' },
            { value: 'dark', titleKey: 'appearance.theme.dark' },
          ],
          read: () => theme,
          write: async (value) => {
            if (options.failing === true) throw new Error('хранилище отказало');
            written.push(value);
            theme = value;
          },
        },
      ],
    },
    {
      kind: 'fields',
      id: 'language',
      titleKey: 'language.title',
      fields: [
        {
          id: 'locale',
          titleKey: 'language.locale',
          choices: [
            { value: 'ru', titleKey: 'language.ru' },
            { value: 'en', titleKey: 'language.en' },
          ],
          read: () => 'ru',
          write: async (value) => {
            written.push(value);
          },
        },
      ],
    },
  ];

  const i18n = createI18nService({
    loadHostMessages: () => Promise.resolve(MESSAGES),
    dev: false,
  });
  await i18n.setLocale('ru');
  const commands = createCommandRegistry();
  const mounted = renderReact(
    <SettingsDialog commands={commands} i18n={i18n} sections={sections} />
  );

  // Команду регистрирует ЭФФЕКТ окна, а он выполняется после монтирования: без ожидания
  // тест звал бы её раньше, чем она появится.
  await vi.waitFor(() => {
    if (commands.get(SETTINGS_OPEN_COMMAND_ID) === undefined) {
      throw new Error('команда ещё не зарегистрирована');
    }
  });

  return {
    written,
    open: () => commands.execute(SETTINGS_OPEN_COMMAND_ID),
    unmount: mounted.unmount,
  };
}

/** Выбрать вариант в списке: `Select` открывается нажатием и рисует пункты порталом. */
async function choose(fieldId: string, option: string): Promise<void> {
  await userEvent.click(page.getByTestId(`setting-${fieldId}`));
  await userEvent.click(page.getByRole('option', { name: option }));
}

describe('окно настроек', () => {
  it('открывается командой и показывает первый раздел', async () => {
    const fixture = await mountDialog();
    expect(page.getByTestId('settings-dialog').elements()).toHaveLength(0);

    await fixture.open();

    await expect.element(page.getByText('Настройки')).toBeVisible();
    await expect.element(page.getByText('Тема')).toBeVisible();
    fixture.unmount();
  });

  it('раздел переключает поля', async () => {
    const fixture = await mountDialog();
    await fixture.open();
    await expect.element(page.getByText('Тема')).toBeVisible();

    await userEvent.click(page.getByTestId('settings-section-language'));

    await expect.element(page.getByText('Язык интерфейса')).toBeVisible();
    expect(page.getByText('Тема').elements()).toHaveLength(0);
    fixture.unmount();
  });

  it('поиск ищет по всем разделам, а не внутри выбранного', async () => {
    // Иначе искать пришлось бы, уже угадав раздел, — то есть ровно то, от чего поиск избавляет.
    const fixture = await mountDialog();
    await fixture.open();
    expect(page.getByText('Язык интерфейса').elements()).toHaveLength(0);

    await userEvent.fill(page.getByTestId('settings-search'), 'язык');

    await expect.element(page.getByText('Язык интерфейса')).toBeVisible();
    expect(page.getByText('Тема', { exact: true }).elements()).toHaveLength(0);
    fixture.unmount();
  });

  it('запрос без совпадений объясняется, а не показывает пустоту', async () => {
    const fixture = await mountDialog();
    await fixture.open();

    await userEvent.fill(page.getByTestId('settings-search'), 'шрифт');

    await expect.element(page.getByText('Ничего не найдено')).toBeVisible();
    fixture.unmount();
  });

  it('выбор раздела отменяет поиск', async () => {
    const fixture = await mountDialog();
    await fixture.open();
    await userEvent.fill(page.getByTestId('settings-search'), 'язык');
    await expect.element(page.getByText('Язык интерфейса')).toBeVisible();

    await userEvent.click(page.getByTestId('settings-section-appearance'));

    await expect.element(page.getByText('Тема', { exact: true })).toBeVisible();
    expect(page.getByText('Язык интерфейса').elements()).toHaveLength(0);
    fixture.unmount();
  });

  it('выбор уходит владельцу настройки и сразу виден в поле', async () => {
    const fixture = await mountDialog();
    await fixture.open();

    await choose('theme', 'Тёмная');

    await expect.poll(() => fixture.written).toEqual(['dark']);
    // Значение читается У ПОЛЯ: своя копия в состоянии окна разошлась бы с ним при первой же
    // смене настройки мимо окна.
    await expect.element(page.getByTestId('setting-theme')).toHaveTextContent('Тёмная');
    fixture.unmount();
  });

  it('отказ записи объясняется, а не остаётся в консоли', async () => {
    const fixture = await mountDialog({ failing: true });
    await fixture.open();

    await choose('theme', 'Тёмная');

    await expect.element(page.getByText('Не удалось применить')).toBeVisible();
    fixture.unmount();
  });
});
