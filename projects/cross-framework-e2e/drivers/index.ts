/**
 * Драйвер контролов стека: как сценарий ведёт виджет, у которого нет нативного элемента формы.
 *
 * Сценарии и POM общие для трёх стеков, а список у библиотек компонентов разный: у ui-kit —
 * нативный `<select>`, у Vuetify и Taiga UI — всплывающая панель. Что делать со списком, POM спрашивает у
 * драйвера стека (../../forms-benchmark-e2e/pom/control-driver.ts).
 */
import { nativeDriver, type ControlDriver } from '../../forms-benchmark-e2e/pom/control-driver';
import type { StackId } from '../stacks';
import { taigaDriver } from './taiga';
import { vuetifyDriver } from './vuetify';

const DRIVERS: Record<StackId, ControlDriver> = {
  // Список ui-kit — нативный `<select>`; флажок и радиокнопки — элементы с ролью, их Playwright
  // отмечает и читает так же, как нативные.
  react: nativeDriver,
  vue: vuetifyDriver,
  angular: taigaDriver,
};

export const driverOf = (stack: StackId): ControlDriver => DRIVERS[stack];
