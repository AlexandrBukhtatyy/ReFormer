---
sidebar_position: 2
---

# Условная логика

В этом уроке вы узнаете, как показывать/скрывать поля, включать/выключать их и применять условную валидацию на основе значений других полей.

## Что вы узнаете

- Как условно показывать/скрывать поля
- Как динамически включать/выключать поля
- Как применять условную валидацию
- Как условно синхронизировать значения полей

## Зачем использовать условную логику?

Формы часто должны адаптироваться на основе ввода пользователя:
- Показывать дополнительные поля только когда они актуальны
- Блокировать поля, зависящие от других выборов
- Применять разные правила валидации в зависимости от контекста
- Синхронизировать связанные поля

## Условная видимость

Создадим форму доставки, которая показывает разные поля в зависимости от способа доставки:

```typescript title="src/components/ShippingForm/form.ts"
import { GroupNode } from 'reformer';
import { required } from 'reformer/validators';
import { visible } from 'reformer/behaviors';

interface ShippingFormData {
  shippingMethod: 'standard' | 'express' | 'pickup';
  address: string;
  deliveryDate: string;
  storeLocation: string;
}

export const shippingForm = new GroupNode<ShippingFormData>({
  form: {
    shippingMethod: { value: 'standard' },
    address: { value: '' },
    deliveryDate: { value: '' },
    storeLocation: { value: '' },
  },
  validation: (path, { when }) => {
    required(path.shippingMethod);

    // Адрес обязателен только для обычной/экспресс доставки
    when(
      () => {
        const method = shippingForm.controls.shippingMethod.value;
        return method === 'standard' || method === 'express';
      },
      (path) => {
        required(path.address);
      }
    );

    // Дата доставки обязательна только для экспресс
    when(
      () => shippingForm.controls.shippingMethod.value === 'express',
      (path) => {
        required(path.deliveryDate);
      }
    );

    // Местоположение магазина обязательно только для самовывоза
    when(
      () => shippingForm.controls.shippingMethod.value === 'pickup',
      (path) => {
        required(path.storeLocation);
      }
    );
  },
  behaviors: (path, { use }) => [
    // Показывать адрес только для обычной/экспресс доставки
    use(visible(
      path.address,
      [path.shippingMethod],
      (method) => method === 'standard' || method === 'express'
    )),

    // Показывать дату доставки только для экспресс
    use(visible(
      path.deliveryDate,
      [path.shippingMethod],
      (method) => method === 'express'
    )),

    // Показывать местоположение магазина только для самовывоза
    use(visible(
      path.storeLocation,
      [path.shippingMethod],
      (method) => method === 'pickup'
    )),
  ],
});
```

### Понимание условных поведений

- **`visible(target, deps, condition)`** — управляет видимостью поля
- **`when(condition, validations)`** — применяет валидацию условно
- **`condition`** — функция, возвращающая boolean
- **`deps`** — поля для отслеживания изменений

## React-компонент

```tsx title="src/components/ShippingForm/index.tsx"
import { useFormControl } from 'reformer';
import { shippingForm } from './form';

export function ShippingForm() {
  const shippingMethod = useFormControl(shippingForm.controls.shippingMethod);
  const address = useFormControl(shippingForm.controls.address);
  const deliveryDate = useFormControl(shippingForm.controls.deliveryDate);
  const storeLocation = useFormControl(shippingForm.controls.storeLocation);

  return (
    <form>
      <div>
        <label>Способ доставки</label>
        <select
          value={shippingMethod.value}
          onChange={(e) => shippingMethod.setValue(e.target.value as any)}
        >
          <option value="standard">Обычная доставка</option>
          <option value="express">Экспресс-доставка</option>
          <option value="pickup">Самовывоз</option>
        </select>
      </div>

      {/* Условно показываемые поля */}
      {address.visible && (
        <div>
          <label htmlFor="address">Адрес доставки</label>
          <input
            id="address"
            value={address.value}
            onChange={(e) => address.setValue(e.target.value)}
            onBlur={() => address.markAsTouched()}
          />
          {address.touched && address.errors?.required && (
            <span className="error">Адрес обязателен</span>
          )}
        </div>
      )}

      {deliveryDate.visible && (
        <div>
          <label htmlFor="deliveryDate">Предпочтительная дата доставки</label>
          <input
            id="deliveryDate"
            type="date"
            value={deliveryDate.value}
            onChange={(e) => deliveryDate.setValue(e.target.value)}
            onBlur={() => deliveryDate.markAsTouched()}
          />
          {deliveryDate.touched && deliveryDate.errors?.required && (
            <span className="error">Дата доставки обязательна</span>
          )}
        </div>
      )}

      {storeLocation.visible && (
        <div>
          <label htmlFor="storeLocation">Местоположение магазина</label>
          <select
            id="storeLocation"
            value={storeLocation.value}
            onChange={(e) => storeLocation.setValue(e.target.value)}
            onBlur={() => storeLocation.markAsTouched()}
          >
            <option value="">Выберите магазин</option>
            <option value="downtown">Центр города</option>
            <option value="mall">Торговый центр</option>
            <option value="airport">Аэропорт</option>
          </select>
          {storeLocation.touched && storeLocation.errors?.required && (
            <span className="error">Местоположение магазина обязательно</span>
          )}
        </div>
      )}

      <button type="submit" disabled={!shippingForm.valid}>
        Продолжить
      </button>
    </form>
  );
}
```

