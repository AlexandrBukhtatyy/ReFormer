# План: остаточный долг по e2e-тестам complex-multy-step-form

## Контекст

Сегодня сделана серия фиксов visual-тестов и части validation/loading:

- **Layout**: `PassportDataForm`, `BasicInfoForm` выровнены с renderer/json-вариантами
- **testId rot**: VAL-010-A/B/D используют `passportData-*` вместо плоских имён
- **Validation-trigger pattern**: VAL-010, VAL-011, VAL-009-D переписаны под «валидация на next/submit, не на blur»
- **Impossible tests**: VAL-009-A/E помечены `.skip` с пояснением

Коммиты: `7deac5e`, `d62a14c`, `d08fc58` (пока не запушены).

После этого в `complex-multy-step-form` осталось **6 падающих тестов** (× 3 варианта: compound/renderer/json; часть — только в одном проекте).

---

## Категория A: coBorrower relationship (ARR-006)

**Тесты:**
- `ARR-006-A`: поле relationship обязательно — при пустом значении шаг не переходит
- `ARR-006-B`: все значения enum relationship доступны в select

**Корневая причина (гипотеза):**
- В `CoBorrowerForm` [CoBorrowerForm.tsx:62-70](projects/react-playground/src/pages/examples/complex-multy-step-form/components/nested-forms/CoBorrower/CoBorrowerForm.tsx#L62-L70) у `relationship` дефолт `value: 'spouse'` — значит поле валидно сразу, "обязательность" в UI не воспроизводится. Похожая ситуация на VAL-009-E (skipped).
- Тест ARR-006-A ожидает `expect(hasError || onStep5).toBeTruthy()` — оба false, значит форма уходит на шаг 6.

**Решение:**
- **A1.** Скипнуть как невоспроизводимые в UI (аналогично VAL-009-E) — если нет цели менять схему.
- **A2.** Изменить схему: `relationship: { value: '' }` + placeholder "Выберите отношение" + required-валидатор. Тогда тест осмысленен.
- **A3.** Для ARR-006-B (enum доступен) — не требует required, только проверка options. Вероятно сломан селектор. Проверить [arrays.spec.ts:558](projects/react-playground-e2e/tests/pages/complex-multy-step-form/arrays.spec.ts#L558): ищет `option[value="spouse"]`, но Select кастомный — может рендерить `<div role="option">` вместо `<option>`.

**Оценка:** 30 мин (A1) / 1-2 ч (A2+A3).

---

## Категория B: sameEmail copyFrom (COND-006)

**Тесты:**
- `COND-006-A`: чекбокс `sameEmail` копирует основной email в `emailAdditional`
- `COND-006-B`: снятие `sameEmail` очищает `emailAdditional` (resetOnDisable)

**Корневая причина (гипотеза):**
Behavior настроен в [credit-application-behavior.ts:82-84](projects/react-playground/src/pages/examples/complex-multy-step-form/schemas/credit-application-behavior.ts#L82-L84):
```ts
copyFrom(path.email, path.emailAdditional, {
  when: (form) => form.sameEmail === true,
});
```
Проверить:
1. Срабатывает ли copyFrom реактивно при смене `sameEmail` с `false`→`true`.
2. Есть ли `resetOnDisable` в опциях copyFrom (для COND-006-B).

**Решение:**
1. Прогнать тесты с `.only` + `--headed`, посмотреть реальное состояние `emailAdditional` в момент проверки.
2. Если copyFrom работает, но опция `resetOnDisable` не поддерживается в @reformer/core — это fix API либо убрать COND-006-B.
3. Возможно тест пишет в `input-sameEmail` checkbox, а реальный testId `sameEmail` (подтверждено в компоненте) — проверить обёртку FormField.

**Оценка:** 1-2 ч (диагностика + фикс).

---

## Категория C: LoadingError (LOAD-002)

**Тесты:**
- `LOAD-002-A`: при ошибке API отображается компонент ErrorState
- `LOAD-002-B`: кнопка «Повторить» перезагружает страницу

**Корневая причина (гипотеза):**
Race между MSW в приложении и `page.route('**/api/v1/credit-applications/**', ...)` в тесте. Часть уже чинилась в `238105c fix ... e2e msw race`, но не до конца.

**Решение:**
1. Запускать с `disableMsw: true` чтобы MSW не перехватывал запрос раньше route.
2. Проверить в `error-context.md` упавшего LOAD-002-A — на какой стадии: запрос был послан в `route`? Отобразился ли ErrorState вообще?
3. Если ErrorState не рендерится — проверить, что GET-error корректно пропущен в ErrorBoundary.

**Оценка:** 1-2 ч.

---

## Категория D: Прочие (не из complex-multy-step-form, но были в списке)

Были в изначальном списке падений, требуют отдельного внимания:

- **HP-005 firefox** (бизнес-кредит): падает только в `complex-form:firefox`. Вероятно firefox-specific тайминг или MSW-init. Прогнать вручную с `--headed --project=complex-form:firefox`.
- **SFA11Y-001-A** (simple-form Tab-navigation): другая страница, другой domain. Скорее всего связано с `Категория 1` из [e2e-skipped-tests-fix-plan.md](docs/plans/e2e-skipped-tests-fix-plan.md) — POM селекторы не соответствуют DOM.
- **REG-002-D** (simple-form email async validation): такая же природа — simple-form в целом имеет проблему с testId-ами.

**Оценка:** simple-form отдельный большой кусок — см. существующий план.

---

## Предлагаемый порядок на завтра

1. **Push** текущие 3 коммита: `7deac5e`, `d62a14c`, `d08fc58` (если ещё нет в origin).
2. **Категория C (LOAD-002)** — 1-2 ч: MSW/route race, частично уже контекст есть.
3. **Категория B (COND-006)** — 1-2 ч: диагностика copyFrom/resetOnDisable.
4. **Категория A (ARR-006)** — 30 мин, если идём по A1 (skip); 1-2 ч если A2 (схема).
5. **Категория D** — отдельным сеансом, после разбора `e2e-skipped-tests-fix-plan.md`.

**Итого по сложности:** 3-6 часов фокусной работы для зелёного прогона в complex-multy-step-form.

---

## Метрики прогресса

| Этап | Прохождений | Падений | Skipped |
|---|---:|---:|---:|
| Старт сессии (baseline) | ~? | 17 в подгруппе | 0 |
| После fix testId+trigger | 15 | 6 | 2 |
| Цель завтра | 21 | 0 | 2 |
