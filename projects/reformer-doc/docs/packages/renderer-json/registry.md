---
title: 'Реестр'
sidebar_label: 'Реестр'
---

# Реестр

[Реестр](/docs/reference/glossary) связывает имена из документа с кодом. Документ пишет
`$component(Input)`, `$dataSource(LOAN_TYPES)`, `$fn(propertyLabel)`, `$locale(fields.email)` —
реестр знает, какой компонент, какие данные, какая функция и какая строка стоят за каждым именем.

## Когда это нужно

Всегда, когда форма собирается из JSON-документа: без реестра документ не превратится в дерево
узлов. Реестр передаётся в сборку: `createForm({ schema: document, registry })`.

## Пример

```ts
import { createLocaleResolver, defineRegistry, FIELD_WRAPPER } from '@reformer/renderer-json';
import { Box, FieldArray, FormField, InputNumber, SelectAsync } from '@reformer/ui-kit';

export const loanRegistry = defineRegistry((reg) => {
  // Компоненты: имя в документе → компонент. Компоненты ui-kit регистрируются как есть.
  reg.component('Box', Box);
  reg.component('InputNumber', InputNumber);
  reg.component('Select', SelectAsync); // имя в документе не обязано совпадать с экспортом
  reg.component('FieldArray', FieldArray);
  reg.component(FIELD_WRAPPER, FormField); // обёртка каждого поля

  // Данные: опции, константы — всё, что не функция.
  reg.dataSource('LOAN_TYPES', [
    { value: 'consumer', label: 'Потребительский' },
    { value: 'mortgage', label: 'Ипотека' },
  ]);

  // Функции: попадают в проп компонента ссылкой.
  reg.fn('propertyLabel', (_row: unknown, index: number) => `Имущество #${index + 1}`);

  // Строки для $locale(...): один сервис на реестр.
  reg.locale(
    createLocaleResolver({
      'fields.loanType': 'Тип кредита',
      'properties.title': 'Имущество',
    })
  );
});
```

Документ, который этот реестр понимает:

```json
{
  "format": 2,
  "root": {
    "component": "$component(Box)",
    "children": [
      {
        "model": "$model(loanType)",
        "component": "$component(Select)",
        "componentProps": {
          "label": "$locale(fields.loanType)",
          "options": "$dataSource(LOAN_TYPES)"
        }
      },
      {
        "model": "$model(properties)",
        "component": "$component(FieldArray)",
        "componentProps": {
          "title": "$locale(properties.title)",
          "itemLabel": "$fn(propertyLabel)"
        },
        "item": {
          "$template": {
            "model": "$model(value)",
            "component": "$component(InputNumber)",
            "componentProps": { "label": "Стоимость" }
          }
        }
      }
    ]
  }
}
```

## Методы

| Метод                            | Имя в документе     | Что регистрирует                                                    |
| -------------------------------- | ------------------- | ------------------------------------------------------------------- |
| `reg.component(name, Component)` | `$component(name)`  | React-компонент поля или контейнера                                 |
| `reg.dataSource(name, value)`    | `$dataSource(name)` | значение: массив опций, константа, сигнал, компонент-значение пропа |
| `reg.fn(name, fn)`               | `$fn(name)`         | функцию; не функцию метод не примет                                 |
| `reg.locale(service)`            | `$locale(key)`      | сервис локализации — один на реестр                                 |

Служебные ключи — константы пакета:

- `FIELD_WRAPPER` — обёртка каждого поля, обычно `FormField` из `@reformer/ui-kit`. Сборка берёт её
  из реестра, поэтому `settings.fieldWrapper` у `FormRenderer` не нужен. Если задать его, он
  перекроет запись реестра.
- `LOCALE_SERVICE` — ключ, под которым лежит сервис `reg.locale`. Регистрировать по нему руками не
  нужно.

## Компоненты

- Одним методом регистрируются и поля, и контейнеры. Роль решает узел документа: с `model` — поле,
  с `children` — контейнер.
- Компоненты `@reformer/ui-kit` регистрируйте как есть: как читать значение и сообщать об
  изменении, они объявляют сами.
- Передавайте сам компонент, а не элемент: `reg.component('Input', Input)`, не `<Input />`.
- HTML-теги регистрировать не нужно — для них оператор `$html(tag)`.

### Компоненты сторонних библиотек

Компонент чужого кита регистрируется так же. Если он читает значение не из `value` или передаёт в
`onChange` событие, ему нужен адаптер поля. Его задают в настройках рендерера, а не в реестре:

```tsx
<FormRenderer form={order} settings={{ resolveFieldAdapter: (c) => adapters.get(c) }} />
```

Адаптер ищется по самому компоненту — тому, что вернул реестр на `$component(Checkbox)`, а не по
имени. Поля адаптера и примеры — на странице
[Поля: обёртка и адаптеры](../renderer-react/fields.md#компоненты-сторонних-библиотек).

Контролу, который читает саму ноду формы, передачу `control` включают явно: статикой
`Control.reformerNeedsControl = true` или `passControl: true` в адаптере.

## Данные: `$dataSource`

Всё, что документ не может хранить сам: опции из кода, вычисленные константы, компонент как значение
пропа, сигнал с состоянием интерфейса.

```ts
reg.dataSource('CURRENT_YEAR', new Date().getFullYear());
reg.dataSource('EMPTY_STATE', EmptyState); // компонент как значение пропа, не как узел
```

- Запись `dataSource` нельзя поставить в `component` узла: `$component(EMPTY_STATE)` бросит ошибку.
- Сигнал из `@reformer/core/signals` в тексте HTML-узла обновляется вместе со значением — так
  показывают статус отправки, которого нет в модели.

## Функции: `$fn`

Функция передаётся в проп ссылкой. Типичный случай — метка строки списка:
`"itemLabel": "$fn(propertyLabel)"` у `FieldArray`.

- Аргументов у оператора нет. Нужна функция с готовым аргументом — зарегистрируйте уже связанную.
  Чтобы выбирать её аргументом из документа (`$money(RUB)`), сделайте
  [свой оператор](./custom-operators.md).
- Проп, которого у компонента нет, функция не создаст: значение уйдёт в пропсы, и его никто не
  прочитает.
- `$fn` и `$dataSource` не взаимозаменяемы: ссылка на запись другого вида — ошибка.

## Локализация: `$locale` и `I18n`

Строки документа можно брать из каталога. Путей два, и выбор зависит от того, куда идёт строка:

| Куда                                                      | Как                                                      | Обновляется                          |
| --------------------------------------------------------- | -------------------------------------------------------- | ------------------------------------ |
| строковый проп: `label`, `placeholder`, `title`, `aria-*` | `$locale(key)` или `{ "$locale": key, "params": { … } }` | нет: строка подставляется при сборке |
| видимый текст, разметка                                   | компонент `I18n` и `LocaleProvider`                      | при смене языка и параметров         |

`$locale` превращается в строку один раз, при сборке формы. Сменить язык у подписей полей — значит
передать в `reg.locale` другой сервис и собрать форму заново.

Сервис — объект `LocaleService`: `resolve(key, params)` возвращает строку, необязательный
`render(key, params)` — разметку, `keys` — список ключей для проверки документа. Без зависимостей его
строят две фабрики:

```ts
import { createLocaleResolver, createLocaleService } from '@reformer/renderer-json';

