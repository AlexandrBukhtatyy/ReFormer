# AsyncBoundary

Headless compound component для состояний асинхронной загрузки данных: `idle` / `loading` / `ready` / `error`. Раздаёт состояние слотам и расставляет ARIA, но не рендерит ни разметки, ни стилей — визуальный слой живёт в `@reformer/ui-kit`.

Это **не** Suspense-boundary: ничего не throw'ится и не перехватывается.

## Два режима

| Режим            | Включается         | Кто ведёт состояние                                                                      |
| ---------------- | ------------------ | ------------------------------------------------------------------------------------------ |
| **self-managed** | передан `load`     | Компонент: сам грузит, отменяет запрос при смене `loadKey`/размонтировании, даёт повтор.    |
| **controlled**   | `load` не передан  | Консумент через `status` — например behavior рендерера с `patchProps({ status })`.          |

В self-managed режиме props `status` / `error` / `refreshing` / `onRetry` игнорируются: два источника истины о состоянии — источник багов. Режим выбирается один раз при монтировании, менять его на лету нельзя.

## Purpose

- Забрать загрузку внутрь компонента: снаружи остаются только «как загрузить» (`load`) и «что сделать с ответом» (`onSuccess`), а гонки, отмена и повтор — внутри.
- Развести четыре взаимоисключающих состояния экрана без цепочки тернарников.
- Передать в слот ошибки **саму ошибку и колбэк повтора** — чтобы текст сбоя не приходилось хардкодить в отдельном компоненте-обёртке.
- Отличить «грузить нечего» (`idle`) от «успешно загружено» (`ready`).
- Погасить вспышку спиннера при быстром ответе (`delayMs`) и сохранить контент при фоновом обновлении (`refreshing`).
- Выдать корректные `aria-busy` / `role="status"` / `role="alert"` без участия консумента.

## Components

| Component                    | Purpose                                                                                                | Notes                                                                                            |
| ---------------------------- | ------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------ |
| `AsyncBoundary.Root`         | Context provider; принимает `status`, `error`, `onRetry`, `refreshing`, `delayMs`, `id`.               | Разметки не рендерит. Без `Root` слоты бросают исключение.                                        |
| `AsyncBoundary.Idle`         | Содержимое при `status === 'idle'` — загрузка не запускалась.                                          | Форма создания: `id === null` → грузить нечего, но это и не успешная загрузка.                    |
| `AsyncBoundary.Loading`      | Содержимое во время загрузки.                                                                          | Учитывает `delayMs`: при быстром ответе не показывается вовсе.                                    |
| `AsyncBoundary.Content`      | Содержимое при `status === 'ready'`.                                                                   | По умолчанию остаётся видимым при `refreshing`; отключается `showWhileRefreshing={false}`.        |
| `AsyncBoundary.Empty`        | Содержимое, когда данные загружены, но пусты. Предикат приходит пропом `when`.                          | Рендерится только внутри `ready` — пустота это ось поверх статуса, а не пятое его значение.       |
| `AsyncBoundary.Error`        | Содержимое при `status === 'error'`. Children — узел **или** render-функция `({ error, retry, canRetry })`. | Единственный слот с render-props: без них текст ошибки и `onRetry` теряются.                  |
| `AsyncBoundary.Retry`        | Кнопка повтора (`<button type="button">` или `asChild`).                                               | Не рендерится без `onRetry` — контрол, который ничего не делает, хуже отсутствующего.             |
| `useAsyncBoundaryContext<E>()` | Хук для произвольных детей: `status`, флаги, `error`, `retry`, `ids`, наборы пропсов.                 | Бросает `Error` вне `AsyncBoundary.Root`.                                                         |
| `useAsyncBoundary(options)`  | Standalone hook без compound API. Возвращает флаги, `retry`, `ids` и `rootProps` / `loadingProps` / `errorProps`. | Для случаев, когда разметка пишется вручную.                                             |
| `useAsyncResource(options)`  | Хук загрузки с отменой и повтором: `load` / `loadKey` / `enabled` → `{ status, data, error, refreshing, reload, abort }`. | То, что `Root` использует внутри в self-managed режиме.                          |
| `asyncResourceReducer`       | Чистая (React-free) машина состояний загрузки.                                                          | Экспортирована для своих обёрток и юнит-тестов без DOM.                                   |

