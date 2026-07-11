---
id: core
title: '@reformer/core'
sidebar_label: 'core'
---

# @reformer/core

> Реактивное управление состоянием форм на сигналах — фундамент экосистемы ReFormer.

`@reformer/core` — базовый пакет ReFormer. В его основе архитектура **M1**: значения живут в
реактивной модели (`createModel`), форма (`createForm`) строит ноды поверх сигналов модели, одна
схема связывает конфигурацию полей (компонент, валидаторы) с сигналами, а behaviors описывают
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
import { createModel, createForm, validateFormModel } from '@reformer/core';
import { required, email } from '@reformer/core/validators';
import { Input } from '@reformer/ui-kit';

type ContactForm = { name: string; email: string };

// 1. Модель — источник истины для значений.
const model = createModel<ContactForm>({ name: '', email: '' });

// 2. Схема — связывает поле с сигналом модели (model.$.<field>) + компонент + валидаторы.
const schema = {
  name: { value: model.$.name, component: Input, validators: [required()] },
  email: { value: model.$.email, component: Input, validators: [required(), email()] },
};

// 3. Форма — ноды поверх сигналов модели.
const form = createForm<ContactForm>({ model, schema });

// 4. Валидация всей модели против схемы (ошибки роутятся в ноды для отображения).
const { valid } = await validateFormModel(model, schema);
```

## Что внутри

Пакет разбит на четыре слоя (плюс подпуть для сигнального рантайма):

| Слой             | Импорт                      | Назначение                                                                                                   |
| ---------------- | --------------------------- | ------------------------------------------------------------------------------------------------------------ |
| **Модель**       | `@reformer/core`            | `createModel` — источник истины значений; `validateModel` / `validateFormModel` — запуск валидации           |
| **Форма и ноды** | `@reformer/core`            | `createForm`, `FieldNode` / `GroupNode` / `ArrayNode`; доступ к полям через proxy `form.<field>`             |
| **Валидаторы**   | `@reformer/core/validators` | чистые фабрики `required`, `email`, `min`, `max`, `minLength`, `pattern`, `phone`, `url`, числовые и датовые |
| **Behaviors**    | `@reformer/core/behaviors`  | декларативный DSL `defineFormBehavior` + операторы `compute`, `onChange`, `enableWhen`, `copyFrom`, …        |
| **Signals**      | `@reformer/core/signals`    | единый реактивный рантайм (`signal`, `computed`, `effect`, `batch`) для интеграций                           |

**React-хуки** (`@reformer/core`): `useFormControl` (полное состояние поля), `useFormControlValue`
(значение `T` напрямую), `useArrayLength` (реактивная длина массива).

## С чего начать

1. [Философия M1](/docs/) — как устроено ядро: модель → схема → форма → behavior.
2. [Установка](../getting-started/installation) — требования и подпути пакета.
3. [Быстрый старт](../getting-started/quick-start) — первая рабочая форма за 5 минут.
4. [Основные концепции](../core-concepts/reactive-state) — реактивность, модель данных, ноды, схемы.
5. [Core API Reference](../api) — полный автогенерируемый справочник.
