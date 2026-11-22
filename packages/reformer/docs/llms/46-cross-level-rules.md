# Правила между уровнями — defineBehavior, signalFrom

## Purpose

Уровни UI (форма, тема, язык, таблица) не знают друг о друге. Их связывают модель приложения и
правила:

1. **Привязка к полю модели — первый выбор.** Тема и язык над `app.$.settings.*`, таблица над
   `app.$.users`: форма пишет поле, уровень читает тот же сигнал. Правило не нужно.
2. **`computed`** — чтение между уровнями: `locale: () => language.code.value` у таблицы.
3. **`defineBehavior`** из `@reformer/core/model` — побочный эффект или запись в чужой уровень:
   «сменился язык — перезапросить серверную таблицу», «таблица — в адресной строке».

`signalFrom(read, subscribe)` превращает событийный источник (`getState`/`subscribe`, события
DOM) в сигнал только для чтения — так внешнее состояние входит в модель уровней.

## API

```typescript
defineBehavior<Ctx>(setup: (ctx: Ctx, scope: Scope) => void, options?: { name?: string }): {
  name: string | undefined;
  attach(ctx: Ctx): () => void; // отписка; внутри createStore — снимается со стором
};

signalFrom<T>(read: () => T, subscribe: (onChange) => (() => void) | { dispose(): void }): ReadonlySignal<T>;
```

## Examples

### Язык → серверная таблица

```typescript
import { defineBehavior, watchField } from '@reformer/core/model';

export const reloadOnLanguage = defineBehavior<{ language: Language; table: Table<Order> }>(
  ({ language, table }) => {
    watchField(language.code, () => table.reload());
  },
  { name: 'reloadOnLanguage' }
);

const app = createStore(() => {
  const language = createLanguage({ load });
  const orders = createTable({ dataProvider, columns });
  reloadOnLanguage.attach({ language, table: orders });
  return { language, orders };
});
```

### Таблица в адресной строке

```typescript
export const tableInUrl = defineBehavior<{ table: Table<unknown>; param: string }>(
  ({ table, param }, scope) => {
    scope.effect(() => {
      const url = new URL(window.location.href);
      url.searchParams.set(param, JSON.stringify(table.query.value));
      window.history.replaceState(null, '', url);
    });
  }
);
```

## Anti-patterns

### Правило там, где хватает привязки

```typescript
// ❌ watchField(app.$.settings.theme, (t) => theme.set(t))
// ✅ createTheme({ preference: app.$.settings.theme })
```

### Эффект вне области

```typescript
// ❌ effect(() => …) в модуле — снять некому
// ✅ defineBehavior(...).attach(ctx) внутри createStore — снимется со стором
```

## See also

- `40-app-state-store.md`, `43-ui-theme.md`, `44-ui-language.md`, `45-data-table.md`.
