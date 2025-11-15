/**
 * Вычисление полного имени (конкатенация Фамилия Имя Отчество)
 */

/**
 * Вычисление полного имени (конкатенация Фамилия Имя Отчество)
 *
 * ✅ ОБНОВЛЕНО: Теперь принимает параметры напрямую (type-safe)
 *
 * @param personalData - Объект с данными о человеке
 * @returns полное имя
 */
export function computeFullName(personalData: any): string {
  const lastName = personalData?.lastName || '';
  const firstName = personalData?.firstName || '';
  const middleName = personalData?.middleName || '';

  return [lastName, firstName, middleName].filter(Boolean).join(' ');
}
