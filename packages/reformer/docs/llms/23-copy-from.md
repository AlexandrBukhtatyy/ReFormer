# copyFrom — Копирование значений между полями

## Purpose

`copyFrom` декларативно копирует значение одного поля (или группы) в другое при выполнении условия `when`. Используется для UX-сценариев «совпадает с …»: «адрес проживания совпадает с адресом регистрации», «email для уведомлений = основной email», «billing = shipping». Альтернатива ручному `watchField` + `setValue` с управлением циклами — `copyFrom` сам выходит из reactive-контекста через `runOutsideEffect`.

## API

```typescript
function copyFrom<TForm, TSource, TTarget>(
  source: FieldPathNode<TForm, TSource>,
  target: FieldPathNode<TForm, TTarget>,
  options?: CopyFromOptions<TSource, TForm>
): void;

interface CopyFromOptions<TSource, TForm = unknown> {
  /** Условие копирования. Если не задано — копирует всегда при изменении source. */
  when?: (form: TForm) => boolean;

  /** Какие поля копировать для группы. По умолчанию 'all'. */
  fields?: (keyof TSource)[] | 'all';

  /** Преобразование значения перед записью в target. */
  transform?: (value: TSource) => unknown;

  /** Debounce срабатывания в миллисекундах. */
  debounce?: number;
}
```

Вызывается строго внутри `BehaviorSchemaFn` (поведенческой схемы формы). Возвращает `void`; cleanup управляется реестром поведения формы.

## Examples

### Базовый сценарий — синхронизация двух адресов целиком

```typescript
import { copyFrom, type BehaviorSchemaFn } from '@reformer/core/behaviors';

interface OrderForm {
  useShippingAsBilling: boolean;
  shippingAddress: string;
  billingAddress: string;
}

export const orderBehavior: BehaviorSchemaFn<OrderForm> = (path) => {
  copyFrom(path.shippingAddress, path.billingAddress, {
    when: (form) => form.useShippingAsBilling === true,
  });
};
```

Source: `BehaviorsExamples.tsx:227` (monorepo example).

### Копирование группы — только выбранные подполя

```typescript
import { copyFrom, type BehaviorSchemaFn } from '@reformer/core/behaviors';

interface Address {
  country: string;
  region: string;
  city: string;
  street: string;
  postalCode: string;
}

interface ProfileForm {
  sameAsRegistration: boolean;
  registrationAddress: Address;
  residenceAddress: Address;
}

export const profileBehavior: BehaviorSchemaFn<ProfileForm> = (path) => {
  // Копируем только country/region/city, локальные значения street сохраняем
  copyFrom(path.registrationAddress, path.residenceAddress, {
    when: (form) => form.sameAsRegistration === true,
    fields: ['country', 'region', 'city'],
  });
};
```

### Совмещение с `apply([...])` — переиспользование между несколькими полями

```typescript
import { copyFrom, apply, type BehaviorSchemaFn } from '@reformer/core/behaviors';

interface AddressBlock {
  source: string;
  copy: string;
  copyEnabled: boolean;
}

const addressCopyBehavior: BehaviorSchemaFn<AddressBlock> = (path) => {
  copyFrom(path.source, path.copy, {
    when: (form) => form.copyEnabled === true,
  });
};

interface ProfileForm {
  homeAddress: AddressBlock;
  workAddress: AddressBlock;
}

export const profileBehavior: BehaviorSchemaFn<ProfileForm> = (path) => {
  // Применяем одну схему копирования к двум вложенным группам
  apply([path.homeAddress, path.workAddress], addressCopyBehavior);
};
```

Source: `credit-application-behavior.ts:69-79` (monorepo example).

### Copy + transform — нормализация при копировании

