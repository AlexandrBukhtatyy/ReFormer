// data-sources.ts — значения $dataSource. МОК: опции из синтеза, замените реальными.
// Пишется один раз и при регенерации не затирается.

import type { SelectOption } from './types';

export const CITY_LIST: SelectOption[] = [
  {
    value: 'msk',
    label: 'Москва',
  },
  {
    value: 'spb',
    label: 'Санкт-Петербург',
  },
  {
    value: 'nsk',
    label: 'Новосибирск',
  },
];
