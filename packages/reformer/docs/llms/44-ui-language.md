# Уровень языка — createLanguage

## Purpose

`createLanguage` из `@reformer/core/language` — уровень UI над моделью: запрошенный язык (`lang`),
язык на экране (`code`), локаль, перевод (`t`, `i18n`), загрузка (`pending`, `error`) и
направление письма (`dir`) — сигналами. Загрузку делает тот же `createLocaleStore`, что у
`I18nProvider`: прежний язык остаётся на экране, пока новый не загрузится, а применяется только
последний запрос.

- Язык меняют полем модели (форма настроек), `language.set(code)` или из другой вкладки
  (хранилище) — без перерисовки сверху.
- Показанный язык попадает на `<html lang dir>` и в хранилище; язык, загрузка которого упала,
  не сохраняется.
- В React — `<I18nProvider language={language}>`: компоненты cdk и ui-kit говорят этим языком.

## API

```typescript
createLanguage({
  load: LocaleLoad, // createLocaleLoader([...]) из @reformer/core/i18n
  lang?: Signal<string>, // поле модели
  initial?: string,
  fallback?: string, // 'en'
  supported?: readonly string[],
  detect?: (() => string | undefined) | null, // browserLanguage({ supported })
  storage?: StorageAdapter | null, // webStorage()
  storageKey?: string, // 'reformer.lang'
  document?: LanguageTarget | null, // documentLang()
  onError?: (error: unknown, lang: string) => void,
}): Language; // lang, code, locale, i18n, pending, error, dir, t, set, retry, dispose
```

Начальный язык: хранилище → поле модели → `initial` → `detect()` → `fallback`.

## Examples

### Язык в сторе приложения и провайдер

```tsx
import { createLocaleLoader } from '@reformer/core/i18n';
import { createLanguage, webStorage } from '@reformer/core/language';
import { I18nProvider } from '@reformer/core/react';
import { loadKitLocale } from '@reformer/ui-kit/locale';

export const app = createStore(() => {
  const model = createModel({ settings: { lang: 'ru' } });
  const language = createLanguage({
    lang: model.$.settings.lang,
    load: createLocaleLoader([loadKitLocale, appMessages]),
    supported: ['ru', 'en'],
    storage: webStorage(),
  });
  return { model, language };
});

<I18nProvider language={app.language} fallback={<Spinner />}>
  <App />
</I18nProvider>;
```

### Перевод вне React

```typescript
const title = computed(() => app.language.t('app.title')); // пересчитается при смене языка
await app.language.set('en'); // промис — язык показан
```

## Anti-patterns

### Язык в useState корня приложения

```tsx
// ❌ const [lang, setLang] = useState('ru'); <I18nProvider lang={lang} load={load}>
// ✅ createLanguage в сторе: язык меняют полем модели или set(), дерево сверху не перерисовывается
```

## See also

- `43-ui-theme.md`, `46-cross-level-rules.md`.
