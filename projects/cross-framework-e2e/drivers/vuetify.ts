/**
 * Драйвер списка Vuetify (`VSelect`).
 *
 * Нативного `<select>` у списка нет: пункты — всплывающая панель, которой нет в DOM, пока она
 * закрыта, а в поле ввода стоит подпись выбранного пункта, не значение. Кит страницы даёт
 * сценарию опоры DOM-контракта (../DOM-CONTRACT.md): значение — атрибут `data-value` на
 * `input-{path}`, пункты открытой панели — `option-{path}-{value}`.
 */
import { expect, type Locator } from '@playwright/test';
import type { ControlDriver, SelectTarget } from '../../forms-benchmark-e2e/pom/control-driver';

/** Пункты открытой панели списка. Панель живёт вне поля — в общем слое страницы. */
const optionsOf = ({ page, id }: SelectTarget): Locator =>
  page.locator(`[data-testid^="option-${id}-"]`);

/**
 * Открыть панель списка и дождаться пунктов: пустой пункт есть всегда. Нажимается рамка поля:
 * нативный `<input>` внутри неё нажатий не принимает.
 */
async function open(target: SelectTarget): Promise<Locator> {
  const { page, id } = target;
  await page.getByTestId(`field-${id}`).locator('.v-field').click();
  const options = optionsOf(target);
  await expect(options.first()).toBeVisible();
  return options;
}

export const vuetifyDriver: ControlDriver = {
  async select(target, value) {
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
    return values;
  },

  async expectSelected({ input }, value) {
    await expect(input).toHaveAttribute('data-value', value);
  },
};
