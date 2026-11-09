---
title: 'Свои операторы'
sidebar_label: 'Свои операторы'
---

# Свои операторы

Встроенных операторов семь: `$model`, `$component`, `$html`, `$dataSource`, `$fn`, `$locale` и
`$part`. Восьмой к ним не добавляется: строку `$money(RUB)` [сборка формы](/docs/reference/glossary)
не разбирает и отдаёт компоненту как есть. Свой оператор делается иначе. Ваш код до сборки заменяет
такие строки обычными значениями или встроенными операторами. После замены документ обычный, и
дальше всё работает как всегда.

## Когда нужно

Сначала проверьте, не хватит ли записи [реестра](/docs/reference/glossary):

| Что нужно документу         | Без своего оператора                                  |
| --------------------------- | ----------------------------------------------------- |
| значение или данные из кода | `reg.dataSource('NAME', value)` и `$dataSource(NAME)` |
| функция в проп компонента   | `reg.fn('name', fn)` и `$fn(name)`                    |
| строка из каталога          | `reg.locale(service)` и `$locale(key)`                |

Свой оператор нужен, когда:

- документу нужно передать аргумент, а `$fn` и `$dataSource` его не принимают. Например, имя
  настройки приложения или валюту, в которой форматировать сумму;
- документы приходят из системы со своей записью. Например, CMS пишет ключи строк как `$t(key)`,
  а не `$locale(key)`.

## Пример

В документе три своих оператора: `$config(name)` — настройка приложения, `$t(key)` — строка
каталога в записи CMS, `$money(currency)` — функция форматирования суммы.

```json title="order.schema.json"
{
  "format": 2,
  "root": {
    "component": "$component(Box)",
    "children": [
      {
        "model": "$model(email)",
        "component": "$component(Input)",
        "componentProps": { "label": "$t(fields.email)" }
      },
      {
        "model": "$model(amount)",
        "component": "$component(AmountInput)",
        "componentProps": { "label": "$t(fields.amount)", "formatValue": "$money(RUB)" }
      },
      { "component": "$html(p)", "children": ["Вопросы: ", "$config(SUPPORT_PHONE)"] }
    ]
  }
}
```

`AmountInput` — ваш компонент поля: в проп `formatValue` он получает функцию форматирования.

Операторы и функция, которая их разворачивает:

```ts title="document-operators.ts"
import { parseOperator } from '@reformer/renderer-json';

/** Свой оператор: аргумент из скобок → значение для документа. */
export type OperatorExpander = (arg: string) => unknown;

const OPERATOR = /^\$([A-Za-z][A-Za-z0-9]*)\((.+)\)$/;

/** Заменяет свои операторы документа. Встроенные операторы и обычные строки не трогает. */
export function expandOperators<D>(document: D, operators: Record<string, OperatorExpander>): D {
  const expanders = new Map(Object.entries(operators));
  const walk = (value: unknown): unknown => {
    if (typeof value === 'string') {
      if (parseOperator(value)) return value; // встроенный оператор
      const match = OPERATOR.exec(value);
      if (!match) return value; // обычная строка
      const expand = expanders.get(match[1]);
      if (!expand) throw new Error(`Unknown operator "${value}"`);
      return expand(match[2]);
    }
    if (Array.isArray(value)) return value.map(walk);
    if (value !== null && typeof value === 'object') {
      return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, walk(item)]));
    }
    return value;
  };
  return walk(document) as D;
}

const settings: Record<string, string> = { SUPPORT_PHONE: '8 800 555-35-35' };

export const operators: Record<string, OperatorExpander> = {
  // "$config(SUPPORT_PHONE)" → "8 800 555-35-35"
  config: (name) => {
    const value = settings[name];
    if (typeof value !== 'string') throw new Error(`No setting "${name}"`);
    return value;
  },
  // "$t(fields.email)" → "$locale(fields.email)"
  t: (key) => `$locale(${key})`,
  // "$money(RUB)" → "$fn(money.RUB)": функция с этим именем лежит в реестре
  money: (currency) => `$fn(money.${currency})`,
};
```

Реестр регистрирует функцию на каждую валюту — под теми именами, которые даёт `$money`:

```ts title="registry.ts"
import { createLocaleResolver, defineRegistry, FIELD_WRAPPER } from '@reformer/renderer-json';
import { Box, FormField, Input } from '@reformer/ui-kit';
import { AmountInput } from './amount-input';

const CURRENCIES = ['RUB', 'USD'] as const;

export const registry = defineRegistry((reg) => {
  reg.component('Box', Box);
  reg.component('Input', Input);
  reg.component('AmountInput', AmountInput);
  reg.component(FIELD_WRAPPER, FormField);
  reg.locale(createLocaleResolver({ 'fields.email': 'Почта', 'fields.amount': 'Сумма' }));

  for (const currency of CURRENCIES) {
    const format = new Intl.NumberFormat('ru-RU', { style: 'currency', currency });
    reg.fn(`money.${currency}`, (value: number) => format.format(value));
  }
});
```

Документ разворачивается при загрузке — до проверки и сборки:

