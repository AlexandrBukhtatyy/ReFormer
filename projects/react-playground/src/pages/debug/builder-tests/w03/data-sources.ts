// data-sources.ts — значения $dataSource. МОК: опции из синтеза, замените реальными.
// Пишется один раз и при регенерации не затирается.

import type { SelectOption } from './types';

export const CITY_LIST: SelectOption[] = [
  {
    value: 'option1',
    label: 'City list 1',
  },
  {
    value: 'option2',
    label: 'City list 2',
  },
  {
    value: 'option3',
    label: 'City list 3',
  },
];
