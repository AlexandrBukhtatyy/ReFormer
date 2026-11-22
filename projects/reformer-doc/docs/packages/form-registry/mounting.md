---
title: 'Монтирование'
sidebar_label: 'Монтирование'
---

# Монтирование

Приложение-хозяин показывает формы из реестра тремя компонентами: по `id`, по слоту и по маршруту.
Все они ищут запись, отсеивают недоступные, загружают части формы и собирают её. Хозяину остаётся
подать права, флаги и общий реестр компонентов.

## Когда это нужно

- Форма другого микрофронтенда должна появиться на странице хозяина.
- В одном месте страницы показываются все формы, объявленные для него, — боковая панель, вкладки.
- Форма привязана к маршруту, а роутер у хозяина свой.

## Провайдер

```tsx
import { useMemo } from 'react';
import { getFormRegistry, createSchemaCache } from '@reformer/form-registry';
import { FormRegistryProvider } from '@reformer/form-registry/react';
import { ValidationMessagesProvider } from '@reformer/cdk';

const formRegistry = getFormRegistry();
const schemaCache = createSchemaCache(); // константа модуля: ссылка не меняется

export function Root({ user }: { user: User }) {
  const context = useMemo(
    () => ({ permissions: new Set(user.permissions), flags: new Set(user.flags) }),
    [user]
  );

  return (
    <FormRegistryProvider
      registry={formRegistry}
      baseRegistry={appComponents}
      context={context}
      cache={schemaCache}
      options={{ preflight: 'error', onDiagnostic: reportToMonitoring }}
    >
      <ValidationMessagesProvider messages={appMessages}>
        <App />
      </ValidationMessagesProvider>
    </FormRegistryProvider>
  );
}
```

| Проп           | Обязателен | Что это                                                                |
| -------------- | ---------- | ---------------------------------------------------------------------- |
| `registry`     | да         | реестр форм, обычно `getFormRegistry()`                                |
| `context`      | да         | `permissions`, `flags` (множества), по желанию `route`, `locale`       |
| `baseRegistry` | да         | общий реестр компонентов приложения; реестр записи ложится поверх      |
| `cache`        | нет        | кэш схем для `kind: 'http'` — см. [Сеть и кэш](./network-and-cache.md) |
| `options`      | нет        | `preflight`, `onDiagnostic`, `stepHosts`, `fetchImpl`                  |

- Реестр форм не знает ни о роутере, ни о модели прав приложения: хозяин подаёт готовые множества.
- `cache` держите одним объектом. Новый объект кэша перезагружает уже показанные формы.
- Провайдеры вкладываются: внутренний перекрывает внешний. Так отдельная страница ставит свой кэш.
- `options.preflight` — `'error'` (по умолчанию), `'warn'` или `'off'`; см. [Проверки](./checks.md).

## Три способа показать форму

```tsx
import { FormOutlet, FormRoute, FormSlot } from '@reformer/form-registry/react';

<FormOutlet id="checkout" version="1.0.0" />   {/* одна форма по id; без version — старшая версия */}
<FormSlot name="order.sidebar" />              {/* все формы слота, по убыванию priority */}
<FormRoute path={location.pathname} />         {/* формы, чьи routes совпали с путём */}
```

- Шаблоны маршрутов поддерживают `:param` и `*`: `'/orders/:id/checkout'`, `'/admin/*'`.
- `FormRoute` получает путь пропом: реестр не читает роутер, поэтому работает с любым.
- Без React — тот же отбор вызовом `formRegistry.resolve(query, context)`. Запрос:
  `{ by: 'id', id, version? }`, `{ by: 'slot', slot }`, `{ by: 'route', path }` или
  `{ by: 'tag', tag }` (по `meta.tags`).

### Права и флаги — общий фильтр

Способ адресации — это запрос, а `access` записи — фильтр, общий для всех запросов. Обойти право,
открыв форму по маршруту вместо слота, нельзя.

Порядок проверки: все `permissions`, затем все `flags`, и только потом `canRender(context)`. Своя
функция `canRender` должна быть чистой и синхронной; для отсеянной записи она не вызывается.

### Нет прав — нет разметки