```tsx title="order-form.tsx"
import { createForm } from '@reformer/core';
import { useFormBundle } from '@reformer/core/react';
import { FormRenderer } from '@reformer/renderer-react';
import { validateFormSchema } from '@reformer/renderer-json/validate';
import rawDocument from './order.schema.json';
import { expandOperators, operators } from './document-operators';
import { registry } from './registry';

type Order = { email: string; amount: number };

const document = expandOperators(rawDocument, operators);

// Проверяется развёрнутый документ: в нём уже обычные $fn(...) и $locale(...).
const check = validateFormSchema(document, { registry });
if (!check.valid) console.error(check.errors);

export function OrderForm() {
  const order = useFormBundle(() =>
    createForm<Order>({ initial: { email: '', amount: 0 }, schema: document, registry })
  );
  return <FormRenderer form={order} />;
}
```

Что происходит со строками документа:

| В документе              | После `expandOperators`   | В форме                           |
| ------------------------ | ------------------------- | --------------------------------- |
| `$config(SUPPORT_PHONE)` | `8 800 555-35-35`         | текст абзаца                      |
| `$t(fields.email)`       | `$locale(fields.email)`   | подпись «Почта»                   |
| `$money(RUB)`            | `$fn(money.RUB)`          | функция форматирования из реестра |
| `$model(email)`          | без изменений             | сигнал поля, как обычно           |
| `$mony(RUB)` (опечатка)  | ошибка `Unknown operator` | форма не собирается               |

## Что возвращает оператор

Оператор отвечает тем, что можно записать в JSON:

- литералом: строкой, числом, `true`/`false`, `null`, массивом или объектом;
- встроенным оператором в виде строки: `$fn(...)`, `$dataSource(...)`, `$locale(...)`,
  `$model(...)`.

Функцию, компонент или сигнал оператор не возвращает. Положите их в реестр, а оператор пусть
вернёт ссылку на запись — так устроен `$money`. Тогда развёрнутый документ остаётся данными, и
`validateFormSchema` проверяет в нём имена.

Аргумент — вся строка между скобками. `$money(RUB, 2)` передаст `"RUB, 2"` — несколько значений
оператор разбирает сам.

## Где оператор пишется

В значениях: в `componentProps` на любой глубине и в тексте `children`. В структурных ключах —
`component`, `model`, `part`, `item` — свой оператор не пишите. Мета-схема в редакторе и
`defineJsonSchema` признают такой документ ошибочным, даже если после разворачивания он верный.

## Разворачивать при каждой сборке

Если документов много и каждый собирается своим `createForm`, разворачивание можно поручить
реестру. Сборка получает дерево из документа методом реестра `resolveSchema`. Обёртка разворачивает
документ перед ним, остальные методы передаёт исходному реестру:

```ts title="with-operators.ts"
import type { ComponentRegistry } from '@reformer/renderer-json';
import { expandOperators, type OperatorExpander } from './document-operators';

export function withOperators(
  registry: ComponentRegistry,
  operators: Record<string, OperatorExpander>
): ComponentRegistry {
  const resolveSchema = registry.resolveSchema;
  if (!resolveSchema) throw new Error('The registry cannot build a form from a document');
  return {
    get: (name) => registry.get(name),
    getDataSource: <T>(name: string) => registry.getDataSource<T>(name),
    getLocale: () => registry.getLocale?.(),
    has: (name) => registry.has(name),
    names: () => registry.names(),
    resolveSchema: (document, model) =>
      resolveSchema.call(registry, expandOperators(document, operators), model),
  };
}
```

```ts
const formRegistry = withOperators(registry, operators);

createForm<Order>({ initial, schema: rawDocument, registry: formRegistry });
```

Обёртка должна быть последней. `composeRegistries` собирает из реестров новый, и разворачивание в
нём теряется: пишите `withOperators(composeRegistries(appRegistry, registry), operators)`, а не
наоборот. [Реестр форм](../form-registry.md) объединяет реестры сам — ему отдавайте уже
развёрнутый документ.

`validateFormSchema` документ не разворачивает и с обёрткой: ему передавайте
`expandOperators(rawDocument, operators)`.

## Подводные камни

- **Строка `$money(RUB)` дошла до компонента как есть.** Документ не развернули. Сборка и
  `validateFormSchema` считают незнакомую строку в пропсах и тексте обычным значением и не
  жалуются.
- **Проверка не видит незарегистрированную валюту.** В исходном документе `$money(EUR)` — просто
  строка. Проверяйте развёрнутый документ: в нём `validateFormSchema` скажет
  `unknown fn "money.EUR"`.
- **Свой оператор с именем встроенного не вызывается.** Встроенные операторы пропускаются раньше
  своих, поэтому оператор `model` или `fn` в списке никогда не сработает.
- **Оператор вернул другой свой оператор.** Документ разворачивается за один проход: результат
  оператора повторно не разбирается. Возвращайте литерал или встроенный оператор.
- **Обёртка реестра перестала разворачивать.** Реестр после неё прошёл через `composeRegistries`.
  Оборачивайте последним.

## См. также

- [Формат документа](./document-format.md) — встроенные операторы и где они действуют.
- [Реестр](./registry.md) — `reg.fn`, `reg.dataSource`, `reg.locale`.
- [Проверка документа](./document-check.md) — `validateFormSchema` и мета-схема.
