/**
 * «Очистить кэш» в настоящем Chromium — весь путь целиком.
 *
 * Исходы команды проверены в `node` (`./storage-purge.test`), правила меню — в `./menu.test`.
 * Браузеру остаётся то, чего в `node` нет вовсе и что здесь только и может разойтись:
 * доехал ли порт композиции до реестра команд, встал ли пункт в «Файл» (и пропадает ли он
 * без порта), доводит ли щелчок до диалога подтверждения и доходит ли согласие обратно
 * до очистки и перезапуска.
 *
 * @module host/ui/StoragePurge.browser.test
 */

import { describe, expect, it, vi } from 'vitest';
import { page, userEvent } from 'vitest/browser';
import { createElement } from 'react';
import { createCommandRegistry } from '../primitives/command';
import { createExtensionRegistry } from '../primitives/extension-point';
import { createI18nService } from '../services/i18n/i18n';
import { createInMemorySettingsBackend, createSettingsService } from '../services/settings';
import { createPromptService } from '../services/prompt';
import type { PurgeReport } from '../workspace/storage/purge';
import { Shell } from './Shell';
import { createWhenContextStore } from './when-context-store';
import { renderReact } from '@/testing/render';

/** Снимок строки состояния: замороженная ссылка — требование `useSyncExternalStore`. */
const SNAPSHOT = Object.freeze({ hasWorkspace: false });
const STATUS = {
  get: () => SNAPSHOT,
  subscribe: () => ({ dispose() {} }),
} as never;

const CLEAN: PurgeReport = Object.freeze({ removed: 4, blocked: [], failures: [] });

async function mount(storage?: { purge: () => Promise<PurgeReport>; reload: () => void }) {
  const i18n = createI18nService();
  // Словарь Host грузится установкой локали: без него и «Файл», и подпись пункта были бы
  // маркерами промаха, и проверка «пункт на месте» проверяла бы их, а не пункт.
  await i18n.setLocale('ru');

  const settings = createSettingsService(createInMemorySettingsBackend({}));
  await settings.hydrate();

  renderReact(
    createElement(Shell, {
      host: {
        extensions: createExtensionRegistry(),
        whenContext: createWhenContextStore(),
        settings,
        commands: createCommandRegistry(),
        i18n,
        status: STATUS,
        prompt: createPromptService(),
        ...(storage === undefined ? {} : { storage }),
      } as never,
    })
  );
}

describe('очистка кэша из меню «Файл»', () => {
  it('без порта композиции пункта нет вовсе — не серым, а никак', async () => {
    await mount();

    await userEvent.click(page.getByRole('menuitem', { name: 'Файл' }));

    await expect.element(page.getByRole('menuitem', { name: 'Настройки' })).toBeVisible();
    expect(page.getByRole('menuitem', { name: 'Очистить кэш' }).elements()).toHaveLength(0);
  });

  it('согласие ведёт к очистке и перезапуску', async () => {
    const purge = vi.fn(() => Promise.resolve(CLEAN));
    const reload = vi.fn();
    await mount({ purge, reload });

    await userEvent.click(page.getByRole('menuitem', { name: 'Файл' }));
    await userEvent.click(page.getByRole('menuitem', { name: 'Очистить кэш' }));

    // Спрашивают ДО того, как что-то снесено: несохранённые правки не восстанавливаются.
    await expect.element(page.getByText('Очистить кэш приложения?')).toBeVisible();
    expect(purge).not.toHaveBeenCalled();

    await userEvent.click(page.getByRole('button', { name: 'Очистить' }));

    await vi.waitFor(() => {
      expect(purge).toHaveBeenCalledTimes(1);
      expect(reload).toHaveBeenCalledTimes(1);
    });
  });

  it('отмена не трогает ни хранилище, ни страницу', async () => {
    const purge = vi.fn(() => Promise.resolve(CLEAN));
    const reload = vi.fn();
    await mount({ purge, reload });

    await userEvent.click(page.getByRole('menuitem', { name: 'Файл' }));
    await userEvent.click(page.getByRole('menuitem', { name: 'Очистить кэш' }));
    await expect.element(page.getByText('Очистить кэш приложения?')).toBeVisible();

    await userEvent.click(page.getByRole('button', { name: 'Отмена' }));

    await expect.element(page.getByText('Очистить кэш приложения?')).not.toBeInTheDocument();
    expect(purge).not.toHaveBeenCalled();
    expect(reload).not.toHaveBeenCalled();
  });
});
