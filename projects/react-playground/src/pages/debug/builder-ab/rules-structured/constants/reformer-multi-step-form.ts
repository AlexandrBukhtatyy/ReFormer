// constants/reformer-multi-step-form.ts — опции и константы источников данных ($dataSource).
// МОК: значения синтезированы, замените реальными. Ваш файл: пишется один раз и при
// регенерации не затирается.

import type { SelectOption } from '../types/reformer-multi-step-form';

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

export const GENDERS: SelectOption[] = [
  {
    value: 'male',
    label: 'Мужской',
  },
  {
    value: 'female',
    label: 'Женский',
  },
];

export const POSITIONS: SelectOption[] = [
  {
    value: 'developer',
    label: 'Разработчик',
  },
  {
    value: 'analyst',
    label: 'Аналитик',
  },
  {
    value: 'designer',
    label: 'Дизайнер',
  },
  {
    value: 'manager',
    label: 'Руководитель проекта',
  },
];

export const SKILLS: SelectOption[] = [
  {
    value: 'typescript',
    label: 'TypeScript',
  },
  {
    value: 'react',
    label: 'React',
  },
  {
    value: 'sql',
    label: 'SQL',
  },
  {
    value: 'figma',
    label: 'Figma',
  },
  {
    value: 'english',
    label: 'Английский язык',
  },
];

// TODO: подпись элемента
export const REFERENCE_LABEL = (_item: unknown, index: number): string => '#' + (index + 1);
