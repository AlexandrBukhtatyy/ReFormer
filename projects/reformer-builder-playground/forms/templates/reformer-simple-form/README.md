# Reformer simple form

Сгенерированная форма (renderer-json, единая сборка `createForm`). Рендерится и работает сразу на
синтетических данных — «доведение» сводится к реализации методов в ваших файлах.

## Встраивание

Скопируйте папку в `src/pages/demo/reformer-simple-form/` и зарегистрируйте форму:

```tsx
// ── Способ 1 (рекомендуемый): через реестр форм — одна строка на регистрацию.
// Всё остальное (схема, реестр компонентов, модель, поведение, валидация) описано записью
// реестра (reformerSimpleFormEntry, application/entry.ts модуля) — билдер перегенерирует
// её при изменениях.
import { getFormRegistry } from '@reformer/form-registry';
import { reformerSimpleFormEntry } from './pages/demo/reformer-simple-form';

getFormRegistry().register(reformerSimpleFormEntry);

// Дальше форму можно смонтировать где угодно, зная только её id:
//   <FormOutlet id="reformer-simple-form" />

// ── Способ 2: как обычную страницу, если реестр не используется.
// Страница — default-экспорт модуля (index.ts).
import ReformerSimpleForm from './pages/demo/reformer-simple-form';

// пункт в списке примеров:
{ id: 'reformer-simple-form', path: '/examples/reformer-simple-form', title: 'Reformer simple form', description: '' },

// маршрут внутри <Routes>:
<Route path="/examples/reformer-simple-form" element={<ReformerSimpleForm />} />
```

## Файлы

Раскладка — папки по ролям (канон `@reformer/mcp` docs/llms/06-form-directory-layout.md §3):
сборка формы одна (`application/create.ts`), ею пользуются и страница, и запись реестра форм.

```
reformer-simple-form/
├── ReformerSimpleForm.tsx   страница: сборка формы → FormRenderer
├── index.ts   реэкспорты: страница, сборка, запись реестра форм, тип формы
├── README.md
├── application/
│   ├── create.ts   единственная сборка формы: createForm({ … })
│   ├── submit.ts   отправка: запрос → исход → текст для человека
│   └── entry.ts   запись реестра форм
├── api/
│   └── index.ts   запросы к серверу
├── model/
│   ├── initial-value.ts   начальные значения
│   └── model.ts   фабрика модели
├── schema/
│   ├── form.schema.json   документ формы (его открывает билдер)
│   └── registry.ts   реестр компонентов и источников данных
├── validation/
│   ├── form.ts   валидация формы: правила и стратегия проверки
│   └── messages.ts   тексты замечаний — словарь формы
├── behavior/
│   └── index.ts   единственное поведение: связи над моделью и правила узлов схемы
├── types/
│   └── reformer-simple-form.ts   тип формы
└── constants/
    └── reformer-simple-form.ts   опции и константы источников данных
```

- **Регенерируемые** (перезаписываются при повторной генерации): `schema/form.schema.json`, `types/reformer-simple-form.ts`, `model/initial-value.ts`, `model/model.ts`, `schema/registry.ts`, `application/create.ts`, `application/entry.ts`, `ReformerSimpleForm.tsx`, `index.ts`, `README.md`.
- **Ваши** (пишутся один раз, не затираются): `constants/reformer-simple-form.ts`, `behavior/index.ts`, `validation/form.ts`, `validation/messages.ts`, `application/submit.ts`, `api/index.ts`.

Из ваших файлов билдер перегенерирует только те, что выводятся из правил формы (валидация и
поведение), и только пока вы их не правили: правленный файл он не трогает и говорит об этом.

Схема лежит в `schema/form.schema.json` — допустимый вариант канона («схема как данные»), выбранный
ради того, чтобы форма открывалась обратно в билдере. Цена — пути `$model(...)` не проверяются на
компиляции: опечатка внутри них останется до рантайма, и никто её не поймает. Нужна проверка —
переложите схему в `.ts` литералом `defineJsonSchema<ReformerSimpleForm>({ ... })`; править её в
билдере после этого будет нельзя.

Компоненты импортируются из `@reformer/ui-kit` — того кита, который был
активен при генерации (`ReFormer UI Kit`).

Тексты замечаний — словарь `formMessages` (`validation/messages.ts`): страница подключает его
провайдером `ValidationMessagesProvider`. Запись реестра форм словарь не несёт — при монтировании
через `FormOutlet` провайдер со словарём ставит хост.

## Методы для реализации

- `api/index.ts` → `submitForm(values)` — отправка на реальный бэкенд (сейчас `console.info` и успех).
- `application/submit.ts` → тексты исхода и то, что делать после отправки (сейчас — два сообщения через `onResult`).
- `behavior/index.ts` → раскомментируйте `hideWhen` для секций: `personal-section`, `contacts-section`, `extra-section`.
- `constants/reformer-simple-form.ts` → подписи элементов массивов: `REFERENCE_LABEL`.
- `constants/reformer-simple-form.ts` → замените синтетические опции реальными словарями или загрузчиками.
- `validation/form.ts` → допишите правила (сейчас — только `required` из схемы либо правила формы).
- `validation/messages.ts` → тексты замечаний под свою форму: свой код правилу и запись под ним.
- `behavior/index.ts` → вычисляемые поля и условное включение (по желанию).
