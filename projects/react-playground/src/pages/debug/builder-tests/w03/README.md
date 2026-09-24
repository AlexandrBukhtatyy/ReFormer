# W03

Сгенерированная форма (renderer-json). Рендерится и работает сразу на синтетических данных —
«доведение» сводится к реализации методов в ваших файлах.

## Встраивание

Скопируйте папку в `src/pages/demo/w03/` и зарегистрируйте форму:

```tsx
// ── Способ 1 (рекомендуемый): через реестр форм — одна строка на регистрацию.
// Всё остальное (схема, реестр компонентов, модель, поведение) описано записью реестра
// в index.tsx (w03FormEntry) — билдер перегенерирует её при изменениях.
import { getFormRegistry } from '@reformer/form-registry';
import { w03FormEntry } from './pages/demo/w03';

getFormRegistry().register(w03FormEntry);

// Дальше форму можно смонтировать где угодно, зная только её id:
//   <FormOutlet id="w03" />

// ── Способ 2: как обычную страницу, если реестр не используется.
import W03Page from './pages/demo/w03';

// пункт в списке примеров:
{ id: 'w03', path: '/examples/w03', title: 'W03', description: '' },

// маршрут внутри <Routes>:
<Route path="/examples/w03" element={<W03Page />} />
```

## Файлы

Набор — канон раскладки renderer-json (`@reformer/mcp` docs/llms/06-form-directory-layout.md §1)
для многошаговой формы: общее — в корне, код каждого шага — в своей папке `steps/<шаг>/`.

```
w03/
├── form.schema.json   схема формы целиком (её открывает билдер)
├── form.validation.ts   сборка правил шагов + поля вне шагов
├── form.render.ts   submit, передача визарду формы и проверки, вызов шагов
└── steps/
    ├── index.ts   шаги по порядку (регенерируется)
    ├── dannye/   «Данные»: form.validation.ts, form.render.ts
    └── kontakty/   «Контакты»: form.validation.ts, form.render.ts
```

Папка шага названа по его заголовку. Порядок шагов задаёт `steps/index.ts`, поэтому перестановка
шагов папки не трогает. Переименование шага даёт новую папку, а старая остаётся с вашими правками —
перенесите их и удалите её.

- **Регенерируемые** (перезаписываются при повторной генерации): `form.schema.json`, `types.ts`, `model.ts`, `registry.ts`, `index.tsx`, `wizard.tsx`, `steps/index.ts`, `README.md`.
- **Ваши** (пишутся один раз, не затираются): `data-sources.ts`, `form.render.ts`, `steps/dannye/form.render.ts`, `steps/kontakty/form.render.ts`, `form.behavior.ts`, `form.validation.ts`, `steps/dannye/form.validation.ts`, `steps/kontakty/form.validation.ts`, `api.ts`.

Схема лежит в `form.schema.json` — допустимый вариант канона («схема как данные»), выбранный
ради того, чтобы форма открывалась обратно в билдере. Цена — пути `$model(...)` не проверяются на
компиляции: опечатка внутри них останется до рантайма, и никто её не поймает. Нужна проверка —
переложите схему в `form.schema.ts` литералом `defineJsonSchema<W03Form>({ ... })`;
править её в билдере после этого будет нельзя.

Компоненты импортируются из `@reformer/ui-kit` — того кита, который был
активен при генерации (`ReFormer UI Kit`).

## Методы для реализации

- `api.ts` → `submitForm(values)` — отправка на реальный бэкенд (сейчас `console.info` и успех).
- `steps/<шаг>/form.render.ts` → раскомментируйте `hideWhen` для секций: `dannye-section`, `kontakty-section`.
- `data-sources.ts` → замените синтетические опции реальными словарями или загрузчиками.
- `steps/<шаг>/form.validation.ts` → допишите правила (сейчас — только `required`).
- `form.behavior.ts` → вычисляемые поля и условное включение (по желанию).
