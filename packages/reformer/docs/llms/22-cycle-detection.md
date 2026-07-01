# Cycle Detection — предотвращение «Cycle detected»

## Как устроено под M1

Behaviors на сигналах уже защищены от типичных циклов:

- `compute`/`computeFrom` пишут в цель только если значение изменилось (**peek-guard**), а цель
  не входит в источники → сходящийся пересчёт не зацикливается;
- `transformValue`/`resetWhen`/`syncFields`/`enableWhen` откладывают запись состояния вне
  effect-контекста (`runOutsideEffect` / микротаск) — эффект «читает и пишет один сигнал» не падает;
- `onChange`-колбэк выполняется вне effect-контекста, поэтому в нём можно свободно писать сигналы/ноды.

Тебе НЕ нужно вручную ставить `{ immediate: false }`, guard'ить `disabled.value` перед
`disable()` или сравнивать значения перед записью — это делается внутри операторов.

## Когда всё-таки возникает «Cycle detected»

### 1. Расходящийся взаимный compute

Два вычисления, которые бесконечно гоняют значение друг у друга без стабилизации:

```typescript
// ❌ расходится → preact бросает «Cycle detected»
compute(model.$.a, () => model.b + 1);
compute(model.$.b, () => model.a + 1);
```

DSL перехватывает это и заменяет понятной ошибкой с именем поля и подсказкой. Решение —
однонаправленная зависимость или стабилизирующее условие `when`:

```typescript
// ✅ одно направление
compute(model.$.total, () => model.price * model.qty);

// ✅ стабилизация условием
compute(model.$.a, () => model.b + 1, { when: () => model.a !== model.b + 1 });
```

### 2. Неидемпотентный transformValue

`transformValue` пишет обратно в то же поле. Если `f(f(x)) !== f(x)` — цикл:

```typescript
// ❌ f(f(x)) = "prefix-prefix-x" ≠ f(x)
transformValue(model.$.field, (v) => `prefix-${v}`);

// ✅ guard «уже преобразовано»
transformValue(model.$.field, (v) => (v?.startsWith('prefix-') ? v : `prefix-${v}`));
```

### 3. Условие `resetWhen`/`copyFrom`, читающее собственную цель

Если условие зависит от значения целевого поля — сброс/копия триггерит своё же условие:

```typescript
// ❌ самотриггер — условие читает cardNumber (цель)
resetWhen(model.$.cardNumber, () => model.cardNumber !== '');

// ✅ условие зависит только от независимого поля
resetWhen(model.$.cardNumber, () => model.paymentType !== 'card', { resetValue: '' });
```

## Prefer built-in operators over manual logic

Вместо ручной сборки reset-on-disable через `onChange` — используй `enableWhen({ resetOnDisable })`:

```typescript
// ✅ SIMPLE — enableWhen с resetOnDisable (рекомендуется)
enableWhen(model.$.vehicleVin, () => model.insuranceType === 'casco', { resetOnDisable: true });
enableWhen(model.$.vehicleBrand, () => model.insuranceType === 'casco', { resetOnDisable: true });
```

`enableWhen` принимает и **массив** целей, и группу — можно включать несколько полей одним условием:

```typescript
enableWhen([model.$.propertyValue, model.$.initialPayment], () => model.loanType === 'mortgage', {
  resetOnDisable: true,
});
```

## Key Rules

1. Производные значения — через `compute`/`computeFrom` (peek-guard встроен), не ручным `onChange` + запись.
2. `transformValue`-трансформер должен быть идемпотентным (`f(f(x)) === f(x)`).
3. Условие `resetWhen`/`copyFrom`/`enableWhen` НЕ должно читать собственную цель.
4. Расходящийся взаимный `compute` — разорви однонаправленной зависимостью или `when`.
