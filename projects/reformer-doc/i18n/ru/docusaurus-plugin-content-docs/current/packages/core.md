---
id: core
title: '@reformer/core'
sidebar_label: 'core'
---

# @reformer/core

> Реактивное управление состоянием форм на сигналах — фундамент экосистемы ReFormer.

`@reformer/core` — базовый пакет ReFormer. В его основе архитектура **M1**: значения живут в
реактивной модели (`createModel`), форма (`createForm`) строит ноды поверх сигналов модели, а
layout-схема связывает конфигурацию полей (компонент) с сигналами. Правила валидации и behaviors —
это два отдельных ambient-слоя над той же моделью: схема валидации (`defineValidationSchema`)
описывает правила и прогоняется по требованию, а behaviors (`defineFormBehavior`) описывают
реактивную логику декларативно.

Поверх этого слоя строится вся остальная экосистема: `@reformer/cdk`, рендереры
(`renderer-react`, `renderer-json`) и `@reformer/ui-kit`. Пакет tree-shakeable и полностью
типизирован под TypeScript.

## Установка

```bash
npm install @reformer/core
```

## Минимальная форма

```typescript
import { createModel, createForm } from '@reformer/core';
import { defineValidationSchema, validate, validateModel } from '@reformer/core/validation';
import { required, email } from '@reformer/core/validators';
import { Input } from '@reformer/ui-kit';

type ContactForm = { name: string; email: string };

// 1. Модель — источник истины для значений.
const model = createModel<ContactForm>({ name: '', email: '' });

// 2. Layout-схема — связывает поле с сигналом модели (model.$.<field>) + компонент.
//    Валидаторов здесь НЕТ: раскладка и правила — разные слои.
const schema = {
  name: { value: model.$.name, component: Input },
  email: { value: model.$.email, component: Input },
};

// 3. Форма — ноды поверх сигналов модели.
const form = createForm<ContactForm>({ model, schema });

// 4. Схема валидации — отдельный ambient-слой (@reformer/core/validation): правила навешиваются
//    оператором validate(sig, [rules]) на сигналы модели, а не живут внутри layout-схемы.
const contactValidation = defineValidationSchema<ContactForm>(({ model }) => {
  validate(model.$.name, [required()]);
  validate(model.$.email, [required(), email()]);
});

// 5. Прогон по требованию (submit/шаг): раннер validateModel разносит ошибки по нодам формы для
//    отображения и возвращает true, если нет блокирующих ошибок (severity:'warning' не блокирует).
const valid: boolean = await validateModel(model, contactValidation);
```

> `createForm({ model, schema })` **не** прогоняет схему валидации сам — валидация запускается
> явным вызовом `validateModel(model, schema)` (обычно в submit-хендлере или при переходе между
> шагами wizard'а). Держите схему стабильной ссылкой (`const` / `defineValidationSchema`): по её
> идентичности раннер отменяет устаревшие прогоны.

## Что внутри

Пакет разбит на пять слоёв (плюс подпуть для сигнального рантайма):

| Слой             | Импорт                      | Назначение                                                                                                                                       |
| ---------------- | --------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Модель**       | `@reformer/core`            | `createModel` — источник истины значений; доступ к сигналам через `model.$.<field>`                                                              |
| **Форма и ноды** | `@reformer/core`            | `createForm`, `FieldNode` / `GroupNode` / `ArrayNode`; доступ к полям через proxy `form.<field>`                                                 |
| **Валидация**    | `@reformer/core/validation` | ambient-схема `defineValidationSchema` + операторы `validate`, `validateAsync`, `validateWhen`, `cross`, `each`, `apply`; раннер `validateModel` |
| **Валидаторы**   | `@reformer/core/validators` | чистые фабрики `required`, `email`, `min`, `max`, `minLength`, `pattern`, `phone`, `url`, числовые и датовые                                     |
| **Behaviors**    | `@reformer/core/behaviors`  | декларативный DSL `defineFormBehavior` + операторы `compute`, `onChange`, `enableWhen`, `copyFrom`, …                                            |
| **Signals**      | `@reformer/core/signals`    | единый реактивный рантайм (`signal`, `computed`, `effect`, `batch`) для интеграций                                                               |

**React-хуки** (`@reformer/core`): `useFormControl` (полное состояние поля), `useFormControlValue`
(значение `T` напрямую), `useArrayLength` (реактивная длина массива).

## С чего начать

1. [Философия M1](/docs/) — как устроено ядро: модель → схема → форма → behavior.
2. [Установка](../getting-started/installation) — требования и подпути пакета.
3. [Быстрый старт](../getting-started/quick-start) — первая рабочая форма за 5 минут.
4. [Основные концепции](../core-concepts/reactive-state) — реактивность, модель данных, ноды, схемы.
5. [Core API Reference](../api) — полный автогенерируемый справочник.