```typescript
import { copyFrom, type BehaviorSchemaFn } from '@reformer/core/behaviors';

interface ContactForm {
  sameEmail: boolean;
  email: string;
  emailAdditional: string;
}

export const contactBehavior: BehaviorSchemaFn<ContactForm> = (path) => {
  copyFrom(path.email, path.emailAdditional, {
    when: (form) => form.sameEmail === true,
    transform: (value) => (typeof value === 'string' ? value.trim().toLowerCase() : value),
    debounce: 200,
  });
};
```

## Anti-patterns

```typescript
// ❌ Ручной watchField с setValue — пишите copyFrom
watchField(path.shippingAddress, (value, ctx) => {
  if (ctx.form.useShippingAsBilling.value.value) {
    ctx.form.billingAddress.setValue(value); // приведёт к "Cycle detected" без runOutsideEffect
  }
});

// ✅ copyFrom уже использует runOutsideEffect внутри
copyFrom(path.shippingAddress, path.billingAddress, {
  when: (form) => form.useShippingAsBilling === true,
});
```

```typescript
// ❌ Не пытайтесь вернуть данные обратно — copyFrom однонаправленный
copyFrom(path.a, path.b);
copyFrom(path.b, path.a); // ЦИКЛ! Используйте syncFields для двусторонней связи

// ✅ Двусторонняя синхронизация — это работа syncFields
syncFields(path.a, path.b);
```

```typescript
// ❌ when, который читает само target-поле
copyFrom(path.source, path.target, {
  when: (form) => form.target === '', // лишний triger при перезаписи target
});

// ✅ when опирается только на флаг/независимое поле
copyFrom(path.source, path.target, {
  when: (form) => form.copyEnabled === true,
});
```

```typescript
// ❌ Передача fields для не-групповых полей
copyFrom(path.email, path.emailCopy, { fields: ['something'] }); // fields игнорируется для скаляров

// ✅ Для скаляров — без fields, или fields: 'all'
copyFrom(path.email, path.emailCopy);
```

## Troubleshooting

**Q: Скопированное значение не появляется в target.**
A: Проверьте, что (1) вы внутри `BehaviorSchemaFn`, переданной в `createForm({ behavior })`; (2) `when` возвращает `true` (поставьте `console.log` в `when`); (3) тип source/target совместим — `copyFrom` записывает значение «как есть», без неявных конверсий.

**Q: «Cycle detected» при копировании.**
A: Это происходит, если `when` использует значение target-поля (см. anti-pattern выше) или вы дополнительно навесили `watchField`/`computeFrom` на target. Изолируйте триггеры: condition должно зависеть только от source и от независимых флагов.

**Q: Целевая группа теряет несколько полей.**
A: По умолчанию `fields: 'all'` копирует **всё значение** через `setValue`, перетирая поля, которых нет в source. Если нужно сохранить часть target — укажите `fields: ['onlyThese']`, тогда применится `patchValue` (мердж).

**Q: copyFrom не реагирует на загрузку начальных значений.**
A: `copyFrom` подписывается на изменения source через `watchField` без `immediate`. Первичное копирование произойдёт при первом изменении source. Для синхронизации сразу после `patchValue` — вызывайте `patchValue` для target вручную в hooks загрузки (см. [29-async-preload.md](./29-async-preload.md)).

**Q: Как откатить копию, если пользователь снял флаг `when`?**
A: `copyFrom` сам по себе не сбрасывает target при `when === false` — он только не пишет. Для сброса параллельно используйте `resetWhen(path.target, (form) => !form.copyEnabled)` (см. [25-reset-when.md](./25-reset-when.md)).

## See also

- [24-sync-fields.md](./24-sync-fields.md) — двусторонняя синхронизация
- [25-reset-when.md](./25-reset-when.md) — сброс target при выключенном условии
- [11-async-watchfield.md](./11-async-watchfield.md) — низкоуровневый `watchField`, на котором построен `copyFrom`
- [22-cycle-detection.md](./22-cycle-detection.md) — почему `runOutsideEffect` нужен и как его избежать руками