### Проверка видимости

- **`field.visible`** — булево свойство, указывающее, должно ли поле отображаться
- Реагируйте на изменения видимости автоматически с помощью `useFormControl`

## Условное включение/выключение

Используйте поведение `disabled` для включения/выключения полей:

```typescript
import { disabled } from 'reformer/behaviors';

behaviors: (path, { use }) => [
  // Выключить поле на основе условия
  use(disabled(
    path.promoCode,
    [path.totalAmount],
    (totalAmount) => totalAmount < 50 // Выключить если сумма < $50
  )),
]
```

В React:

```tsx
const promoCode = useFormControl(form.controls.promoCode);

<input
  value={promoCode.value}
  onChange={(e) => promoCode.setValue(e.target.value)}
  disabled={promoCode.disabled}
/>
```

## Синхронизация полей

Синхронизируйте поля условно:

```typescript
import { sync } from 'reformer/behaviors';

behaviors: (path, { use }) => [
  // Копировать адрес оплаты в адрес доставки при установке флажка
  use(sync(
    path.shippingAddress,
    [path.billingAddress, path.sameAsBilling],
    (billingAddress, sameAsBilling) =>
      sameAsBilling ? billingAddress : undefined
  )),
]
```

## Сложные условия

Условия могут быть сколь угодно сложными:

```typescript
use(visible(
  path.taxId,
  [path.accountType, path.country, path.annualRevenue],
  (accountType, country, annualRevenue) => {
    // Показывать ИНН для бизнес-аккаунтов в определенных странах
    // с доходом выше порога
    return accountType === 'business' &&
           ['US', 'CA', 'UK'].includes(country) &&
           annualRevenue > 50000;
  }
))
```

## Условная валидация

Применяйте разные валидаторы на основе условий:

```typescript
validation: (path, { when }) => {
  // Всегда обязательно
  required(path.email);

  // Дополнительная валидация для бизнес-аккаунта
  when(
    () => form.controls.accountType.value === 'business',
    (path) => {
      required(path.companyName);
      required(path.taxId);
      required(path.businessEmail);
      email(path.businessEmail);
    }
  );
}
```

## Попробуйте

1. Измените способ доставки на "Экспресс" → появится поле даты доставки
2. Измените на "Самовывоз" → появится селектор местоположения магазина
3. Измените на "Обычная" → показывается только поле адреса
4. Обратите внимание, что валидация адаптируется к видимым полям

## Ключевые концепции

- **`visible(target, deps, condition)`** — показывает/скрывает поля
- **`disabled(target, deps, condition)`** — включает/выключает поля
- **`sync(target, deps, calculator)`** — синхронизирует значения полей
- **`when(condition, validations)`** — условная валидация
- **`field.visible`** — проверить, должно ли поле отображаться
- **`field.disabled`** — проверить, должно ли поле быть заблокировано
- **Динамические формы** — адаптация к вводу пользователя в реальном времени

## Что дальше?

В следующем уроке мы изучим **Асинхронную валидацию** — как валидировать поля с помощью серверных данных, например, проверять доступность имени пользователя.
