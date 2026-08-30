/**
 * Экран горячих клавиш в настоящем браузере.
 *
 * Здесь проверяется ровно то, чего без DOM не видно и что в `node` недоказуемо: **фаза
 * события**. Поле записи ставит нативный слушатель на себя в фазе погружения, и вся его
 * ценность в том, что он получает нажатие РАНЬШЕ глобального диспетчера. Проверить это можно
 * только настоящим событием: в jsdom порядок фаз воспроизводится приближённо, то есть
 * проверялась бы подделка.
 *
 * Правила экрана (строки, поиск, сборка аккорда, конфликты) живут в
 * [keybinding-editor.ts](keybinding-editor.ts) и проверяются в `node`.
 *
 * @module host/ui/KeybindingsDialog.browser.test
 */

import { afterEach, describe, expect, it, vi } from 'vitest';
import { page, userEvent } from 'vitest/browser';
import { createCommandRegistry } from '../primitives/command';
import { createI18nService } from '../services/i18n/i18n';
import { renderReact } from '../../testing/render';
import { KeybindingsDialog, KEYBINDINGS_OPEN_COMMAND_ID } from './KeybindingsDialog';
import { createKeymapService } from './keymap';
import { installKeybindings } from './keybindings';
import { createScopeStack } from './scope';
import { whenContext } from '../primitives/when-context';

const MESSAGES: Readonly<Record<string, string>> = {
  'shell.keybindings.title': 'Горячие клавиши',
  'shell.keybindings.hint': 'Нажмите «Изменить» и наберите сочетание.',
  'shell.keybindings.empty': 'Ничего не найдено',
  'shell.keybindings.search.label': 'Поиск',
  'shell.keybindings.search.placeholder': 'Команда…',
  'shell.keybindings.record.start': 'Изменить',
  'shell.keybindings.record.commit': 'Назначить',
  'shell.keybindings.record.cancel': 'Отмена',
  'shell.keybindings.reset': 'Вернуть исходное',
  'shell.keybindings.conflict': 'Уже назначено: {command}',
  'shell.keybindings.conflict.unresolved': 'Совпадает с другой командой',
  'files.command.save': 'Сохранить',
  'shell.keybindings.column.command': 'Команда',
  'shell.keybindings.column.key': 'Ключ',
  'shell.keybindings.column.chord': 'Сочетание',
  'shell.keybindings.column.when': 'Когда',
  'shell.keybindings.column.source': 'Источник',
  'shell.keybindings.column.actions': 'Действия',
  'shell.keybindings.source.host': 'Оболочка',
  'shell.keybindings.source.plugin': 'Плагин',
  'shell.keybindings.source.user': 'Пользователь',
  'shell.keybindings.remove': 'Снять',
};

interface Fixture {
  readonly saved: ReturnType<typeof vi.fn>;
  readonly scopes: ReturnType<typeof createScopeStack>;
  readonly open: () => Promise<void>;
  readonly startRecording: () => Promise<void>;
}

async function setup(): Promise<Fixture> {
  const commands = createCommandRegistry();
  const saved = vi.fn();
  commands.register({
    id: 'files.save',
    titleKey: 'files.command.save',
    keybinding: 'mod+s',
    allowInEditable: true,
    run: saved,
  });

  const keymap = createKeymapService({ commands, modifier: 'ctrl' });
  const scopes = createScopeStack();
  const i18n = createI18nService({ loadHostMessages: () => Promise.resolve(MESSAGES), dev: true });
  await i18n.setLocale('ru');

  // Настоящий глобальный слой — тот же, что в оболочке: без него «запись перехватила
  // нажатие» проверялась бы против пустоты.
  const keys = installKeybindings(document, {
    commands,
    keymap,
    getContext: () => whenContext(),
    modifier: 'ctrl',
  });
  cleanups.push(() => {
    keys.dispose();
  });

  renderReact(
    <KeybindingsDialog commands={commands} keymap={keymap} i18n={i18n} scopes={scopes} />
  );

  return {
    saved,
    scopes,
    open: async () => {
      // Команду регистрирует эффект компонента — той же дверью, что палитра и справка.
      // До первого эффекта её не существует, и это не гонка теста, а контракт: команда,
      // открывающая окно, не должна значиться доступной, пока окна нет.
      await vi.waitFor(() => {
        expect(commands.get(KEYBINDINGS_OPEN_COMMAND_ID)).toBeDefined();
      });
      await commands.execute(KEYBINDINGS_OPEN_COMMAND_ID);
      await expect.element(page.getByTestId('keybindings-dialog')).toBeInTheDocument();
    },
    startRecording: async () => {
      await userEvent.click(page.getByRole('button', { name: 'Изменить' }).first());
      await expect.element(page.getByTestId('keybinding-recorder')).toBeInTheDocument();
    },
  };
}

