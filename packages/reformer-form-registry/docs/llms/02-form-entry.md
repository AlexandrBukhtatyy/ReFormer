# FormEntry — запись реестра

`FormEntry` описывает форму целиком: что она такое, откуда её части взять, где её показывать и кому.

```ts
import type { FormEntry } from '@reformer/form-registry';

export const checkoutEntry: FormEntry<CheckoutForm> = {
  id: 'checkout',
  version: '1.0.0',
  owner: 'mfe-orders',

  // ── данные
  schema: { kind: 'inline', value: checkoutSchema },
  compatibleSchema: '^1.0.0',
  initial: { kind: 'inline', value: { items: [], total: 0 } },

  // ── код
  registry: { kind: 'inline', value: createCheckoutRegistry() },
  model: { kind: 'inline', value: createCheckoutModel },
  behavior: { kind: 'inline', value: checkoutBehavior },
  validation: { kind: 'inline', value: { steps: { delivery: deliveryRules } } },
  renderBehavior: { kind: 'inline', value: createCheckoutRenderBehavior },

  // ── где и кому
  placement: { slots: ['sidebar'], routes: ['/orders/:id/checkout'], priority: 10 },
  access: { permissions: ['orders.write'], flags: ['checkout-v2'] },

  degrade: 'error',
  meta: { name: 'Оформление заказа', tags: ['orders'] },
};
```

## Два вида источников

```ts
type DataSource<T> =
  | { kind: 'inline'; value: T }
  | { kind: 'module'; load: () => Promise<T> }
  | { kind: 'http'; url: string; init?: RequestInit };

type CodeSource<T> =
  | { kind: 'inline'; value: T }
  | { kind: 'module'; load: () => Promise<T> };
```

Разница в одном варианте — и она принципиальная. `kind: 'http'` есть у данных и **намеренно
отсутствует** у кода: загрузка кода по сети означала бы исполнение того, что отдал сервер. Это не
пробел в реализации, а граница, закреплённая системой типов.

`kind: 'module'` — динамический `import()`: код остаётся в бандле, но отдельным чанком.

## Поля

| поле | тип | зачем |
| --- | --- | --- |
| `id` | `string` | адрес формы |
| `version` | `string` | разные версии одной формы сосуществуют в реестре |
| `owner` | `string` | кто зарегистрировал — по нему разводятся коллизии `id` между микрофронтами |
| `schema` | `DataSource` | layout формы |
| `compatibleSchema` | `string?` | semver-диапазон версий схемы, с которыми совместим ЭТОТ код |
| `initial` | `DataSource?` | начальные значения |
| `model` | `CodeSource?` | фабрика модели — если нужна не пустая модель, а собранная |
| `registry` | `CodeSource?` | расширение реестра компонентов поверх базового |
| `behavior` | `CodeSource?` | поведение формы (`compute`/`enableWhen`/`onChange`) |
| `validation` | `CodeSource?` | правила; ключи `steps` = селекторы шагов визарда |
| `renderBehavior` | `CodeSource?` | фабрика render-behavior |
| `placement` | `object?` | слоты, маршруты, приоритет |
| `access` | `object?` | права, флаги, `canRender` |
| `degrade` | `'error' \| 'placeholder'` | что делать при отказе; дефолт строгий |

### `owner` обязателен не для красоты

Хранилище кэша общее на origin, а реестр общий на realm. Два микрофронта, назвавшие форму одинаково
(`checkout`), без `owner` затирали бы друг друга — и в реестре, и в кэше. Ключ кэша строится как
`${owner}/${id}@${version}`.

### `model` против `initial`

Нужен один из двух — иначе `loadForm` бросит внятную ошибку до сборки формы. Приоритет при
монтировании: проп `model` → `model` записи → проп `initial` → `initial` записи.

Фабрика модели нужна там, где начальное состояние вычисляется, а не лежит константой. Всё, что
раньше делалось «после сборки формы», должно переехать в фабрику: хука «после createJsonForm» в
реестре нет намеренно — работа с моделью относится к модели и должна происходить до сборки.

### `renderBehavior` и настройки места

```ts
(form, model, validation?, options?) => RenderBehaviorFn<T>
```

Четвёртый параметр — настройки **места монтирования**, а не формы. Колбэки вроде `onResult`
принадлежат хосту: он решает, где и как показать результат. В записи им не место — она одна на все
места, где форму покажут. Хост передаёт их пропом:

```tsx
<FormOutlet id="checkout" renderBehaviorOptions={{ onResult: showToast }} />
```

## Конфликты `id`

```ts
registry.register(entry); // дефолт: бросить, назвав ОБОИХ владельцев
registry.register(entry, { onConflict: 'replace' }); // заменить + диагностика
registry.register(entry, { onConflict: 'keep' }); // оставить прежнюю + диагностика
```

Дефолт строгий: молчаливая перезапись формы чужим микрофронтом хуже явного отказа при старте.
Повторная регистрация **той же** записи конфликтом не считается — так переживаются StrictMode и HMR.

`register` возвращает `unregister`, и возвращает его не для симметрии: в single-spa `unmount`
микрофронта обязан снять свои записи, иначе слот продолжит показывать форму выгруженного
приложения. Снятие идемпотентно и не удаляет запись, которую успел перезаписать другой владелец.
