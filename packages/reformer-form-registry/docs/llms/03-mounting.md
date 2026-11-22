# Монтирование: FormOutlet, FormSlot, FormRoute

## Провайдер

```tsx
import { getFormRegistry } from '@reformer/form-registry';
import { FormRegistryProvider } from '@reformer/form-registry/react';

<FormRegistryProvider
  registry={getFormRegistry()}
  baseRegistry={coreComponents}
  context={{ permissions: new Set(user.permissions), flags: new Set(featureFlags) }}
  cache={schemaCache}
  options={{ preflight: 'warn', onDiagnostic: report }}
>
  <App />
</FormRegistryProvider>;
```

`context` подаёт **хост**: реестр не знает ни про роутер, ни про модель прав приложения. Он получает
готовые множества и сравнивает по ним.

Обязательны `registry`, `context` и `baseRegistry`. `cache` и `options` необязательны, но их стоит
держать **стабильными по ссылке**: смена экземпляра кэша перезагружает смонтированные формы (это
осмысленно при смене настроек кэша, но не в цикле). Провайдеры вкладываются — внутренний перекрывает
внешний, чем и пользуется отдельная страница со своим кэшем.

## Три способа адресации

```tsx
<FormOutlet id="checkout" version="1.0.0" />   {/* по id */}
<FormSlot name="sidebar" />                    {/* все формы слота */}
<FormRoute path="/orders/42/checkout" />       {/* по маршруту */}
```

Маршруты поддерживают `:param` и `*`; шаблон компилируется в `RegExp` один раз, а не на каждый
резолв.

### Инвариант: право нельзя обойти другой дверью

Способы адресации — это разные формы **запроса**, а права и флаги — **фильтр**, общий для всех:

```ts
resolveForms(store, query, ctx) =
  store.filter(matchesQuery).filter(passesGate).sort(byPriorityThenVersion);
```

Если бы гейт жил в компоненте слота, императивный API его бы миновал. Инвариант закреплён тестом,
который прогоняет один и тот же гейт против всех четырёх видов запроса.

Порядок внутри `access`: сперва `permissions` (нужны ВСЕ), потом `flags` (нужны ВСЕ), и только если
они прошли — `canRender(ctx)`. Дорогая пользовательская проверка не вызывается для записи, которая
всё равно отсеяна.

## Нет прав — нет разметки

```tsx
<FormSlot name="sidebar" />
```

Если ни одна форма слота недоступна, в DOM не появляется **ничего** — ни пустой рамки, ни
заголовка. Пустая рамка на месте недоступной формы сообщает пользователю о её существовании; это
утечка, пусть и мелкая.

## Состояния загрузки

```tsx
<FormOutlet
  id="checkout"
  fallback={<Spinner />}
  loadErrorFallback={(error, retry) => <ErrorPanel error={error} onRetry={retry} />}
  errorFallback={(error, entry) => <RenderErrorPanel error={error} entry={entry} />}
/>
```

Две разные ветки, и путать их нельзя: `loadErrorFallback` — **части не загрузились** (сеть, модуль,
непройденный preflight), второй аргумент даёт повтор. `errorFallback` — форма загрузилась, но упала
**на рендере**, повторять там нечего, поэтому второй аргумент — сама запись.

Без `fallback` и `loadErrorFallback` `FormOutlet` рендерит `null`: для сетевого источника это значит,
что и ожидание, и отказ выглядят одинаково — пустым местом.

Форма дополнительно обёрнута в `SchemaErrorBoundary`: ошибка рендера даёт панель ошибки, а не
белый экран. Границу кладёт в бандл реестр, а `errorFallback` места монтирования её заменяет.
Неизвестный `$component` и прочие промахи документа ловит до сборки preflight
(`missing-components`) — и форма не монтируется, срабатывает `loadErrorFallback`. Запись с
`degrade: 'placeholder'` вместо этого монтируется с нейтральными заглушками на месте пропавших
компонентов, а хост получает диагностику `placeholder-components` (см. `02-form-entry.md`).

Отдельные пропы места монтирования:

- `behaviorOptions` — настройки места (колбэки хоста вроде `onResult`): приходят аргументом в
  фабрику поведения записи (`FormEntry.behavior`);
- `onReady(bundle)` — собранный бандл: `model`, `form`, `flow`, `validate()`,
  `submission.submit(handler)`;
- `initial` / `model` — переопределение начальных значений либо готовая модель.

## Почему реестр передаётся ЯВНО, а не контекстом

```tsx
createForm({ schema: loaded.schema, registry: loaded.registry, model, behavior, validation, flow });
```

React-контекст не пересекает границу бандла: провайдер хоста и рендерер ремоута — разные модульные
графы. Полагаться на контекст здесь значит получить молчаливый отказ в проде, где DEV-guard вырезан
сборщиком.

Вместе с реестром едет и производная от него обёртка полей (`$fieldWrapper`): её вместе с деревом
достаёт из реестра сама сборка и кладёт в бандл — `FormRenderer` берёт её оттуда.

## Адаптеры полей чужого кита

Компоненты чужого кита, которые читают значение не из `value` (`checked`, `selected`, своё событие
вместо `onChange`), подключаются резолвом адаптеров — тем же, что `settings.resolveFieldAdapter` у
`FormRenderer`. В реестре форм он задаётся один раз, в опциях провайдера:

```tsx
const resolveFieldAdapter = (component) => adapters.get(component); // ссылка стабильная

<FormRegistryProvider registry={registry} context={ctx} baseRegistry={core} options={{ resolveFieldAdapter }}>
  <FormOutlet id="checkout" />
</FormRegistryProvider>;
```

Все формы, смонтированные `FormOutlet` / `FormSlot` / `FormRoute`, получают его отсюда. При ручной
сборке без outlet'а (`useFormResource(entry, baseRegistry)` + `MountedForm`) резолв передаётся
одноимённым пропом: `<MountedForm entry={entry} loaded={res.data} resolveFieldAdapter={…} />`.

Резолв приоритетнее статики компонента: `reformerAdapter` (или `defineFieldControl(ForeignInput,
{ adapter })` из `@reformer/ui-kit/fields`) берётся, только если резолв вернул `undefined`. Статика
удобнее, когда компонент ваш, — тогда опция провайдера не нужна. Держите ссылку на резолв
стабильной: смена ссылки перерисовывает смонтированные формы.

Валидация схемы мета-схемой — ответственность загрузчика (см. `05-preflight.md`), а не монтирования.

## Пересоздание при смене версии

```tsx
<MountedForm key={entryKeyOf(entry)} ... />
```

`key` заставляет React пересоздать поддерево целиком. Без него ленивый `useState` внутри
`useFormBundle` вернул бы старую модель со старой схемой — форма
визуально «обновилась» бы, а данные остались от прежней версии.
