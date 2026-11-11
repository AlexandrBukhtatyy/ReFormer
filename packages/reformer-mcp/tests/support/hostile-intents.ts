/**
 * Входы intent, на которых сервер когда-то падал внутренней ошибкой (`-32603`). Сборка обязана
 * отвечать на них диагностикой: тесты чтения и сборки (`generate-form.test.ts`) и `form_build`
 * целиком (`form-build.test.ts`).
 */
export const HOSTILE_INTENTS: unknown[] = [
  {},
  42,
  [1, 2],
  { fields: 'нет' },
  { fields: [null, 7] },
  { fields: [{ name: 'a' }], arrays: [{ name: 'a' }] },
  { fields: [{ name: 'a', type: 'string', component: 'Input' }], layout: { kind: 'bogus' } },
  { fields: { a: { type: 'nonsense' } }, behavior: 'нет', visibility: [42], dataSources: [7] },
  { steps: 'первый', wizard: { steps: [{}] } },
];