Если форма недоступна, на её месте нет ничего: ни рамки, ни заголовка. Пустая рамка сообщила бы
пользователю, что форма существует.

## Состояния загрузки

```tsx
<FormOutlet
  id="checkout"
  fallback={<Spinner />}
  loadErrorFallback={(error, retry) => <LoadError error={error} onRetry={retry} />}
  errorFallback={(error, entry) => <RenderError error={error} formId={entry.id} />}
/>
```

| Проп                | Когда показывается                                                    |
| ------------------- | --------------------------------------------------------------------- |
| `fallback`          | части формы ещё грузятся                                              |
| `loadErrorFallback` | части не загрузились или не прошли проверки; второй аргумент — повтор |
| `errorFallback`     | форма загрузилась, но упала при отрисовке; второй аргумент — запись   |

Без `fallback` и `loadErrorFallback` на месте формы `null`: ожидание и отказ выглядят одинаково —
пустым местом. Без `errorFallback` ошибку отрисовки показывает панель ошибок схемы, а не белый экран.

## Остальные пропсы места

| Проп              | Что делает                                                                                              |
| ----------------- | ------------------------------------------------------------------------------------------------------- |
| `behaviorOptions` | настройки места — колбэки хозяина; приходят в фабрику поведения записи                                  |
| `onReady(bundle)` | собранная [сборка формы](/docs/reference/glossary): `model`, `form`, `flow`, `validate()`, `submission` |
| `initial`         | свои начальные значения — например, из параметров маршрута                                              |
| `model`           | готовая модель; главнее того, что несёт запись                                                          |

```tsx
<FormOutlet id="checkout" onReady={(checkout) => checkout.model.patch(prefill)} />
```

Те же пропсы принимают `FormSlot` и `FormRoute`.

При смене записи или версии место монтирования собирает форму заново: старая модель со старой
схемой не переживает обновление.

## Тексты замечаний

Правила формы несут коды замечаний, а строки по кодам — словарь сообщений. Словарь — код, по сети он
не едет. Оберните место монтирования в `ValidationMessagesProvider` из `@reformer/cdk` со словарём
формы — как в примере провайдера выше. Без словаря на месте текста виден код.

## Своё место монтирования

Нужна своя разметка вокруг формы — соберите место из частей пакета:

- `useFormResource(entry, baseRegistry, options)` — загружает части записи и возвращает
  `{ status: 'pending' }`, `{ status: 'ready', data }` или `{ status: 'error', error, retry }`;
- `MountedForm` — собирает и рисует загруженную форму (`entry`, `loaded`, пропсы места).

Без React загрузку делает `loadForm(entry, baseRegistry, options)`: он возвращает схему формата 2,
скомпонованный реестр, поведение, правила и поток — остаётся передать их в `createForm`.

## На месте формы пусто

Запись не найдена или отсеяна правами — снаружи это неотличимо. Проверьте по шагам:

```ts
const formRegistry = getFormRegistry();
console.log(formRegistry.list().map((e) => `${e.owner}/${e.id}@${e.version}`)); // зарегистрирована?
console.log(formRegistry.resolve({ by: 'id', id: 'checkout' }, context)); // проходит права и флаги?
console.log(formRegistry.diagnostics); // совпадения id
```

Частые причины: микрофронтенд ещё не смонтировался, функцию снятия вызвали слишком рано, в `context`
нет нужного права или флага.

## Подводные камни

- **Форма перезагружается по кругу** — `cache` создаётся заново на каждом рендере. Вынесите его в
  константу модуля или `useMemo`.
- **Поля без подписи и ошибок** — ни в базовом реестре, ни в реестре записи нет `FIELD_WRAPPER`.
- **Бесконечный рендер, React error #185** — в рендере обёрнут `formRegistry.list()` в `map` или
  `filter`: каждый вызов даёт новый массив. Мемоизируйте результат.

## См. также

- [Запись формы](./form-entry.md) — `placement`, `access`, фабрика поведения.
- [Сеть и кэш](./network-and-cache.md) — `cache` провайдера.
- [Проверки](./checks.md) — `options.preflight` и `onDiagnostic`.
- [Реестр компонентов](../renderer-json/registry.md) — что класть в `baseRegistry`.
