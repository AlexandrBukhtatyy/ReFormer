import { computeFrom, disableWhen } from 'reformer/behaviors';
import type { BehaviorSchemaFn, FieldPath } from 'reformer';
import type { CreditApplicationForm, PersonalData } from '../../types/credit-application.types';

export const personalBehaviorSchema: BehaviorSchemaFn<CreditApplicationForm> = (
  path: FieldPath<CreditApplicationForm>
) => {
  // ==========================================
  // 1. Вычисляемое поле: Полное имя (ФИО)
  // ==========================================
  computeFrom([path.personalData], path.fullName, (values) => {
    const pd = values.personalData as PersonalData;
    if (!pd) return '';

    const parts = [pd.lastName, pd.firstName, pd.middleName].filter(Boolean);
    return parts.join(' ');
  });

  // ==========================================
  // 2. Вычисляемое поле: Возраст
  // ==========================================
  computeFrom([path.personalData], path.age, (values) => {
    const birthDate = (values.personalData as PersonalData)?.birthDate;
    if (!birthDate) return null;

    const today = new Date();
    const birth = new Date(birthDate);
    let age = today.getFullYear() - birth.getFullYear();
    const monthDiff = today.getMonth() - birth.getMonth();

    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) {
      age--;
    }

    return age;
  });

  // ==========================================
  // 3. Отключить вычисляемые поля (только для чтения)
  // ==========================================
  disableWhen(path.fullName, () => true);
  disableWhen(path.age, () => true);
};
