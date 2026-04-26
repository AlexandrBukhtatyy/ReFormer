# resetWhen — Условный сброс полей

## Purpose

`resetWhen` сбрасывает значение поля и его `dirty/touched`-флаги при выполнении условия от формы. Это альтернатива `enableWhen({ resetOnDisable: true })`, когда поле остаётся **enabled**, но содержимое нужно очистить (например, переключение типа оплаты обнуляет «номер карты», но поле всё ещё доступно для ручного ввода). По умолчанию пишет `null`; через `resetValue` задаётся произвольное значение, через `onlyIfDirty` — пропуск нетронутых пользователем полей.

## API

```typescript
function resetWhen<TForm extends FormFields>(
  field: FieldPathNode<TForm, FormValue>,
  condition: (form: TForm) => boolean,
  options?: ResetWhenOptions & { debounce?: number },
): void;

interface ResetWhenOptions {
  /** Значение, в которое сбрасывается поле. По умолчанию null. */
  resetValue?: FormValue;

  /** Сбрасывать только если поле dirty (пользователь его трогал). */
  onlyIfDirty?: boolean;
}
```

После сброса `markAsPristine()` и `markAsUntouched()` вызываются автоматически.

## Examples

### Базовый сценарий — сброс номера карты при смене способа оплаты

```typescript
import { resetWhen, type BehaviorSchemaFn } from '@reformer/core/behaviors';

interface CheckoutForm {
  paymentType: 'card' | 'cash';
  cardNumber: string;
}

export const checkoutBehavior: BehaviorSchemaFn<CheckoutForm> = (path) => {
  resetWhen(path.cardNumber, (form) => form.paymentType !== 'card', {
    resetValue: '',
  });
};
```

Source: [BehaviorsExamples.tsx:243-245](../../../../projects/react-playground/src/pages/examples/behaviors/BehaviorsExamples.tsx).

### С `resetValue` для числовых полей

```typescript
import { resetWhen, type BehaviorSchemaFn } from '@reformer/core/behaviors';

interface MortgageForm {
  loanType: 'mortgage' | 'consumer' | 'car';
  propertyValue: number;
  initialPayment: number;
}

export const mortgageBehavior: BehaviorSchemaFn<MortgageForm> = (path) => {
  // initialPayment теряет смысл без propertyValue — сбрасываем в 0
  resetWhen(path.initialPayment, (form) => !form.propertyValue, {
    resetValue: 0,
  });
};
```

### `onlyIfDirty` — не трогаем нетронутое поле

```typescript
import { resetWhen, type BehaviorSchemaFn } from '@reformer/core/behaviors';

interface CarForm {
  loanType: 'mortgage' | 'car' | 'consumer';
  carPrice: number;
}

export const carBehavior: BehaviorSchemaFn<CarForm> = (path) => {
  // Если пользователь ещё не вводил carPrice, не сбрасываем (не сломаем default)
  resetWhen(path.carPrice, (form) => form.loanType !== 'car', {
    resetValue: null,
    onlyIfDirty: true,
  });
};
```

### С `apply([...])` — общая логика для нескольких блоков

```typescript
import { resetWhen, apply, type BehaviorSchemaFn } from '@reformer/core/behaviors';

interface AddressBlock {
  enabled: boolean;
  city: string;
  street: string;
}

const addressResetBehavior: BehaviorSchemaFn<AddressBlock> = (path) => {
  resetWhen(path.city, (form) => !form.enabled, { resetValue: '' });
  resetWhen(path.street, (form) => !form.enabled, { resetValue: '' });
};

interface ProfileForm {
  homeAddress: AddressBlock;
  workAddress: AddressBlock;
}

export const profileBehavior: BehaviorSchemaFn<ProfileForm> = (path) => {
  apply([path.homeAddress, path.workAddress], addressResetBehavior);
};
```

## Anti-patterns

```typescript
// ❌ resetWhen вместо enableWhen для disable-сценария
resetWhen(path.field, (form) => !form.show);
// поле останется enabled и валидируемым, ошибка required всё равно прилетит

// ✅ Если поле должно «исчезнуть», блокируем + сбрасываем
enableWhen(path.field, (form) => form.show, { resetOnDisable: true });
```

```typescript
// ❌ Сложная логика «обновить + сбросить» через ручной watchField + setValue
watchField(path.type, (_v, ctx) => {
  ctx.form.dependent.setValue(null);
  ctx.form.dependent.markAsPristine(); // забыли markAsUntouched? валидация не очистится
});

// ✅ resetWhen делает все три действия атомарно
resetWhen(path.dependent, (form) => form.type !== 'expected', { resetValue: null });
```

```typescript
// ❌ resetValue с типом, отличным от поля
resetWhen(path.amount, (form) => form.skipPayment, { resetValue: 'none' });
// рантайм-несовпадение типов: amount: number ← string

// ✅ resetValue должен быть валидным значением для FieldNode
resetWhen(path.amount, (form) => form.skipPayment, { resetValue: 0 });
```

```typescript
// ❌ Отсутствие resetValue для строкового поля
resetWhen(path.cardNumber, (form) => form.paymentType !== 'card');
// получит null, а Input ждёт string — отрисует undefined

// ✅ Явный resetValue для строк
resetWhen(path.cardNumber, (form) => form.paymentType !== 'card', { resetValue: '' });
```

## Troubleshooting

**Q: Поле сбрасывается слишком часто, по любому изменению формы.**
A: `resetWhen` подписан на `form.value.value` целиком — любое изменение формы прогоняет `condition`. Если ваш `condition` возвращает `true` стабильно, сброс происходит на каждом тике. Решение: добавьте проверку текущего значения в `condition` (`condition: (form) => form.type !== 'card' && form.cardNumber !== ''`) или поднимите `debounce`.

**Q: Сброс не срабатывает, хотя `condition` возвращает true.**
A: Опция `onlyIfDirty: true` пропустит сброс, если пользователь не трогал поле. Уберите `onlyIfDirty` или явно вызовите `field.markAsDirty()`.

**Q: После сброса валидация продолжает показывать ошибку.**
A: `resetWhen` зовёт `markAsUntouched()` — `error` остаётся, но в UI поле обычно ошибки скрыты до `touched`. Если нужна жёсткая очистка ошибки, дополнительно вызовите `field.validate()` после изменения зависимого поля или используйте `revalidateWhen`.

**Q: Реактивная цепочка resetWhen → computeFrom → resetWhen ломается.**
A: Убедитесь, что `condition` не зависит от значения **самого** поля, иначе после сброса вы попадёте в новый цикл. Сравните: `condition: (form) => form.type !== 'card'` (ок) vs `condition: (form) => form.cardNumber === ''` (плохо — самотриггер).

**Q: Сбросить вложенную группу целиком — `resetValue: {}` не работает.**
A: Для group-полей лучше использовать `field.reset()` напрямую через `watchField`, либо комбинацию `enableWhen({ resetOnDisable: true })`, которая правильно проходит по поддереву. `resetWhen` рассчитан на скалярные поля.

## See also

- [04-common-patterns.md](./04-common-patterns.md) — `enableWhen({ resetOnDisable: true })` как альтернатива
- [23-copy-from.md](./23-copy-from.md) — копирование, у которого нет встроенного отката
- [22-cycle-detection.md](./22-cycle-detection.md) — почему `condition` не должен читать целевое поле
- [11-async-watchfield.md](./11-async-watchfield.md) — низкоуровневый аналог через `watchField` + `setValue`
