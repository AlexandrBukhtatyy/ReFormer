/**
 * Фикстура формы: чем наполнить её в предпросмотре.
 *
 * Слои независимы — заполняйте только нужные:
 *   model        начальные значения (СТАРШЕ model.ts: фикстура пишется ради проверки)
 *   dataSources  значения $dataSource
 *   modules      подстановка импортов формы (./api, @/shared/...) — форма не пойдёт в сеть
 *   http         перехват запросов, если форма всё же зовёт fetch
 *   clock        фиксированные Date.now() и Math.random()
 */

export const fixture = {
  model: {
    lastName: '',
    firstName: '',
    fullName: '',
    city: 'msk',
    email: '',
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
  },

  // modules: {
  //   './api': { submitForm: async () => ({ success: true, data: { id: 'X1' } }) },
  // },

  // http: [{ method: 'GET', url: /\/api\//, respond: { json: [] } }],

  // clock: { now: '2026-01-01T00:00:00Z', random: 0.42 },
};
