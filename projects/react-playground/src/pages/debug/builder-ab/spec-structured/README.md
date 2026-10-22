# Credit application

Сгенерированная форма (renderer-json, единая сборка `createForm`). Рендерится и работает сразу на
синтетических данных — «доведение» сводится к реализации методов в ваших файлах.

## Встраивание

Скопируйте папку в `src/pages/demo/credit-application/` и зарегистрируйте форму:

```tsx
// ── Способ 1 (рекомендуемый): через реестр форм — одна строка на регистрацию.
// Всё остальное (схема, реестр компонентов, модель, поведение, валидация) описано записью
// реестра (creditApplicationFormEntry, application/entry.ts модуля) — билдер перегенерирует
// её при изменениях.
import { getFormRegistry } from '@reformer/form-registry';
import { creditApplicationFormEntry } from './pages/demo/credit-application';

getFormRegistry().register(creditApplicationFormEntry);

// Дальше форму можно смонтировать где угодно, зная только её id:
//   <FormOutlet id="credit-application" />

// ── Способ 2: как обычную страницу, если реестр не используется.
// Страница — default-экспорт модуля (index.ts).
import CreditApplicationForm from './pages/demo/credit-application';

// пункт в списке примеров:
{ id: 'credit-application', path: '/examples/credit-application', title: 'Credit application', description: '' },

// маршрут внутри <Routes>:
<Route path="/examples/credit-application" element={<CreditApplicationForm />} />
```

## Файлы

Раскладка — папки по ролям (канон `@reformer/mcp` docs/llms/06-form-directory-layout.md §3):
сборка формы одна (`application/create.ts`), ею пользуются и страница, и запись реестра форм.

```
credit-application/
├── CreditApplicationForm.tsx   страница: сборка формы → FormRenderer
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
│   ├── form.ts   валидация формы: правила вне шагов и стратегия проверки
│   ├── messages.ts   тексты замечаний — словарь формы
│   ├── osnovnaya-informatsiya-o-kredite.ts   правила шага «Основная информация о кредите»
│   ├── personalnye-dannye.ts   правила шага «Персональные данные»
│   ├── kontaktnaya-informatsiya.ts   правила шага «Контактная информация»
│   ├── informatsiya-o-zanyatosti.ts   правила шага «Информация о занятости»
│   ├── dopolnitelnaya-informatsiya.ts   правила шага «Дополнительная информация»
│   └── podtverzhdenie-i-soglasiya.ts   правила шага «Подтверждение и согласия»
├── behavior/
│   └── index.ts   единственное поведение: связи над моделью и правила узлов схемы
├── flow/
│   └── credit-application-flow.ts   поток шагов: порядок шагов и их правила
├── types/
│   └── credit-application.ts   тип формы
└── constants/
    └── credit-application.ts   опции и константы источников данных
```

Файл правил шага назван по его заголовку. Порядок шагов задаёт поток (`flow/credit-application-flow.ts`), поэтому
перестановка шагов файлы не трогает. Переименование шага даёт новый файл правил, а старый остаётся
с вашими правками — перенесите их и удалите его.

- **Регенерируемые** (перезаписываются при повторной генерации): `schema/form.schema.json`, `types/credit-application.ts`, `model/initial-value.ts`, `model/model.ts`, `schema/registry.ts`, `application/create.ts`, `application/entry.ts`, `CreditApplicationForm.tsx`, `index.ts`, `flow/credit-application-flow.ts`, `README.md`.
- **Ваши** (пишутся один раз, не затираются): `constants/credit-application.ts`, `behavior/index.ts`, `validation/form.ts`, `validation/messages.ts`, `validation/osnovnaya-informatsiya-o-kredite.ts`, `validation/personalnye-dannye.ts`, `validation/kontaktnaya-informatsiya.ts`, `validation/informatsiya-o-zanyatosti.ts`, `validation/dopolnitelnaya-informatsiya.ts`, `validation/podtverzhdenie-i-soglasiya.ts`, `application/submit.ts`, `api/index.ts`.

Из ваших файлов билдер перегенерирует только те, что выводятся из правил формы (валидация и
поведение), и только пока вы их не правили: правленный файл он не трогает и говорит об этом.

Схема лежит в `schema/form.schema.json` — допустимый вариант канона («схема как данные»), выбранный
ради того, чтобы форма открывалась обратно в билдере. Цена — пути `$model(...)` не проверяются на
компиляции: опечатка внутри них останется до рантайма, и никто её не поймает. Нужна проверка —
переложите схему в `.ts` литералом `defineJsonSchema<CreditApplicationForm>({ ... })`; править её в
билдере после этого будет нельзя.

Компоненты импортируются из `@reformer/ui-kit` — того кита, который был
активен при генерации (`ReFormer UI Kit`).

Тексты замечаний — словарь `formMessages` (`validation/messages.ts`): страница подключает его
провайдером `ValidationMessagesProvider`. Там же — язык формы `formLocale` (русская локаль): его
страница задаёт форме своим `I18nProvider`, и склонения, единицы размера и подписи кита — по-русски
при любой локали приложения. Уберите язык из словаря — и форма заговорит языком приложения. Запись реестра форм
ни словаря, ни языка не несёт — при монтировании через `FormOutlet` оба провайдера ставит хост.

## Методы для реализации

- `api/index.ts` → `submitForm(values)` — отправка на реальный бэкенд (сейчас `console.info` и успех).
- `application/submit.ts` → тексты исхода и то, что делать после отправки (сейчас — два сообщения через `onResult`).
- `behavior/index.ts` → раскомментируйте `hideWhen` для секций: `osnovnaya-informatsiya-o-kredite-section`, `personalnye-dannye-section`, `kontaktnaya-informatsiya-section`, `informatsiya-o-zanyatosti-section`, `dopolnitelnaya-informatsiya-section`, `podtverzhdenie-i-soglasiya-section`.
- `validation/<шаг>.ts` → допишите правила (сейчас — только `required` из схемы либо правила формы).
- `validation/messages.ts` → тексты замечаний под свою форму: свой код правилу и запись под ним.
- `behavior/index.ts` → вычисляемые поля и условное включение (по желанию).
