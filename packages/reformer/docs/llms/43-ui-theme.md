# Уровень темы — createTheme

## Purpose

`createTheme` из `@reformer/core/theme` — уровень UI над моделью приложения: выбор пользователя
(`light | dark | system`), тема системы и действующая тема — сигналами. Каждая смена действующей
темы применяется к корню документа тем же маркером, что читают стили `@reformer/ui-kit`
(класс `dark` или `data-theme`).

- Главный путь — привязка к полю модели: `createTheme({ preference: app.$.settings.theme })`.
  Форма настроек над `app.settings` меняет тему без всякого клея.
- DOM, `matchMedia` и `localStorage` — только через адаптеры: на сервере и в тестах уровень
  работает без них.

## API

```typescript
createTheme({
  preference?: Signal<ThemePreference>, // поле модели
  initial?: ThemePreference, // 'system'
  system?: SystemThemeSource | null, // mediaQuerySystemTheme(); null — светлая
  target?: ThemeTarget | null, // documentTheme(); null — DOM не трогать
  storage?: StorageAdapter | null, // webStorage()
  storageKey?: string, // 'reformer.theme'
}): Theme; // preference, system, resolved, set, toggle, dispose

documentTheme({ root?, attribute?: 'class' | 'data-theme', colorScheme?: boolean });
mediaQuerySystemTheme(); fixedSystemTheme(initial?); isThemePreference(value);
```

## Examples

### Тема в сторе приложения

```typescript
import { createModel, createStore } from '@reformer/core/model';
import { createTheme, webStorage, type ThemePreference } from '@reformer/core/theme';

export const app = createStore(() => {
  const model = createModel({ settings: { theme: 'system' as ThemePreference } });
  const theme = createTheme({ preference: model.$.settings.theme, storage: webStorage() });
  return { model, theme };
});
```

### Переключатель

```tsx
import { useSignalSnapshot } from '@reformer/core/react';

function ThemeToggle() {
  const resolved = useSignalSnapshot(app.theme.resolved);
  return <Button onClick={app.theme.toggle}>{resolved === 'dark' ? 'Светлая' : 'Тёмная'}</Button>;
}
```

### Без мигания до гидратации (SSR, статический сайт)

```html
<script>
  try {
    var p = JSON.parse(localStorage.getItem('reformer.theme'));
    var dark = p === 'dark' || (p !== 'light' && matchMedia('(prefers-color-scheme: dark)').matches);
    document.documentElement.classList.toggle('dark', dark);
  } catch (e) {}
</script>
```

## Anti-patterns

### Своя подписка на prefers-color-scheme и ручной classList

```typescript
// ❌ matchMedia(...).addEventListener + document.documentElement.classList.add('dark')
// ✅ createTheme(): система, выбор и применение — один computed и один эффект
```

### React-контекст темы поверх уровня

```tsx
// ❌ <ThemeContext.Provider value={theme}> ради чтения
// ✅ useSignalSnapshot(app.theme.resolved) — компонент перерисуется только при смене темы
```

## See also

- `44-ui-language.md`, `45-data-table.md`, `46-cross-level-rules.md`.
