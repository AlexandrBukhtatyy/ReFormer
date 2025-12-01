import type { PersonalData } from '../../sub-forms/personal-data/type';
import type { PassportData } from '../../sub-forms/passport-data/type';

export interface PersonalInfoStep {
  personalData: PersonalData;
  passportData: PassportData;
  inn: string;
  snils: string;

  // Вычисляемые поля
  fullName: string;
  age: number | null;
}
