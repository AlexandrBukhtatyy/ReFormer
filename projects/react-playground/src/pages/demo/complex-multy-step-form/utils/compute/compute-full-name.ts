import type { PersonalData } from '../../components/nested-forms/PersonalData/types';

/** Полное имя: «Фамилия Имя Отчество» без пустых частей. */
export function computeFullName({
  lastName,
  firstName,
  middleName,
}: Pick<PersonalData, 'lastName' | 'firstName' | 'middleName'>): string {
  return [lastName, firstName, middleName].filter(Boolean).join(' ');
}
