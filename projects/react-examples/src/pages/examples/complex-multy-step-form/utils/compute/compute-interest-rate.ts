/**
 * Вычисление процентной ставки на основе типа кредита и дополнительных условий
 */

/**
 * Вычисление процентной ставки на основе типа кредита и дополнительных условий
 *
 * ✅ ОБНОВЛЕНО: Теперь принимает параметры напрямую (type-safe)
 *
 * @param params - Объект с параметрами
 * @param params.loanType - Тип кредита
 * @param params.registrationAddress - Адрес регистрации (объект)
 * @param params.hasProperty - Наличие имущества
 * @param params.properties - Массив имущества
 * @returns процентная ставка (%)
 */
export function computeInterestRate({
  loanType,
  registrationAddress,
  hasProperty,
  properties,
}: {
  loanType: string;
  registrationAddress: unknown;
  hasProperty: boolean;
  properties: unknown[];
}): number {
  // Базовые ставки по типам кредита
  const baseRates: Record<string, number> = {
    consumer: 15.5,
    mortgage: 8.5,
    car: 12.0,
    business: 18.0,
    refinancing: 14.0,
  };

  let rate = baseRates[loanType] || 15.0;

  // Надбавки и скидки
  if (loanType === 'mortgage') {
    // Надбавка за регион (Москва дороже)
    const region = (registrationAddress as Record<string, unknown>)?.region;
    if (region === 'moscow') {
      rate += 0.5;
    }
  }

  if (loanType === 'car') {
    // Скидка за КАСКО (если есть)
    // TODO: Нужно добавить параметр carInsurance
    // const hasInsurance = carInsurance === true;
    // if (hasInsurance) {
    //   rate -= 1.0;
    // }
  }

  // Скидка за обеспечение (имущество)
  if (hasProperty === true && properties && properties.length > 0) {
    rate -= 0.5;
  }

  return Math.max(rate, 0);
}
