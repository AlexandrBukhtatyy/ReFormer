/**
 * Вычисление возраста из даты рождения
 */

import type { PersonalData } from '../../components/nested-forms/PersonalData/PersonalDataForm';

/**
 * Вычисление возраста из даты рождения
 *
 * @param params - Объект с параметрами
 * @param params.personalData - Объект с данными о человеке
 * @returns возраст (лет)
 */
export function computeAge({ personalData }: { personalData: PersonalData }): number | null {
  const birthDate = personalData.birthDate;

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
