/**
 * Драйвер контролов стека: как сценарий ведёт виджет, у которого нет нативного элемента формы.
 *
 * Сценарии и POM общие для трёх стеков, а список у библиотек компонентов — всплывающая панель,
 * у каждой своя. Что делать со списком, POM спрашивает у
 * драйвера стека (../../forms-benchmark-e2e/pom/control-driver.ts).
 */
import type { ControlDriver } from '../../forms-benchmark-e2e/pom/control-driver';
import type { StackId } from '../stacks';
import { taigaDriver } from './taiga';
import { uiKitDriver } from './ui-kit';
import { vuetifyDriver } from './vuetify';

const DRIVERS: Record<StackId, ControlDriver> = {
  // Флажок и радиокнопки ui-kit — элементы с ролью: Playwright отмечает и читает их как нативные.
  react: uiKitDriver,
  vue: vuetifyDriver,
  angular: taigaDriver,
};

export const driverOf = (stack: StackId): ControlDriver => DRIVERS[stack];