## Imperative handle

`AsyncBoundary.Root` принимает `ref` типа `AsyncBoundaryHandle<T, E>` — для триггеров вне дерева границы (кнопка «Обновить» в шапке, пункт меню, событие сокета):

```tsx
import { useRef } from 'react';
import { AsyncBoundary, type AsyncBoundaryHandle } from '@reformer/cdk/async-boundary';

const boundaryRef = useRef<AsyncBoundaryHandle<Application[]>>(null);

<header>
  <button onClick={() => boundaryRef.current?.reload()}>Обновить</button>
  <button onClick={() => boundaryRef.current?.abort()}>Отменить</button>
</header>

<AsyncBoundary.Root ref={boundaryRef} load={fetchApplications}>…</AsyncBoundary.Root>;
```

| Поле                                          | Назначение                                                                    |
| --------------------------------------------- | ------------------------------------------------------------------------------ |
| `reload()`                                     | Перезапустить загрузку. В controlled-режиме вызывает `onRetry`.                |
| `abort()`                                      | Прервать запрос; прерывание не считается ошибкой. В controlled-режиме — no-op. |
| `status` / `data` / `error` / `isLoading` / `refreshing` | Снимок на момент рендера — для реактивного UI читайте контекст, а не handle. |

## Examples

### Self-managed — загрузка внутри компонента

```tsx
import { AsyncBoundary } from '@reformer/cdk/async-boundary';

function ApplicationPage({ applicationId, form }: Props) {
  return (
    <AsyncBoundary.Root
      load={(signal) => loadApplication(applicationId, signal)}
      loadKey={applicationId}
      enabled={applicationId !== null}
      onSuccess={(data) => form.patchValue(data)}
      delayMs={200}
    >
      <AsyncBoundary.Idle>
        <h1>Новая заявка</h1>
      </AsyncBoundary.Idle>

      <AsyncBoundary.Loading>
        <p role="status" aria-live="polite">
          Загрузка заявки…
        </p>
      </AsyncBoundary.Loading>

      <AsyncBoundary.Error>
        {({ error, retry }) => (
          <div role="alert" aria-live="assertive">
            <p>{String(error)}</p>
            <button onClick={retry}>Повторить</button>
          </div>
        )}
      </AsyncBoundary.Error>

      <AsyncBoundary.Content>
        <CreditForm form={form} />
      </AsyncBoundary.Content>
    </AsyncBoundary.Root>
  );
}
```

`load` получает `AbortSignal` — прокиньте его в `fetch`/`axios`, иначе отменённый запрос продолжит висеть в сети. Смена `loadKey` отменяет предыдущий запрос, поэтому ответ на устаревший id не перетрёт свежие данные.

### Controlled — состоянием владеет внешний код

```tsx
function ApplicationPage({ status, error, reload, form }: Props) {
  return (
    <AsyncBoundary.Root status={status} error={error} onRetry={reload} delayMs={200}>
      <AsyncBoundary.Loading>
        <p role="status" aria-live="polite">
          Загрузка заявки…
        </p>
      </AsyncBoundary.Loading>

      <AsyncBoundary.Error>
        {({ error, retry, canRetry }) => (
          <div role="alert" aria-live="assertive">
            <p>{String(error)}</p>
            {canRetry && <button onClick={retry}>Повторить</button>}
          </div>
        )}
      </AsyncBoundary.Error>

      <AsyncBoundary.Content>
        <CreditForm form={form} />
      </AsyncBoundary.Content>
    </AsyncBoundary.Root>
  );
}
```

### Пустой результат

Пустоту считает консумент, поэтому она приходит предикатом, а не статусом:

```tsx
<AsyncBoundary.Content>
  <AsyncBoundary.Empty when={items.length === 0}>
    <p>Ничего не найдено</p>
  </AsyncBoundary.Empty>
  {items.map((item) => (
    <Row key={item.id} {...item} />
  ))}
</AsyncBoundary.Content>
```

### Режим создания — состояние `idle`

