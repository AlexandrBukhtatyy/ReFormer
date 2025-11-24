---
sidebar_position: 1
---

# Вычисляемые поля

В этом уроке вы узнаете, как создавать поля, которые автоматически вычисляют свои значения на основе других полей с помощью поведений.

## Что вы узнаете

- Как создавать вычисляемые поля с помощью поведений
- Как определять зависимости между полями
- Как реализовывать автоматические расчеты
- Как использовать вычисляемые значения в формах

## Зачем использовать вычисляемые поля?

Вычисляемые поля автоматически обновляются при изменении зависимостей:
- Вычисление общей цены из количества и цены за единицу
- Генерация полного имени из имени и фамилии
- Вычисление возраста из даты рождения
- Расчет суммы налога из промежуточного итога

## Создание вычисляемого поля

Создадим форму корзины, которая автоматически вычисляет итоговую сумму:

```typescript title="src/components/CartForm/form.ts"
import { GroupNode } from 'reformer';
import { required, min } from 'reformer/validators';
import { computed } from 'reformer/behaviors';

interface CartItemData {
  productName: string;
  quantity: number;
  unitPrice: number;
  total: number; // Вычисляемое!
}

export const cartForm = new GroupNode<CartItemData>({
  form: {
    productName: { value: '' },
    quantity: { value: 1 },
    unitPrice: { value: 0 },
    total: { value: 0 },
  },
  validation: (path) => {
    required(path.productName);
    required(path.quantity);
    min(path.quantity, 1);
    required(path.unitPrice);
    min(path.unitPrice, 0);
  },
  behaviors: (path, { use }) => [
    use(computed(
      path.total,
      [path.quantity, path.unitPrice],
      (quantity, unitPrice) => quantity * unitPrice
    )),
  ],
});
```

### Понимание вычисляемого поведения

- **`behaviors`** — функция для определения реактивных поведений
- **`computed(target, dependencies, calculator)`** — создает вычисляемое поле
- **`target`** — поле для обновления (path.total)
- **`dependencies`** — поля для отслеживания (path.quantity, path.unitPrice)
- **`calculator`** — функция, вычисляющая значение

## Как это работает

Когда зависимости изменяются, вычисляемое поле обновляется автоматически:

```typescript
// Начальное состояние
console.log(cartForm.value);
// { productName: '', quantity: 1, unitPrice: 0, total: 0 }

// Изменяем количество
cartForm.controls.quantity.setValue(5);
console.log(cartForm.controls.total.value); // 0 (5 * 0)

// Изменяем цену за единицу
cartForm.controls.unitPrice.setValue(10);
console.log(cartForm.controls.total.value); // 50 (5 * 10)

// Итоговая сумма обновляется автоматически!
```

## React-компонент

```tsx title="src/components/CartForm/index.tsx"
import { useFormControl } from 'reformer';
import { cartForm } from './form';

export function CartForm() {
  const productName = useFormControl(cartForm.controls.productName);
  const quantity = useFormControl(cartForm.controls.quantity);
  const unitPrice = useFormControl(cartForm.controls.unitPrice);
  const total = useFormControl(cartForm.controls.total);

  return (
    <form>
      <div>
        <label htmlFor="productName">Название товара</label>
        <input
          id="productName"
          value={productName.value}
          onChange={(e) => productName.setValue(e.target.value)}
        />
      </div>

      <div>
        <label htmlFor="quantity">Количество</label>
        <input
          id="quantity"
          type="number"
          value={quantity.value}
          onChange={(e) => quantity.setValue(Number(e.target.value))}
        />
      </div>

      <div>
        <label htmlFor="unitPrice">Цена за единицу ($)</label>
        <input
          id="unitPrice"
          type="number"
          step="0.01"
          value={unitPrice.value}
          onChange={(e) => unitPrice.setValue(Number(e.target.value))}
        />
      </div>

      <div>
        <label>Итого</label>
        <strong>${total.value.toFixed(2)}</strong>
      </div>

      <button type="submit">Добавить в корзину</button>
    </form>
  );
}
```

## Множественные зависимости

Вычисляемые поля могут зависеть от нескольких полей:

```typescript
interface InvoiceData {
  subtotal: number;
  taxRate: number;
  discount: number;
  total: number;
}

behaviors: (path, { use }) => [
  use(computed(
    path.total,
    [path.subtotal, path.taxRate, path.discount],
    (subtotal, taxRate, discount) => {
      const tax = subtotal * (taxRate / 100);
      return subtotal + tax - discount;
    }
  )),
]
```

## Вычисление из вложенных полей

Можно вычислять значения из вложенных структур:

```typescript
interface OrderData {
  customer: {
    firstName: string;
    lastName: string;
  };
  fullName: string; // Вычисляется из вложенных полей
}

behaviors: (path, { use }) => [
  use(computed(
    path.fullName,
    [path.customer.firstName, path.customer.lastName],
    (firstName, lastName) => `${firstName} ${lastName}`.trim()
  )),
]
```

## Вычисляемые поля только для чтения

Вычисляемые поля обычно доступны только для чтения в UI:

```tsx
<div>
  <label>Полное имя</label>
  <input
    value={fullName.value}
    readOnly
    disabled
  />
</div>

{/* Или просто отобразить */}
<div>
  <label>Полное имя</label>
  <strong>{fullName.value}</strong>
</div>
```

## Сложные вычисления

Функции-калькуляторы могут выполнять любые вычисления:

```typescript
use(computed(
  path.discount,
  [path.subtotal, path.couponCode],
  (subtotal, couponCode) => {
    if (couponCode === 'SAVE10') return subtotal * 0.1;
    if (couponCode === 'SAVE20') return subtotal * 0.2;
    return 0;
  }
))
```

## Цепочки вычисляемых полей

Одно вычисляемое поле может зависеть от другого:

```typescript
behaviors: (path, { use }) => [
  // Сначала: вычисляем промежуточный итог
  use(computed(
    path.subtotal,
    [path.quantity, path.unitPrice],
    (quantity, unitPrice) => quantity * unitPrice
  )),

  // Затем: вычисляем налог на основе промежуточного итога
  use(computed(
    path.tax,
    [path.subtotal, path.taxRate],
    (subtotal, taxRate) => subtotal * (taxRate / 100)
  )),

  // Наконец: вычисляем итоговую сумму
  use(computed(
    path.total,
    [path.subtotal, path.tax],
    (subtotal, tax) => subtotal + tax
  )),
]
```

## Попробуйте

1. Измените количество → увидите автоматическое обновление итога
2. Измените цену за единицу → итог пересчитается мгновенно
3. Поле итога всегда синхронизировано с зависимостями

## Ключевые концепции

- **`behaviors`** — функция для определения реактивных поведений
- **`computed(target, deps, calc)`** — создает вычисляемое поле
- **`target`** — поле для автоматического обновления
- **`dependencies`** — поля для отслеживания изменений
- **`calculator`** — функция, вычисляющая новое значение
- **Автоматические обновления** — вычисляемые поля обновляются при изменении зависимостей
- **Типобезопасность** — зависимости и калькулятор полностью типизированы

## Что дальше?

В следующем уроке мы изучим **Условную логику** — как показывать/скрывать поля и изменять валидацию на основе значений других полей.
