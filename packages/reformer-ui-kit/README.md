# @reformer/ui-kit

Готовые компоненты для форм `@reformer/core` на базе [shadcn/ui](https://ui.shadcn.com/) (стиль
**new-york**, палитра **neutral**, Tailwind CSS v4): 76 компонентов, каждый — свой вход пакета.
Поля формы кладутся в схему как есть: связку с формой объявляет статика `reformerAdapter`, а
подключает поле один универсальный `<FormField>` или рендерер. Headless-основа —
[`@reformer/cdk`](https://www.npmjs.com/package/@reformer/cdk).

## Установка

```bash
npm install @reformer/ui-kit @reformer/core @reformer/cdk
```

Peer-зависимости: `@reformer/core`, `@reformer/cdk`, `react` и `react-dom` 18 или 19. Тяжёлым
компонентам нужны свои необязательные peer-зависимости (recharts, `@tanstack/react-table`,
react-day-picker, date-fns, cmdk, vaul, embla-carousel-react, sonner, input-otp,
react-resizable-panels, `@shadcn/react`) — ставьте их, только если берёте этот компонент.

Тема — голым импортом во входе Tailwind v4 приложения:

```css
@import 'tailwindcss';
@import '@reformer/ui-kit/styles';

/* Tailwind должен видеть классы пакета */
@source '../node_modules/@reformer/ui-kit/dist';
```

Обёртка `layer(theme)` вокруг импорта ломает `@custom-variant`. Сам Tailwind и `@source` — забота
приложения: тема отдаёт токены oklch, тёмный вариант и анимации.

## Быстрый старт

```tsx
import { createForm } from '@reformer/core';
import { useFormBundle } from '@reformer/core/react';
import { defineValidation, validate } from '@reformer/core/validation';
import { required } from '@reformer/core/validators';
import { Button, FormField, InputNumber, SelectAsync } from '@reformer/ui-kit';

type LoanForm = { loanType: string | null; amount: number | null };

const createLoanForm = () =>
  createForm<LoanForm>({
    initial: { loanType: null, amount: null },
    // Компонент и его пропсы объявляются в узле схемы; правил в схеме нет.
    schema: (model) => ({
      children: [
        {
          model: model.$.loanType,
          component: SelectAsync,
          componentProps: {
            label: 'Тип кредита',
            options: [
              { value: 'consumer', label: 'Потребительский' },
              { value: 'mortgage', label: 'Ипотека' },
            ],
          },
        },
        {
          model: model.$.amount,
          component: InputNumber,
          componentProps: { label: 'Сумма', min: 0 },
        },
      ],
    }),
    validation: defineValidation<LoanForm>(({ model }) => {
      validate(model.$.loanType, [required()]);
      validate(model.$.amount, [required()]);
    }),
  });

export function LoanFormExample() {
  const loan = useFormBundle(createLoanForm);
  const send = async (event: React.FormEvent) => {
    event.preventDefault();
    await loan.submission.submit((values) => console.log(values));
  };
  return (
    <form onSubmit={send} className="space-y-4">
      {/* FormField рисует подпись → поле → ошибку и связывает value/onChange/onBlur ноды */}
      <FormField control={loan.form.loanType} />
      <FormField control={loan.form.amount} />
      <Button type="submit">Отправить</Button>
    </form>
  );
}
```

В `component` кладут сам компонент. Составные примитивы (`Select`, `RadioGroup`, `Calendar`, …) в
форму не идут — для формы есть варианты, которые рисуют пункты из `options`: `SelectAsync`,
`RadioGroupOptions`, `CalendarSingle`, `CheckboxWithLabel`, `NativeSelectWithOptions`. Числа —
`InputNumber`, подсказки при вводе — `InputSuggest`. Полная таблица «компонент → вариант для
формы → имя в реестре JSON» — в [`docs/llms/01-overview.md`](./docs/llms/01-overview.md).

## Входы пакета

| Импорт                                                          | Что внутри                                                                                                                                                                                      |
| --------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `@reformer/ui-kit`                                              | 63 «лёгких» компонента, в том числе `FormField`, `Box`, `Section`, `Button`, `Input`, `SelectAsync`                                                                                             |
| `@reformer/ui-kit/<компонент>`                                  | один компонент и его варианты: `input`, `select`, `checkbox`, `field-array`, `form-wizard`, … (76 входов)                                                                                       |
| `@reformer/ui-kit/calendar`, `/chart`, `/table`, …              | только отдельным входом, вне корня: `calendar`, `carousel`, `chart`, `combobox`, `command`, `date-picker`, `drawer`, `input-otp`, `message-scroller`, `resizable`, `sidebar`, `sonner`, `table` |
| `@reformer/ui-kit/fields`                                       | `defineFieldControl` и пресеты адаптеров (`checkedAdapter`, `valueChangeAdapter`, …) — свой контрол как поле                                                                                    |
| `@reformer/ui-kit/meta`                                         | props-схемы компонентов без React (`defaultPropSchemas`, `mergeFieldPropsSchema`) — для MCP и JSON                                                                                              |
| `@reformer/ui-kit/catalog`                                      | `component-catalog.json` — каталог компонентов для билдера и генераторов                                                                                                                        |
| `@reformer/ui-kit/styles`                                       | тема Tailwind v4: токены, тёмный вариант, анимации                                                                                                                                              |
| `@reformer/ui-kit/locale`, `/locale/en`, `/locale/ru`, `*.json` | `loadKitLocale` — строки кита вместе с ядром и cdk                                                                                                                                              |

Свой контрол подключается той же статикой:

```tsx
import { defineFieldControl, checkedAdapter } from '@reformer/ui-kit/fields';

export const MyCheckbox = defineFieldControl(ThirdPartyCheckbox, { adapter: checkedAdapter });
// схема: { model: model.$.agree, component: MyCheckbox }
```

## Ссылки

- Документация: [обзор UI Kit](https://alexandrbukhtatyy.github.io/ReFormer/docs/ui-kit/overview) и
  страницы компонентов в том же разделе
- Рецепты для ИИ-ассистентов: [`docs/llms`](./docs/llms) — `overview`, `text-fields`,
  `choice-fields`, `form-field-integration`, `form-layout`, `form-wizard`, `field-array-section`
- MCP-сервер для ИИ-ассистентов: [`@reformer/mcp`](https://www.npmjs.com/package/@reformer/mcp)

## License

MIT
