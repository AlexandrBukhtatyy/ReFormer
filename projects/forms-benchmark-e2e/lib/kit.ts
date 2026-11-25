/**
 * Как сценарий замера ведёт виджеты участника: драйвер списков и разметка мастера и массивов.
 *
 * Участники набора библиотек — нативные элементы и разметка бенчмарка (BENCH-CONTRACT §4): для
 * них всё как прежде. Стеки набора `frameworks` рисуют формы китами — всплывающие списки, свой
 * мастер и массивы (cross-framework-e2e/DOM-CONTRACT.md); их драйверы и разметка — те же, что у
 * сценариев кросс-e2e.
 */
import { taigaDriver } from '../../cross-framework-e2e/drivers/taiga';
import { uiKitDriver } from '../../cross-framework-e2e/drivers/ui-kit';
import { vuetifyDriver } from '../../cross-framework-e2e/drivers/vuetify';
import { kitMarkup } from '../../cross-framework-e2e/markup';
import { nativeDriver, type ControlDriver } from '../pom/control-driver';
import { benchMarkup, type FormMarkup } from '../pom/form-markup';
import type { Participant } from './participants';

const DRIVERS: Record<NonNullable<Participant['driver']>, ControlDriver> = {
  native: nativeDriver,
  'ui-kit': uiKitDriver,
  vuetify: vuetifyDriver,
  taiga: taigaDriver,
};

export const driverOf = (lib: Participant): ControlDriver => DRIVERS[lib.driver ?? 'native'];

export const markupOf = (lib: Participant): FormMarkup =>
  lib.markup === 'kit' ? kitMarkup : benchMarkup;
