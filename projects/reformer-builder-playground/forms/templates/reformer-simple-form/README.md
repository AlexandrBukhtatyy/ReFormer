# ReformerSimpleForm

Сгенерированная форма (renderer-json). Рендерится и работает сразу на синтетических данных —
«доведение» сводится к реализации методов в ваших файлах.

## Встраивание

Скопируйте папку в `src/pages/demo/reformerSimpleForm/` и зарегистрируйте форму:

```tsx
// ── Способ 1 (рекомендуемый): через реестр форм — одна строка на регистрацию.
// Всё остальное (схема, реестр компонентов, модель, поведение) описано записью реестра
// в index.tsx (reformerSimpleFormFormEntry) — билдер перегенерирует её при изменениях.
import { getFormRegistry } from '@reformer/form-registry';
import { reformerSimpleFormFormEntry } from './pages/demo/reformerSimpleForm';

getFormRegistry().register(reformerSimpleFormFormEntry);

// Дальше форму можно смонтировать где угодно, зная только её id:
//   <FormOutlet id="reformerSimpleForm" />

// ── Способ 2: как обычную страницу, если реестр не используется.
import ReformerSimpleFormPage from './pages/demo/reformerSimpleForm';

// пункт в списке примеров:
{ id: 'reformerSimpleForm', path: '/examples/reformerSimpleForm', title: 'ReformerSimpleForm', description: '' },

// маршрут внутри <Routes>:
<Route path="/examples/reformerSimpleForm" element={<ReformerSimpleFormPage />} />
```

## Файлы

Набор — канон раскладки renderer-json (`@reformer/mcp` docs/llms/06-form-directory-layout.md §1),
плоский: без `lib/` и `components/`, запись реестра форм — в `index.tsx`.

- **Регенерируемые** (перезаписываются при повторной генерации): `form.schema.json`, `types.ts`, `model.ts`, `registry.ts`, `index.tsx`, `README.md`.
- **Ваши** (пишутся один раз, не затираются): `data-sources.ts`, `form.render.ts`, `form.behavior.ts`, `form.validation.ts`, `api.ts`.

Схема лежит в `form.schema.json` — допустимый вариант канона («схема как данные»), выбранный
ради того, чтобы форма открывалась обратно в билдере. Цена — пути `$model(...)` не проверяются на
компиляции: опечатка внутри них останется до рантайма, и никто её не поймает. Нужна проверка —
переложите схему в `form.schema.ts` литералом `defineJsonSchemaV1<ReformerSimpleFormForm>({ ... })`;
править её в билдере после этого будет нельзя.

Компоненты импортируются из `@reformer/ui-kit` — того кита, который был
активен при генерации (`ReFormer UI Kit`).

## Методы для реализации

- `api.ts` → `submitForm(values)` — отправка на реальный бэкенд (сейчас `console.info` и успех).
- `data-sources.ts` → замените синтетические опции реальными словарями или загрузчиками.
- `form.validation.ts` → допишите правила (сейчас — только `required`).
- `form.behavior.ts` → вычисляемые поля и условное включение (по желанию).
