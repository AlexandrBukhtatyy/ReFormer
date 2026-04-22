# План: Фикс багов в complex-multy-step-form

## Контекст

QA-аудит `complex-multy-step-form` через Playwright MCP выявил 9 багов в форме и базовой библиотеке ReFormer. Баги разделены по блокам — от критических (блокирующих submit) до косметических.

---

## Блок 1 — Критические баги (блокируют submit формы)

### БАГ #12: `GroupNode.validate()` возвращает `false` из-за disabled-полей

**Файл:** `packages/reformer/src/core/nodes/group-node.ts:355`

**Проблема:** Метод `validate()` вызывает `field.valid.value` у всех полей, включая disabled. Disabled-поля имеют `valid.value = false`, что делает метод `validate()` всегда ложным при наличии условных полей.

**Фикс:**
```typescript
// БЫЛО:
return Array.from(this._fields.values()).every((field) => field.valid.value);

// СТАЛО:
return Array.from(this._fields.values()).every((field) => field.valid.value || field.disabled.value);
```

---

### БАГ #11: Двойная валидация в `FormWizard.submit()`

**Файл:** `packages/reformer-cdk/src/components/form-wizard/FormWizard.tsx:213`

**Проблема:** `FormWizard.submit()` вызывает `validateForm()` (строка 205), а затем `form.submit(onSubmit)` (строка 213) — `form.submit` внутри также запускает валидацию, создавая двойной цикл.

**Фикс:**
```typescript
// БЫЛО (строка 213):
return form.submit(onSubmit);

// СТАЛО:
return form.submit(onSubmit, { skipValidation: true });
```

`skipValidation: true` уже поддерживается `SubmitOptions` в `packages/reformer/src/core/utils/form-submitter.ts:110`.

---

## Блок 2 — Быстрые фиксы (косметика и UX)

### БАГ #19: Debug-текст в UI созаёмщика

**Файл:** `projects/react-playground/src/pages/examples/complex-multy-step-form/components/steps/AdditionalInfo/AdditionalInfoForm.tsx:85`

**Фикс:** Удалить prop `emptyMessageHint`:
```tsx
// УДАЛИТЬ строку:
emptyMessageHint="CoBorrowerForm поддерживает вложенную группу personalData"
```

---

### БАГ #18: Опечатка в сообщении валидации

**Файл:** `projects/react-playground/src/pages/examples/complex-multy-step-form/components/steps/BasicInfo/basic-info-validation.ts:67`

**Фикс:**
```typescript
// БЫЛО:
'Первоначальный взнос должен составлять не менее 10% от стоимость недвижимости'

// СТАЛО:
'Первоначальный взнос должен составлять не менее 10% от стоимости недвижимости'
```

---

### БАГ #17: Отображение отрицательной суммы кредита при ипотеке

**Файл:** `projects/react-playground/src/pages/examples/complex-multy-step-form/components/steps/BasicInfo/basic-info-validation.ts:79-95`

**Проблема:** Когда `initialPayment > propertyValue`, `loanAmount` вычисляется как отрицательное число, и валидация показывает ошибку "-100 000 ₽".

**Фикс:** Добавить guard в `validateTree` для `loanAmount`:
```typescript
// Добавить в applyWhen для mortgage, перед или внутри validateTree loanAmount:
validate(path.loanAmount, (v) =>
  (v ?? 0) > 0 || 'Первоначальный взнос не может превышать стоимость недвижимости'
),
```

---

## Блок 3 — Условное поле `loanPurpose`

### БАГ #14: `loanPurpose` отображается и валидируется для ипотеки и автокредита

**UI файл:** `projects/react-playground/src/pages/examples/complex-multy-step-form/components/steps/BasicInfo/BasicInfoForm.tsx`

**Фикс UI:** Завернуть `loanPurpose` в условие:
```tsx
// БЫЛО (строка 21):
<FormField control={control.loanPurpose} testId="loanPurpose" />

// СТАЛО:
{loanType !== 'mortgage' && loanType !== 'car' && (
  <FormField control={control.loanPurpose} testId="loanPurpose" />
)}
```

