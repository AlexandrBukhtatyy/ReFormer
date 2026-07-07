---
sidebar_position: 1
---

# Реактивность и сигналы

ReFormer построен на [сигналах](https://github.com/preactjs/signals) — они дают
**точечную (fine-grained) реактивность**: при изменении значения перерисовываются только те
компоненты, которые это значение читают.

## Что такое сигнал

Сигнал — это ячейка значения, на которую можно подписаться. Прочитал внутри реактивного контекста —
подписался; записал — все подписчики пересчитались.

```typescript
import { signal, computed, effect } from '@reformer/core/signals';

const count = signal(0);
const double = computed(() => count.value * 2); // зависит от count

effect(() => {
  console.log('count =', count.value, 'double =', double.value);
});
// сразу логирует: count = 0 double = 0

count.value = 5; // логирует: count = 5 double = 10
```

:::warning Импортируйте рантайм из `@reformer/core/signals`
Для работы с сигналами напрямую берите `signal` / `computed` / `effect` / `batch` из
`@reformer/core/signals`, а **не** из `@preact/signals-core` или `@preact/signals-react`. Это
гарантирует, что все `@reformer/*`-пакеты используют один экземпляр рантайма и реактивность работает
между ними согласованно.
:::

## Сигналы в форме

В архитектуре M1 сигналы — это «провода», по которым связаны модель и форма:

- **Значения** живут в модели. `model.$.field` — сигнал значения поля (см.
  [Модель данных](./model)).
- **Состояние ноды** (`value`, `valid`, `invalid`, `errors`, `touched`, `dirty`, `disabled`,
  `pending`) — тоже сигналы, вычисляемые формой поверх сигналов модели (см. [Ноды](./nodes)).

```typescript
import { createModel } from '@reformer/core';
import { effect } from '@reformer/core/signals';

const model = createModel<{ name: string }>({ name: '' });

// model.$.name — сигнал значения
effect(() => {
  console.log('name изменилось:', model.$.name.value);
});

model.name = 'John'; // логирует: name изменилось: John
model.name = 'Jane'; // логирует: name изменилось: Jane
```

## Реактивность в React

В компонентах **не подписывайтесь через `effect` вручную** — используйте хуки. Они построены на
`useSyncExternalStore` и корректно интегрированы с React 18+:

```tsx
import { useFormControl, useFormControlValue } from '@reformer/core';

// Полное состояние поля — ре-рендер при изменении любого его сигнала
function NameField({ control }) {
  const { value, errors, shouldShowError } = useFormControl(control);
  // ...
}

// Только значение — ре-рендер лишь при изменении value (оптимизация)
function Greeting({ control }) {
  const name = useFormControlValue(control);
  return <span>Привет, {name}</span>;
}
```

Благодаря точечной реактивности соседние поля не перерисовывают друг друга: меняется `name` —
ре-рендерится только компонент, читающий `name`.

## Дальше

- [Модель данных](./model) — где живут значения и как их читать/писать.
- [Ноды и proxy](./nodes) — из чего состоит форма.
- [React-хуки](../react/hooks) — `useFormControl`, `useFormControlValue`, `useArrayLength`.
