/**
 * Драйвер списка `@reformer/ui-kit` (`Select` каталога — `SelectAsync` на Radix).
 *
 * Нативного `<select>` у списка нет: `input-{path}` — кнопка-триггер, пункты — всплывающая панель
 * в портале, которой нет в DOM, пока она закрыта; на триггере — подпись выбранного пункта, не
 * значение. Опоры DOM-контракта (../DOM-CONTRACT.md) — как у китов Vuetify и Taiga UI: значение —
 * атрибут `data-value` на `input-{path}`, пункты открытой панели — `option-{path}-{value}`.
 *
 * Пустого пункта у панели Radix нет: пустое значение у списка — его состояние без выбора. Поэтому
 * драйвер ставит `''` первым в перечне пунктов, как у нативного `<select>` и китов, а выбрать `''`
 * может, только если список и так пуст.
 */
import { expect, type Locator } from '@playwright/test';
import type { ControlDriver, SelectTarget } from '../../forms-benchmark-e2e/pom/control-driver';

/** Пункты открытой панели списка. Панель живёт вне поля — в портале страницы. */
const optionsOf = ({ page, id }: SelectTarget): Locator =>
  page.locator(`[data-testid^="option-${id}-"]`);

/** Открыть панель кликом по триггеру и дождаться пунктов. */
async function open(target: SelectTarget): Promise<Locator> {
  await target.input.click();
  const options = optionsOf(target);
  await expect(options.first()).toBeVisible();
  return options;
}

export const uiKitDriver: ControlDriver = {
  async select(target, value) {
    if (value === '') {
      // Сбросить выбор панель Radix не умеет — пустое значение допустимо, только если оно уже стоит.
      await expect(target.input).toHaveAttribute('data-value', '');
      return;
    }
    const options = await open(target);
    await target.page.getByTestId(`option-${target.id}-${value}`).click();
    // Выбор закрывает панель; следующий шаг сценария не должен попасть в уходящие пункты.
    await expect(options).toHaveCount(0);
  },

  async options(target) {
    const options = await open(target);
    const prefix = `option-${target.id}-`;
    const values = await options.evaluateAll(
      (items, start) =>
        items.map((item) => (item.getAttribute('data-testid') ?? '').slice(start.length)),
      prefix
    );
    await target.page.keyboard.press('Escape');
    await expect(options).toHaveCount(0);
    return ['', ...values];
  },

  async expectSelected({ input }, value) {
    await expect(input).toHaveAttribute('data-value', value);
  },
};
