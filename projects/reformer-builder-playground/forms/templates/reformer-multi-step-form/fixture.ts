/**
 * Фикстура формы: чем наполнить её в предпросмотре.
 *
 * Слои независимы — заполняйте только нужные:
 *   model        начальные значения (СТАРШЕ model/initial-value.ts: фикстура пишется ради проверки)
 *   dataSources  значения $dataSource
 *   modules      подстановка импортов формы (../api, @/shared/...) — форма не пойдёт в сеть
 *   http         перехват запросов, если форма всё же зовёт fetch
 *   clock        фиксированные Date.now() и Math.random()
 */

export const fixture = {
  model: {
    lastName: 'Иванов',
    firstName: 'Иван',
    fullName: '',
    birthDate: null,
    gender: '',
    phone: '',
    email: '',
    city: 'msk',
    position: '',
    skills: null,
    experience: 0,
    about: '',
    documents: null,
    hasReferences: false,
    references: [],
    agree: false,
  },

  dataSources: {
    CITY_LIST: [
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
    ],
    GENDERS: [
      {
        value: 'male',
        label: 'Мужской',
      },
      {
        value: 'female',
        label: 'Женский',
      },
    ],
    POSITIONS: [
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
    ],
    SKILLS: [
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
    ],
    REFERENCE_LABEL: (_item: unknown, index = 0) => `#${index + 1}`,
  },

  // modules: {
  //   '../api': { submitForm: async () => ({ success: true, data: { id: 'X1' } }) },
  // },

  // http: [{ method: 'GET', url: /\/api\//, respond: { json: [] } }],

  // clock: { now: '2026-01-01T00:00:00Z', random: 0.42 },
};
