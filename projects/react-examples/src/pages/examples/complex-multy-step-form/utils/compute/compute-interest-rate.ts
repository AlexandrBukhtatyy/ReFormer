/**
 * Вычисление процентной ставки на основе типа кредита и дополнительных условий
 */

/**
 * Вычисление процентной ставки на основе типа кредита и дополнительных условий
 *
 * ✅ ОБНОВЛЕНО: Теперь принимает параметры напрямую (type-safe)
 *
 * @param loanType - Тип кредита
 * @param registrationAddress - Адрес регистрации (объект)
 * @param hasProperty - Наличие имущества
 * @param properties - Массив имущества
 * @returns процентная ставка (%)
 */
export function computeInterestRate(
  loanType: string,
  registrationAddress: any,
  hasProperty: boolean,
  properties: any[]
): number {
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
    const region = registrationAddress?.region;
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
