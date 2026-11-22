/**
 * Тело заявки для API: только ввод пользователя, без вычисляемых полей.
 *
 * Вычисляемые поля (ставка, платёж, доходы, ФИО, возраст) пишет поведение формы — сервер считает
 * их сам и в теле заявки их не ждёт. Список ключей сверяется с типом: новое вычисляемое поле без
 * записи здесь — ошибка компиляции, а не тихо уехавшее на сервер значение.
 */

import type { CreditApplication, CreditApplicationDerived } from '../types/credit-application';

/** Ключи вычисляемых полей заявки. */
export const derivedKeys = [
  'interestRate',
  'monthlyPayment',
  'fullName',
  'age',
  'totalIncome',
  'paymentToIncomeRatio',
  'coBorrowersIncome',
] as const satisfies readonly (keyof CreditApplicationDerived)[];

// Список обязан покрывать тип целиком: пропущенный ключ — ошибка сборки.
type MissingDerivedKey = Exclude<keyof CreditApplicationDerived, (typeof derivedKeys)[number]>;
const derivedKeysComplete: [MissingDerivedKey] extends [never] ? true : MissingDerivedKey = true;
void derivedKeysComplete;

/**
 * Значения заявки без вычисляемых полей.
 *
 * @example
 * ```ts
 * const payload = toApplicationPayload(model.get());
 * await submitCreditApplication(payload);
 * ```
 */
export function toApplicationPayload(
  values: CreditApplication & Partial<CreditApplicationDerived>
): CreditApplication {
  const payload: Partial<CreditApplication & CreditApplicationDerived> = { ...values };
  for (const key of derivedKeys) delete payload[key];
  return payload as CreditApplication;
}