// Плоский каталог «ключ → строка».
const ru = createLocaleResolver({ 'fields.email': 'Электронная почта' });

// «Ключ → функция от параметров» — подстановка и склонение без внешних библиотек.
const ruWithParams = createLocaleService({
  'fields.password.min': (p) => `Минимум ${p?.count} символов`,
});
```

ICU, i18next или markdown подключаются своей реализацией `LocaleService`.

Для текста, который должен меняться вживую, зарегистрируйте `I18n` и оберните форму
`LocaleProvider`:

```tsx
import { I18n, LocaleProvider } from '@reformer/renderer-json';

// В реестре: reg.component('I18n', I18n);
<LocaleProvider service={services[lang]}>
  <FormRenderer form={team} />
</LocaleProvider>;
```

```json
{
  "component": "$component(I18n)",
  "componentProps": { "id": "users.count", "values": { "count": "$model(userCount)" } }
}
```

`I18n` перерисовывается при смене сервиса в `LocaleProvider` и при изменении `$model(...)` в
`values`. Без `LocaleProvider` он покажет сам ключ.

Подписи кнопок и тексты замечаний библиотеки (`FieldArray`, правила проверки) переводятся не этим
сервисом, а словарями ядра и кита — см. [Обзор валидации](/docs/validation/overview).

## Несколько реестров

Общий реестр приложения и реестр формы объединяет `composeRegistries`:

```ts
import { composeRegistries } from '@reformer/renderer-json';

const registry = composeRegistries(appRegistry, loanRegistry);
```

Слияние идёт слева направо; при совпадении имён побеждает последний реестр. Результат уходит в
сборку как обычный реестр.

Реестр передаётся в сборку явно, а не через React-контекст. Поэтому приложение-хозяин и
микрофронтенд с формой могут жить в разных бандлах — на этом построен
[реестр форм](../form-registry.md).

## Подводные камни

| Сообщение                                                           | Причина                                                       |
| ------------------------------------------------------------------- | ------------------------------------------------------------- |
| `Component "X" not found in registry`                               | имя не зарегистрировано или в сборку ушёл другой реестр       |
| `Data source "X" not found in registry`                             | нет записи `reg.dataSource('X', …)`                           |
| `Entry "X" is a 'dataSource' and cannot be used as $component(...)` | запись данных поставлена в `component`                        |
| `reg.fn("x") expects a function`                                    | в `reg.fn` передано не функция — используйте `reg.dataSource` |
| поля без подписи и ошибок                                           | нет записи `FIELD_WRAPPER`                                    |
| в подписи виден ключ, а не текст                                    | не задан `reg.locale` или ключа нет в каталоге                |

Повторный `reg.locale(...)` заменяет прежний сервис: сервис в реестре один. Разные языки — разные
каталоги, по одному за раз.

## См. также

- [Формат документа](./document-format.md) — операторы и где они действуют.
- [Свои операторы](./custom-operators.md) — строки `$имя(аргумент)` сверх встроенных.
- [Проверка документа](./document-check.md) — как найти незарегистрированные имена до сборки.
- [Поля: обёртка и адаптеры](../renderer-react/fields.md) — адаптеры и своя обёртка поля.
- [@reformer/renderer-json](../renderer-json.mdx) — обзор пакета.
