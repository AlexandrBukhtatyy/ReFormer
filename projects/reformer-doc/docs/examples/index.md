---
id: index
title: Примеры
sidebar_label: Обзор
---

# Примеры

Живые примеры запускаются в песочнице [react-playground](https://stackblitz.com/~/github.com/AlexandrBukhtatyy/ReFormer/tree/main/projects/react-playground?file=projects/react-playground/src/App.tsx).
Интерактивную документацию отдельных компонентов смотрите в разделе
[@reformer/ui-kit](/docs/ui-kit/overview) (Variants / Examples / API у каждого компонента).

## Одна форма — три подхода

Флагманский пример — многошаговая **заявка на кредит** — реализован тремя способами
на одной и той же сборке `createForm`. Это лучший способ понять, чем отличаются слои экосистемы.

<div className="api-grid">

<a className="api-card" href="https://stackblitz.com/~/github.com/AlexandrBukhtatyy/ReFormer/tree/main/projects/react-playground?file=projects/react-playground/src/pages/demo/complex-multy-step-form/CreditApplicationForm.tsx">
  <h3>🧱 Core + ручной JSX</h3>
  <p>createForm + FormWizard, поля выведены как &lt;FormField control={form.x} /&gt;. Максимум контроля.</p>
  <span className="api-count">/demo/complex</span>
</a>

<a className="api-card" href="https://stackblitz.com/~/github.com/AlexandrBukhtatyy/ReFormer/tree/main/projects/react-playground?file=projects/react-playground/src/pages/demo/complex-multy-step-form-renderer/CreditApplicationFormRenderer.tsx">
  <h3>🖼️ renderer-react</h3>
  <p>Та же сборка, форму рисует FormRenderer по дереву схемы. Форма как данные.</p>
  <span className="api-count">/demo/complex-renderer</span>
</a>

<a className="api-card" href="https://stackblitz.com/~/github.com/AlexandrBukhtatyy/ReFormer/tree/main/projects/react-playground?file=projects/react-playground/src/pages/demo/complex-multy-step-form-renderer-json/CreditApplicationFormRendererJson.tsx">
  <h3>📄 renderer-json</h3>
  <p>Та же сборка, схема — документ JSON + реестр компонентов. Форма приходит данными с бэкенда.</p>
  <span className="api-count">/demo/json-renderer</span>
</a>

</div>

### Чем отличаются подходы

| Подход             | Форма описана                                  | Когда выбирать                                                                 |
| ------------------ | ---------------------------------------------- | ------------------------------------------------------------------------------ |
| **Core + JSX**     | React-кодом (`<FormField control={form.x} />`) | Нужен полный контроль над разметкой и логикой шага.                            |
| **renderer-react** | TS-схемой (`(model) => FormSchemaNode`)        | Форма — данные; хочется декларативности без ручного JSX на каждое поле.        |
| **renderer-json**  | JSON-документом + реестром                     | Форма приходит с бэкенда/CMS, генерируется или конфигурируется без пересборки. |

Все три собираются одним `createForm` (`application/create.ts` примера): модель, правила, поведение и
поток шагов общие — меняется только то, чем описана схема и кто её рисует. Раскладка примера по
папкам разобрана в [Структуре проекта](/docs/patterns/project-structure#масштабирование-папки).

## Фокусные примеры

- **Валидация** — встроенные валидаторы (`/demo/validation`).
- **Behaviors** — реактивные вычисления и условная видимость (`/demo/behaviors`).
- **Регистрация** — async-валидация + behaviors + маска телефона (`/demo/simple`).
- **Реестр форм** — та же JSON-форма заявки, смонтированная по id через `@reformer/form-registry`
  (`/demo/form-registry`).
