# Test04Break

Сгенерированная форма (renderer-json). Рендерится и работает сразу на синтетических данных —
«доведение» сводится к реализации методов в ваших файлах.

## Встраивание

Скопируйте папку в `src/pages/demo/test04Break/` и зарегистрируйте форму:

```tsx
// ── Способ 1 (рекомендуемый): через реестр форм — одна строка на регистрацию.
// Всё остальное (схема, реестр компонентов, модель, поведение) описано записью реестра
// в index.tsx (test04BreakFormEntry) — билдер перегенерирует её при изменениях.
import { getFormRegistry } from '@reformer/form-registry';
import { test04BreakFormEntry } from './pages/demo/test04Break';

getFormRegistry().register(test04BreakFormEntry);

// Дальше форму можно смонтировать где угодно, зная только её id:
//   <FormOutlet id="test04Break" />

// ── Способ 2: как обычную страницу, если реестр не используется.
import Test04BreakPage from './pages/demo/test04Break';

// пункт в списке примеров:
{ id: 'test04Break', path: '/examples/test04Break', title: 'Test04Break', description: '' },

// маршрут внутри <Routes>:
<Route path="/examples/test04Break" element={<Test04BreakPage />} />
```

## Файлы

Набор — канон раскладки renderer-json (`@reformer/mcp` docs/llms/06-form-directory-layout.md §1),
плоский: без `lib/` и `components/steps/`, запись реестра форм — в `index.tsx`.

- **Регенерируемые** (перезаписываются при повторной генерации): `renderer.schema.json`, `types.ts`, `model.ts`, `registry.ts`, `index.tsx`, `README.md`.
- **Ваши** (пишутся один раз, не затираются): `data-sources.ts`, `renderer.behavior.ts`, `form.behavior.ts`, `validation.ts`, `api.ts`.

Схема лежит в `renderer.schema.json` — допустимый вариант канона («схема как данные»), выбранный
ради того, чтобы форма открывалась обратно в билдере. Цена — пути `$model(...)` не проверяются на
компиляции: опечатка внутри них останется до рантайма, и никто её не поймает. Нужна проверка —
переложите схему в `renderer.schema.ts` литералом `defineJsonSchema<Test04BreakForm>({ ... })`;
править её в билдере после этого будет нельзя.

Компоненты импортируются из `@reformer/ui-kit` — того кита, который был
активен при генерации (`ReFormer UI Kit`).

## Методы для реализации

- `api.ts` → `submitForm(values)` — отправка на реальный бэкенд (сейчас `console.info` и успех).
- `data-sources.ts` → замените синтетические опции реальными словарями или загрузчиками.
- `validation.ts` → допишите правила (сейчас — только `required`).
- `form.behavior.ts` → вычисляемые поля и условное включение (по желанию).
