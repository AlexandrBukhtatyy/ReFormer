/**
 * Диалог расхождения в настоящем Chromium — то, чего в `node` не видно: раскладка и ввод.
 *
 * Правила (какие колонки, какие исходы) проверены в `./merge.test`. Здесь — что человек
 * действительно может ответить: кнопки на экране при любой длине строк, правка видна без
 * поиска глазами, а готовое слияние принимается одной кнопкой.
 *
 * @module shell/platform/ui/dialogs/MergeDialog.browser.test
 */

import { describe, expect, it, vi } from 'vitest';
import { page, userEvent } from 'vitest/browser';
import { createElement } from 'react';
import { createI18nService } from '@/shell/platform/services/i18n/i18n';
import { planMerge, type MergeSides } from '@/shell/platform/workspace/merge/resolve';
import { renderReact } from '@/testing/render';
import { MergeDialog, type MergeDialogProps } from './MergeDialog';

/** Файл в сорок строк, одна из них длиннее окна: так выглядит настоящий исходник. */
const LONG = `// ${'очень длинная строка комментария '.repeat(20)}`;
const lines = (changed: Readonly<Record<number, string>>): string =>
  Array.from({ length: 40 }, (_, index) => changed[index] ?? `строка ${index + 1}`).join('\n');

const BASE = lines({ 0: LONG });

async function dialog(
  sides: MergeSides,
  props: Partial<MergeDialogProps> = {}
): Promise<{
  readonly onResolve: ReturnType<typeof vi.fn>;
  readonly onCancel: ReturnType<typeof vi.fn>;
}> {
  const i18n = createI18nService();
  await i18n.setLocale('ru');
  const onResolve = vi.fn();
  const onCancel = vi.fn();
  renderReact(
    createElement(MergeDialog, {
      open: true,
      name: 'cities.ts',
      path: 'src/services/cities.ts',
      sides,
      plan: planMerge(sides),
      i18n,
      onCancel,
      onResolve,
      ...props,
    })
  );
  await expect.element(page.getByRole('dialog')).toBeVisible();
  return { onResolve, onCancel };
}

/** Правки разных строк — слияние готово. */
const APART: MergeSides = {
  base: BASE,
  ours: lines({ 0: LONG, 29: 'НАША правка' }),
  theirs: lines({ 0: LONG, 34: 'ИХ правка' }),
};

/** Правки одной строки — спор. */
const SAME: MergeSides = {
  base: BASE,
  ours: lines({ 0: LONG, 29: 'НАША правка' }),
  theirs: lines({ 0: LONG, 29: 'ИХ правка' }),
};

describe('диалог расхождения', () => {
  it('длинная строка файла не выталкивает кнопки за край окна', async () => {
    // Колонка сетки диалога росла до самой длинной строки, и вместе с ней уезжали вправо
    // и третья колонка сравнения, и кнопки ответа: спросить спросили, а ответить нечем.
    await dialog(SAME);

    for (const name of ['Отмена', 'Взять версию источника', 'Переписать своей версией']) {
      const box = page.getByRole('button', { name }).element().getBoundingClientRect();
      expect(box.left, name).toBeGreaterThanOrEqual(0);
      expect(box.right, name).toBeLessThanOrEqual(window.innerWidth);
    }
  });

  it('изменённые строки помечены, и колонки открыты на первой правке', async () => {
    await dialog(SAME);

    const marked = [...document.querySelectorAll('[data-changed]')];
    expect(marked.map((line) => line.textContent)).toEqual(['30НАША правка', '30ИХ правка']);
    // Тридцатая строка из сорока в окне на десяток строк — видна без прокрутки руками.
    for (const line of marked) {
      const viewport = line.closest('[data-slot="scroll-area-viewport"]');
      const frame = viewport?.getBoundingClientRect();
      const box = line.getBoundingClientRect();
      expect(box.top).toBeGreaterThanOrEqual(frame?.top ?? Infinity);
      expect(box.bottom).toBeLessThanOrEqual(frame?.bottom ?? -Infinity);
    }
  });

  it('правки не пересеклись — готовое слияние принимается одной кнопкой', async () => {
    const { onResolve } = await dialog(APART);

    await expect.element(page.getByText('Правки не пересеклись', { exact: false })).toBeVisible();
    await userEvent.click(page.getByRole('button', { name: 'Объединить правки' }));

    expect(onResolve).toHaveBeenCalledWith(
      'merged',
      lines({ 0: LONG, 29: 'НАША правка', 34: 'ИХ правка' })
    );
  });

  it('спорная правка готовым слиянием не предлагается: выбрать сторону или слить руками', async () => {
    const { onResolve } = await dialog(SAME);

    expect(page.getByRole('button', { name: 'Объединить правки' }).elements()).toHaveLength(0);
    await userEvent.click(page.getByRole('button', { name: 'Переписать своей версией' }));

    expect(onResolve).toHaveBeenCalledWith('ours');
  });

  it('отказ прошлого ответа показан в диалоге, а сам он остаётся открытым', async () => {
    await dialog(SAME, { problem: { kind: 'failed', message: 'нет доступа' } });

    await expect
      .element(page.getByRole('alert'))
      .toHaveTextContent('Записать не удалось: нет доступа.');
  });

  it('крестик и Escape — отмена, а не выбор стороны', async () => {
    const { onCancel, onResolve } = await dialog(SAME);

    await userEvent.keyboard('{Escape}');

    expect(onCancel).toHaveBeenCalledTimes(1);
    expect(onResolve).not.toHaveBeenCalled();
  });
});
