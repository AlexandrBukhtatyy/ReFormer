---
id: index
title: Примеры
sidebar_label: Примеры
---

# Примеры

Где посмотреть ReFormer в работе: живые примеры прямо в документации, демо-стенд репозитория с
большими формами и интерактивные страницы компонентов.

## Живые примеры в документации

Работающая форма и её код в одной карточке: вкладка «Код» показывает тот же файл, что работает в
превью.

| Пример                             | Что показывает                                                     | Страница                                            |
| ---------------------------------- | ------------------------------------------------------------------ | --------------------------------------------------- |
| Форма обратной связи               | модель, схема, правила, отправка и сброс — весь путь за пять минут | [Быстрый старт](/docs/getting-started/quick-start)  |
| Регистрация с переключателем языка | `I18nProvider`, словари кита, перевод подписей и замечаний на лету | [Локализация](/docs/guides/localization)            |
| Мастер на три шага                 | поток шагов, правила шага, `FormWizard` из `@reformer/ui-kit`      | [Многошаговые формы](/docs/guides/multi-step-forms) |

Компоненты [UI Kit](/docs/ui-kit/overview) и [CDK](/docs/cdk/overview) показаны на своих
страницах: варианты, примеры и пропсы у каждого компонента.

## Демо-стенд репозитория

Большие формы и отдельные возможности собраны в приложении
[`projects/react-playground`](https://github.com/AlexandrBukhtatyy/ReFormer/tree/main/projects/react-playground).
Открыть его можно двумя способами:

- **В браузере** —
  [в StackBlitz](https://stackblitz.com/~/github.com/AlexandrBukhtatyy/ReFormer/tree/main/projects/react-playground?file=projects/react-playground/src/App.tsx),
  без установки.
- **Локально** — в корне репозитория `npm install`, затем `npm run dev`. Страницы ниже открываются
  по адресам `/demo/...` этого приложения.

### Одна форма — три способа

Флагманский пример — многошаговая заявка на кредит. Она сделана тремя способами на одной сборке
`createForm`: модель, правила, поведение и шаги общие, меняется только то, чем описана схема и кто её
рисует.

| Страница стенда          | Способ                                                                                   | Код                                                                                                                                                                                                                                                                   |
| ------------------------ | ---------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `/demo/complex`          | разметка руками: `FormWizard` и `<FormField control={form.x} />`                         | [CreditApplicationForm.tsx](https://stackblitz.com/~/github.com/AlexandrBukhtatyy/ReFormer/tree/main/projects/react-playground?file=projects/react-playground/src/pages/demo/complex-multy-step-form/CreditApplicationForm.tsx)                                       |
| `/demo/complex-renderer` | `FormRenderer` рисует форму по схеме на TypeScript                                       | [CreditApplicationFormRenderer.tsx](https://stackblitz.com/~/github.com/AlexandrBukhtatyy/ReFormer/tree/main/projects/react-playground?file=projects/react-playground/src/pages/demo/complex-multy-step-form-renderer/CreditApplicationFormRenderer.tsx)              |
| `/demo/json-renderer`    | схема — JSON-документ и реестр компонентов                                               | [CreditApplicationFormRendererJson.tsx](https://stackblitz.com/~/github.com/AlexandrBukhtatyy/ReFormer/tree/main/projects/react-playground?file=projects/react-playground/src/pages/demo/complex-multy-step-form-renderer-json/CreditApplicationFormRendererJson.tsx) |
| `/demo/form-registry`    | тот же JSON-документ, форма подключена по идентификатору через `@reformer/form-registry` | —                                                                                                                                                                                                                                                                     |

Какой способ выбрать:

| Способ          | Форма описана                                  | Когда выбирать                                                          |
| --------------- | ---------------------------------------------- | ----------------------------------------------------------------------- |
| разметка руками | React-кодом (`<FormField control={form.x} />`) | нужен полный контроль над разметкой шага                                |
| renderer-react  | схемой на TypeScript (`(model) => узел`)       | форма — данные, а писать JSX на каждое поле не хочется                  |
| renderer-json   | JSON-документом и реестром                     | форма приходит с сервера или из CMS, меняется без пересборки приложения |

Подробно о рендерерах — [@reformer/renderer-react](/docs/packages/renderer-react) и
[@reformer/renderer-json](/docs/packages/renderer-json). Раскладка примера по файлам разобрана в
[Структуре проекта](/docs/patterns/project-structure).

### Остальные страницы стенда

| Адрес                      | Что показывает                                                                               |
| -------------------------- | -------------------------------------------------------------------------------------------- |
| `/demo/validation`         | встроенные правила валидации                                                                 |
| `/demo/behaviors`          | поведение формы: вычисляемые поля, условная доступность                                      |
| `/demo/simple`             | регистрация: async-проверка, поведение, маска телефона                                       |
| `/demo/file-upload`        | загрузка файлов: кнопка, область перетаскивания, поле, аватар                                |
| `/demo/multi-select`       | множественный выбор: `SelectMulti`, `ComboboxMulti`, `NativeSelectMulti`, `ToggleGroupMulti` |
| `/demo/date-picker`        | выбор дат: одна дата, период, несколько дат                                                  |
| `/demo/input-suggest`      | свободный ввод со списком подсказок (`InputSuggest`)                                         |
| `/demo/field-tooltips`     | подсказки-иконки у подписи и в самом контроле                                                |
| `/demo/tree`               | дерево и выбор файла из дерева                                                               |
| `/demo/imperative-handles` | управление живыми компонентами по селектору узла                                             |
| `/demo/html-nodes`         | нативные теги и текст прямо в схеме                                                          |
| `/demo/registration-json`  | экран целиком из JSON: загрузка данных, провайдер и рендерер                                 |
| `/demo/alerts-json`        | список из массива модели в JSON-документе (`$component(List)`)                               |

Тесты этих страниц на Playwright — в
[`projects/react-playground-e2e`](https://github.com/AlexandrBukhtatyy/ReFormer/tree/main/projects/react-playground-e2e):
пример того, как проверять формы в браузере (см. [Тестирование форм](/docs/guides/testing)).

## Билдер

Визуальный конструктор форм открывается из меню сайта — пункт [Builder](pathname:///builder/).

## ИИ-ассистент

Как сгенерировать форму через MCP-сервер `@reformer/mcp` — на странице
[Примеры MCP](/docs/mcp/examples).