**Валидация файл:** `basic-info-validation.ts`

**Фикс валидации:** Переместить валидацию `loanPurpose` внутрь `applyWhen` (аналогично mortgage/car), исключив эти типы:
```typescript
applyWhen(
  path.loanType,
  (type) => type !== 'mortgage' && type !== 'car',
  [
    required(path.loanPurpose),
    minLength(path.loanPurpose, 10),
    maxLength(path.loanPurpose, 500),
  ]
),
```

---

## Блок 4 — Расследование: валидация массивов (БАГ #13)

### БАГ #13: Форма проходит submit с пустыми массивами когда `hasProperty/hasExistingLoans/hasCoBorrower = true`

**Файл:** `projects/react-playground/src/pages/examples/complex-multy-step-form/components/steps/AdditionalInfo/additional-validation.ts`

**Проблема:** `validateItems(path.properties, propertyValidation)` внутри `applyWhen` не блокирует submit при пустом массиве.

**Исследовать:**
1. Как `validateItems` обрабатывает пустой массив — возвращает `valid` или игнорирует?
2. Нужно ли добавить отдельную проверку `minLength(path.properties, 1)` вне `validateItems`?

**Возможный фикс:**
```typescript
applyWhen(path.hasProperty, Boolean, [
  minLength(path.properties, 1, 'Добавьте хотя бы одно имущество'),
  validateItems(path.properties, propertyValidation),
]),
```

**Файл для исследования:** `packages/reformer/src/core/validators/` — найти реализацию `validateItems`.

---

## Блок 5 — Отсутствующие типы кредита (БАГ #15, #16)

### БАГ #15: Кредит для бизнеса — нет полей `businessType`, `businessInn`, `businessActivity`

### БАГ #16: Рефинансирование — нет специфичных полей

**UI файл:** `BasicInfoForm.tsx`

**Фикс UI:** Добавить секции по аналогии с mortgage/car:
```tsx
{loanType === 'business' && (
  <>
    <h3 className="text-lg font-semibold mt-4">Информация о бизнесе</h3>
    <FormField control={control.businessType} testId="businessType" />
    <FormField control={control.businessInn} testId="businessInn" />
    <FormField control={control.businessActivity} testId="businessActivity" />
  </>
)}
```

**Поля в типах:** `businessType`, `businessInn`, `businessActivity` уже объявлены в `types/credit-application.ts:65-67`.

**Валидация файл:** `basic-info-validation.ts`

**Фикс валидации:** Добавить `applyWhen` блоки для `business` и `refinancing` аналогично mortgage.

---

## Порядок выполнения

```
1. БАГ #12  group-node.ts:355          — 1 строка, критический
2. БАГ #11  FormWizard.tsx:213         — 1 строка, критический
3. БАГ #19  AdditionalInfoForm.tsx:85  — удалить prop, косметика
4. БАГ #18  basic-info-validation.ts:67 — 1 слово, опечатка
5. БАГ #17  basic-info-validation.ts   — добавить guard
6. БАГ #14  BasicInfoForm.tsx + basic-info-validation.ts — условный loanPurpose
7. БАГ #13  Расследование validateItems, затем фикс
8. БАГ #15  BasicInfoForm.tsx + basic-info-validation.ts — поля бизнеса
9. БАГ #16  BasicInfoForm.tsx + basic-info-validation.ts — поля рефинансирования
```

---

## Верификация

```bash
# После фиксов 1-2: проверить submit формы в браузере
# После фикса 6: переключить loanType и убедиться что loanPurpose скрывается
# После фикса 7: включить hasProperty, не добавлять элементы, нажать "Далее" — должна быть ошибка
# После фиксов 8-9: переключить на "Бизнес" и "Рефинансирование" — должны появиться поля

# Запустить E2E тесты:
cd projects/react-playground-e2e
npx playwright test complex-multy-step-form --reporter=list
```
