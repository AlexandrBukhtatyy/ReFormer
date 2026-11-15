## Раскладка модуля

Проверка собирает форму так же, как `createForm` из `@reformer/core`, — из частей модуля в `form/`:

- `model.ts` — `export function createFormModel()`: модель формы;
- `form.schema.ts` — `export const formSchema` (на `@reformer/renderer-json` — документ
  `form.schema.json`);
- `form.validation.ts` — `export const formValidation`, если у формы есть правила;
- `form.behavior.ts` — `export const formBehavior`, если у формы есть поведение;
- `form.flow.ts` — `export const formFlow`, если форма — мастер с шагами.

`index.tsx` собирает форму из этих частей и экспортирует её компонент.
