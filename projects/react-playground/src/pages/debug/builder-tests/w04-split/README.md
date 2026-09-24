# W04 split

Сгенерированная форма (renderer-json). Рендерится и работает сразу на синтетических данных —
«доведение» сводится к реализации методов в ваших файлах.

## Встраивание

Скопируйте папку в `src/pages/demo/w04-split/` и зарегистрируйте форму:

```tsx
// ── Способ 1 (рекомендуемый): через реестр форм — одна строка на регистрацию.
// Всё остальное (схема, реестр компонентов, модель, поведение) описано записью реестра
// в index.tsx (w04SplitFormEntry) — билдер перегенерирует её при изменениях.
import { getFormRegistry } from '@reformer/form-registry';
import { w04SplitFormEntry } from './pages/demo/w04-split';

getFormRegistry().register(w04SplitFormEntry);

// Дальше форму можно смонтировать где угодно, зная только её id:
//   <FormOutlet id="w04-split" />

// ── Способ 2: как обычную страницу, если реестр не используется.
import W04SplitPage from './pages/demo/w04-split';

// пункт в списке примеров:
{ id: 'w04-split', path: '/examples/w04-split', title: 'W04 split', description: '' },

// маршрут внутри <Routes>:
<Route path="/examples/w04-split" element={<W04SplitPage />} />
```

## Файлы

Набор — канон раскладки renderer-json (`@reformer/mcp` docs/llms/06-form-directory-layout.md §1)
для многошаговой формы: общее — в корне, код каждого шага — в своей папке `steps/<шаг>/`.

```
w04-split/
├── form.schema.json   схема формы, шаги — ссылками на свои файлы
├── form.validation.ts   сборка правил шагов + поля вне шагов
├── form.render.ts   submit, передача визарду формы и проверки, вызов шагов
└── steps/
    ├── index.ts   шаги по порядку (регенерируется)
    ├── dannye/   «Данные»: form.schema.json, form.validation.ts, form.render.ts
    └── kontakty/   «Контакты»: form.schema.json, form.validation.ts, form.render.ts
```

Схема разбита по шагам: корень держит `{ "$ref": "./steps/<шаг>/form.schema.json" }`, `index.tsx`
собирает форму `composeJsonFormSchema`. Билдер открывает корень как одну форму и раскладывает правки
по файлам сам. Папка шага закреплена ссылкой: переименование шага её не меняет.

- **Регенерируемые** (перезаписываются при повторной генерации): `form.schema.json`, `steps/dannye/form.schema.json`, `steps/kontakty/form.schema.json`, `types.ts`, `model.ts`, `registry.ts`, `index.tsx`, `wizard.tsx`, `steps/index.ts`, `README.md`.
- **Ваши** (пишутся один раз, не затираются): `data-sources.ts`, `form.render.ts`, `steps/dannye/form.render.ts`, `steps/kontakty/form.render.ts`, `form.behavior.ts`, `form.validation.ts`, `steps/dannye/form.validation.ts`, `steps/kontakty/form.validation.ts`, `api.ts`.

Схема лежит в `form.schema.json` — допустимый вариант канона («схема как данные»), выбранный
ради того, чтобы форма открывалась обратно в билдере. Цена — пути `$model(...)` не проверяются на
компиляции: опечатка внутри них останется до рантайма, и никто её не поймает. Нужна проверка —
переложите схему в `form.schema.ts` литералом `defineJsonSchema<W04SplitForm>({ ... })`;
править её в билдере после этого будет нельзя.

Компоненты импортируются из `@reformer/ui-kit` — того кита, который был
активен при генерации (`ReFormer UI Kit`).

## Методы для реализации

- `api.ts` → `submitForm(values)` — отправка на реальный бэкенд (сейчас `console.info` и успех).
- `steps/<шаг>/form.render.ts` → раскомментируйте `hideWhen` для секций: `dannye-section`, `kontakty-section`.
- `data-sources.ts` → замените синтетические опции реальными словарями или загрузчиками.
- `steps/<шаг>/form.validation.ts` → допишите правила (сейчас — только `required`).
- `form.behavior.ts` → вычисляемые поля и условное включение (по желанию).
