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
export function computeFullName({ personalData }: { personalData: unknown }): string {
  const data = personalData as Record<string, unknown>;
  const lastName = data?.lastName || '';
  const firstName = data?.firstName || '';
  const middleName = data?.middleName || '';

  return [lastName, firstName, middleName].filter(Boolean).join(' ');
}