const cleanups: (() => void)[] = [];
afterEach(() => {
  for (const cleanup of cleanups.splice(0)) cleanup();
});

describe('запись нажатия', () => {
  it('перехватывает mod+s, и файл НЕ сохраняется', async () => {
    // Несущий тест файла. Без перехвата в фазе погружения запись сочетания сохранения
    // сохраняла бы файл — то есть настройка клавиши делала бы работу вместо настройки.
    const fixture = await setup();
    await fixture.open();
    await fixture.startRecording();

    await userEvent.keyboard('{Control>}s{/Control}');

    expect(fixture.saved).not.toHaveBeenCalled();
  });

  it('показывает записанное сочетание', async () => {
    const fixture = await setup();
    await fixture.open();
    await fixture.startRecording();

    await userEvent.keyboard('{Control>}{Alt>}d{/Alt}{/Control}');

    await expect.element(page.getByTestId('keybinding-recorder')).toHaveTextContent('ctrl');
  });

  it('Escape отменяет запись, а не закрывает окно', async () => {
    // Ровно тот случай, на котором палитра уже обожглась: Radix ловит Escape на `document`
    // в фазе погружения, и к моменту синтетического события поддерева уже нет. Перехват
    // на самом поле — единственное, что спасает.
    const fixture = await setup();
    await fixture.open();
    await fixture.startRecording();

    await userEvent.keyboard('{Escape}');

    await expect.element(page.getByTestId('keybinding-recorder')).not.toBeInTheDocument();
    await expect.element(page.getByTestId('keybindings-dialog')).toBeInTheDocument();
  });
});

describe('таблица', () => {
  it('строка несёт КЛЮЧ команды и её сочетание', async () => {
    // Ключ показывается рядом с сочетанием потому, что именно им команда называется
    // в раскладке, в манифесте плагина и в обращении к ассистенту. Без него строка
    // «Сохранить — Ctrl+S» не отвечает на вопрос «а как эту команду зовут».
    const fixture = await setup();
    await fixture.open();

    const row = document.querySelector('[data-testid="keybinding-row-files.save"]');
    expect(row).not.toBeNull();
    const cells = [...(row?.querySelectorAll('td') ?? [])].map((cell) => cell.textContent ?? '');

    expect(cells[0]).toContain('Сохранить');
    expect(cells[1]).toBe('files.save');
    expect(cells[2]).toContain('Ctrl');
  });

  it('шапка называет колонки', async () => {
    const fixture = await setup();
    await fixture.open();

    const headers = [...document.querySelectorAll('thead th')].map((th) => th.textContent ?? '');

    expect(headers).toHaveLength(6);
    expect(headers[1]).toBe('Ключ');
    expect(headers[2]).toBe('Сочетание');
  });

  it('окно шире обычного диалога: шести колонкам нужно место', async () => {
    // Проверяется ФАКТИЧЕСКАЯ ширина, а не наличие класса. У диалога кита объявлено
    // `sm:max-w-lg` (512px), и базовый `max-w-4xl` его не перебивает: слияние классов
    // не считает разные варианты конфликтующими, а в CSS правило с медиа-запросом идёт
    // позже. Первая попытка задать ширину именно так и не сработала — молча.
    await page.viewport(1400, 900);
    const fixture = await setup();
    await fixture.open();

    const dialog = document.querySelector('[data-testid="keybindings-dialog"]');
    expect(dialog?.getBoundingClientRect().width).toBeGreaterThan(600);
  });

  it('таблица укладывается в ширину окна, а не разъезжается за край', async () => {
    // Ровно тот дефект, который был найден замером: при автоматической раскладке колонок
    // таблица растягивалась вчетверо шире контейнера, и кнопки последней колонки уезжали
    // за край экрана — то есть переставали нажиматься.
    const fixture = await setup();
    await fixture.open();

    const table = document.querySelector('table');
    const container = document.querySelector('[data-slot="table-container"]');
    expect(table).not.toBeNull();
    expect(table?.getBoundingClientRect().width).toBeLessThanOrEqual(
      (container?.getBoundingClientRect().width ?? 0) + 1
    );
  });
});

describe('область окна', () => {
  it('пока экран открыт, его область лежит в стеке; после закрытия снимается', async () => {
    const fixture = await setup();
    expect(fixture.scopes.top()).toBeNull();

    await fixture.open();
    expect(fixture.scopes.all()).toContain('dialog');

    await userEvent.keyboard('{Escape}');
    await vi.waitFor(() => {
      expect(fixture.scopes.top()).toBeNull();
    });
  });
});