```tsx
// applicationId === null → грузить нечего. Без idle это состояние схлопывается
// в ready, и пустая форма становится неотличима от успешно загруженной.
<AsyncBoundary.Root status={applicationId ? status : 'idle'}>
  <AsyncBoundary.Idle>
    <h1>Новая заявка</h1>
  </AsyncBoundary.Idle>
  <AsyncBoundary.Content>
    <h1>Заявка №{applicationId}</h1>
  </AsyncBoundary.Content>
</AsyncBoundary.Root>
```

### Без compound-дерева — `useAsyncBoundary`

```tsx
import { useAsyncBoundary } from '@reformer/cdk/async-boundary';

function Panel({ status, error, reload, children }: Props) {
  const { isLoading, isError, retry, rootProps, loadingProps, errorProps } = useAsyncBoundary({
    status,
    error,
    onRetry: reload,
    delayMs: 200,
  });

  return (
    <section {...rootProps}>
      {isLoading && <p {...loadingProps}>Загрузка…</p>}
      {isError && (
        <div {...errorProps}>
          {String(error)}
          <button onClick={retry}>Повторить</button>
        </div>
      )}
      {!isLoading && !isError && children}
    </section>
  );
}
```

## Accessibility

Расставляется компонентом, дублировать вручную не нужно:

| Элемент          | Атрибуты                                              | Почему                                                                       |
| ---------------- | ----------------------------------------------------- | ---------------------------------------------------------------------------- |
| Регион (`rootProps`) | `aria-busy` при `loading`/`refreshing`, `data-status` | Даёт AT знать, что содержимое обновляется; `data-status` — хук для e2e и CSS. |
| Загрузка (`loadingProps`) | `role="status"` + `aria-live="polite"`           | Появление индикатора не должно прерывать чтение текущего контента.           |
| Ошибка (`errorProps`) | `role="alert"` + `aria-live="assertive"`           | Потеря данных должна прервать чтение — иначе работа продолжится вслепую.     |

Булевы `aria-*` / `data-*` выставляются как `true | undefined`, никогда `false`: `false` отрендерился бы строкой `"false"` и сломал селекторы вида `[data-refreshing]`.

## Common Patterns

- **Отложенный спиннер.** `delayMs={200}` — статус остаётся честным (`'loading'`), откладывается только показ слота. Ответ за 120 мс проходит `loading → ready`, а пользователь не видит вспышки.
- **Stale-while-revalidate.** При обновлении держите `status: 'ready'` и поднимайте `refreshing` — контент остаётся на экране, регион помечается занятым.
- **Множественная загрузка как одна единица.** Заявка + справочники грузятся `Promise.all`; падение любого — общий `error`. Разные сообщения различают причину.

## Anti-patterns

- **Не** заводить пятый статус `'empty'`: пустоту знает только консумент, а статус пришлось бы пересчитывать на каждое изменение данных. Используйте `AsyncBoundary.Empty` с `when`.
- **Не** схлопывать «нечего грузить» в `ready` — для этого есть `idle`.
- **Не** рендерить кнопку повтора без рабочего `onRetry`: она ловит фокус и читается скринридером впустую. `AsyncBoundary.Retry` скрывается сам.
- **Не** смешивать режимы: если передан `load`, не передавайте ещё и `status` — компонент его игнорирует, а читающий код будет думать, что состояние приходит снаружи.
- **Не** забывать `AbortSignal` в `load`: без него отменённый запрос доедет до сервера и продолжит держать соединение, а гонку поймает только внутренний guard.
- **Не** передавать в `loadKey` свежий объект (`{ id }`) — сравнение идёт по `Object.is`, и загрузка перезапустится на каждом рендере. Нужен примитив или мемоизированное значение.
- **Не** переиспользовать слово `pending` для загрузки данных — в `@reformer/core` оно занято состоянием асинхронного валидатора (`FieldStatus === 'pending'`).
- **Не** класть в CDK-слоты Tailwind-классы и вёрстку: стилизованные блоки живут в `@reformer/ui-kit` (`AsyncBoundary`, `AsyncBoundaryLoading`, `AsyncBoundaryError`, `AsyncBoundaryEmpty`).
