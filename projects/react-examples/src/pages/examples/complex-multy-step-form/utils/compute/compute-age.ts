/**
 * Вычисление возраста из даты рождения
 */

/**
 * Вычисление возраста из даты рождения
 *
 * ✅ ОБНОВЛЕНО: Теперь принимает параметры напрямую (type-safe)
 *
 * @param params - Объект с параметрами
 * @param params.personalData - Объект с данными о человеке
 * @returns возраст (лет)
 */
export function computeAge({ personalData }: { personalData: unknown }): number | null {
  const birthDate = (personalData as Record<string, unknown>)?.birthDate;

  if (!birthDate) {
    return null;
  }

  const today = new Date();
  const birth = new Date(birthDate);
  let age = today.getFullYear() - birth.getFullYear();
  const monthDiff = today.getMonth() - birth.getMonth();

  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) {
    age--;
  }

  return age;
}
