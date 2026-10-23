/**
 * Печатник встроенных шаблонов — возможность стека генерации кода.
 *
 * Печатает встроенный шаблон генерация кода, и до сих пор переходник жил в композиции: она тянула
 * кодоген динамическим импортом мимо состава, поэтому профиль без генерации всё равно печатал бы
 * её кодом. Теперь это возможность, и у неё три состояния, каждое из которых ломается молча: её
 * нет (печатать нечем), она появилась ПОЗЖЕ активации шаблонов (оба плагина ленивые, порядок
 * незначим), она есть.
 *
 * @module plugins/reformer/templates/workspace.test
 */

import { describe, expect, it, vi } from 'vitest';
import type { PluginContext } from '@reformer/builder-plugin-api';
import { hasPrinter, ModulePrinterCapability, templatesPrinter } from './workspace';

/** Схема в объёме подписи печатника: её содержимое здесь ни на что не влияет. */
const SCHEMA = {
  format: 2,
  version: '1.0',
  root: { component: '$html(div)' },
} as unknown as Parameters<ReturnType<typeof templatesPrinter>>[0];

/** Контекст в объёме реестра служб: печатник есть, нет или появится позже. */
function harness(options: { readonly printer?: boolean } = {}) {
  const print = vi.fn(() => Promise.resolve([{ path: 'model.ts', content: 'export {};' }]));
  let printer: { print: typeof print } | undefined =
    options.printer === false ? undefined : { print };
  const ctx = {
    services: {
      get: (token: { id: string }) =>
        token.id === ModulePrinterCapability.id ? printer : undefined,
    },
  } as unknown as PluginContext;
  return {
    ctx,
    print,
    raise: () => {
      printer = { print };
    },
  };
}

describe('печатник берётся возможностью соседа', () => {
  it('печать уходит в возможность, а не в собственную копию конвейера', async () => {
    const h = harness();

    const files = await templatesPrinter(h.ctx)(SCHEMA, 'credit');

    expect(files.map((file) => file.path)).toEqual(['model.ts']);
    expect(h.print).toHaveBeenCalledTimes(1);
  });

  it('без возможности печатать нечем — пустой список, а не падение', async () => {
    // Профиль без генерации кода законен: раздел встроенных шаблонов просто не показывается.
    const h = harness({ printer: false });

    await expect(templatesPrinter(h.ctx)(SCHEMA, 'credit')).resolves.toEqual([]);
    expect(hasPrinter(h.ctx)).toBe(false);
  });

  it('возможность, появившаяся ПОЗЖЕ, доходит до раздела: оба плагина ленивые', async () => {
    // Ответ, снятый при активации, оставил бы встроенные шаблоны недоступными навсегда —
    // порядок активации плагинов объявлен незначимым.
    const h = harness({ printer: false });
    expect(hasPrinter(h.ctx)).toBe(false);

    h.raise();

    expect(hasPrinter(h.ctx)).toBe(true);
    await expect(templatesPrinter(h.ctx)(SCHEMA, 'credit')).resolves.toHaveLength(1);
  });
});
