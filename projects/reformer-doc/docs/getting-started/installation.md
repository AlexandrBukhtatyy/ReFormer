---
sidebar_position: 1
---

# Установка

## Требования

- Node.js 18+
- React 18+ (для React-биндингов; поддерживаются 16.8–19)

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
// Ядро: модель, форма, ноды, хуки
import { createModel, createForm, useFormControl } from '@reformer/core';

// Валидаторы — чистые фабрики
import { required, email, min, minLength } from '@reformer/core/validators';

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
