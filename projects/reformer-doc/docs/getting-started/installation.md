---
sidebar_position: 1
---

# Установка

## Требования

- Node.js 18+
- React 18+ — только для входа `@reformer/core/react` (поддерживаются 16.8–19). `react` и
  `react-dom` — необязательные peer-зависимости: ядро без React работает на сервере и с любым UI.

## Установка пакета

```bash
npm install @reformer/core
```

Ядро тянет за собой реактивный движок
[Preact Signals Core](https://github.com/preactjs/signals) — устанавливать его отдельно не нужно.

Чаще всего вместе с ядром ставят набор готовых полей:

```bash
npm install @reformer/core @reformer/ui-kit
```

## Точки входа пакета

`@reformer/core` tree-shakeable и разбит на подпути — импортируйте только нужное:

```typescript
// Ядро: модель, форма, ноды (без React)
import { createModel, createForm } from '@reformer/core';

// React: хуки и стабильная сборка формы
import { useFormBundle, useFormControl } from '@reformer/core/react';

// Схема валидации и раннер
import { defineValidation, validate } from '@reformer/core/validation';

// Валидаторы — чистые фабрики
import { required, email, min, minLength } from '@reformer/core/validators';

// Тексты замечаний валидации
import { defineIssueMessages } from '@reformer/core/i18n';

// Behaviors — декларативный DSL
import { defineFormBehavior, compute, onChange } from '@reformer/core/behaviors';

// Signals — единый реактивный рантайм (для интеграций/продвинутых сценариев)
import { signal, computed, effect } from '@reformer/core/signals';
```

:::tip Единый рантайм сигналов
Если пишете свой пакет поверх ReFormer и работаете с сигналами напрямую — импортируйте `Signal` из
`@reformer/core/signals`, а **не** из `@preact/signals-core`. Так все `@reformer/*`-пакеты разделяют
один экземпляр рантайма и реактивность работает между ними согласованно.
:::

## Дальше

- [Быстрый старт](./quick-start) — собрать первую форму.
- [Организация проекта](../patterns/project-structure) — рекомендованная структура форм.
