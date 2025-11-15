/**
 * Вычисление полного имени (конкатенация Фамилия Имя Отчество)
 */

/**
 * Вычисление полного имени (конкатенация Фамилия Имя Отчество)
 *
 * ✅ ОБНОВЛЕНО: Теперь принимает параметры напрямую (type-safe)
 *
 * @param params - Объект с параметрами
 * @param params.personalData - Объект с данными о человеке
 * @returns полное имя
 */
export function computeFullName({ personalData }: { personalData: any }): string {
  const lastName = personalData?.lastName || '';
  const firstName = personalData?.firstName || '';
  const middleName = personalData?.middleName || '';

  return [lastName, firstName, middleName].filter(Boolean).join(' ');
}
