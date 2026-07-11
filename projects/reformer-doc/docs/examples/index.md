---
id: index
title: Примеры
sidebar_label: Обзор
---

# Примеры

Живые примеры запускаются в песочнице [react-playground](https://stackblitz.com/~/github.com/AlexandrBukhtatyy/ReFormer/tree/main/projects/react-playground?file=projects/react-playground/src/App.tsx).
Интерактивную документацию отдельных компонентов смотрите в разделе
[@reformer/ui-kit](./packages/ui-kit) (Variants / Examples / API у каждого компонента).

## Одна форма — три подхода

Флагманский пример — многошаговая **заявка на кредит** — реализован тремя способами
на одной и той же модели. Это лучший способ понять, чем отличаются слои экосистемы.

<div className="api-grid">

<a className="api-card" href="https://stackblitz.com/~/github.com/AlexandrBukhtatyy/ReFormer/tree/main/projects/react-playground?file=projects/react-playground/src/pages/examples/complex-multy-step-form/index.tsx">
  <h3>🧱 Core + ручной JSX</h3>
  <p>createForm + FormWizard, поля выведены как &lt;FormField control={form.x} /&gt;. Максимум контроля.</p>
  <span className="api-count">/examples/complex</span>
</a>

<a className="api-card" href="https://stackblitz.com/~/github.com/AlexandrBukhtatyy/ReFormer/tree/main/projects/react-playground?file=projects/react-playground/src/pages/examples/complex-multy-step-form-renderer/index.tsx">
  <h3>🖼️ renderer-react</h3>
  <p>Та же форма из декларативной render-схемы (createRenderSchema + FormRenderer). Форма как данные.</p>
  <span className="api-count">/examples/complex-renderer</span>
</a>

<a className="api-card" href="https://stackblitz.com/~/github.com/AlexandrBukhtatyy/ReFormer/tree/main/projects/react-playground?file=projects/react-playground/src/pages/examples/complex-multy-step-form-renderer-json/index.tsx">
  <h3>📄 renderer-json</h3>
  <p>Та же форма целиком из JSON-схемы + реестр компонентов. Форма приходит данными с бэкенда.</p>
  <span className="api-count">/examples/json-renderer</span>
</a>

</div>

### Чем отличаются подходы

| Подход             | Форма описана                                  | Когда выбирать                                                                 |
| ------------------ | ---------------------------------------------- | ------------------------------------------------------------------------------ |
| **Core + JSX**     | React-кодом (`<FormField control={form.x} />`) | Нужен полный контроль над разметкой и логикой шага.                            |
| **renderer-react** | TS-схемой (`RenderSchemaFn`)                   | Форма — данные; хочется декларативности без ручного JSX на каждое поле.        |
| **renderer-json**  | JSON-схемой + реестром                         | Форма приходит с бэкенда/CMS, генерируется или конфигурируется без пересборки. |

Все три работают на одной модели M1 (`createModel`), поэтому валидация и behaviors
описываются одинаково — меняется только слой рендеринга.

## Фокусные примеры

- **Валидация** — встроенные валидаторы (`/examples/validation`).
- **Behaviors** — реактивные вычисления и условная видимость (`/examples/behaviors`).
- **Регистрация** — async-валидация + behaviors + маска телефона (`/examples/simple`).
- **MCP-сгенерированные формы** — вывод MCP-сервера для трёх слоёв
  (`/examples/mcca-core-v20`, `/examples/mcca-renderer-react-v20`, `/examples/mcca-renderer-json-v20`).
