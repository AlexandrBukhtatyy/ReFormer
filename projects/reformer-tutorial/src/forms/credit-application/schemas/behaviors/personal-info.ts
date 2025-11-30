import { computeFrom, disableWhen } from 'reformer/behaviors';
import type { BehaviorSchemaFn, FieldPath } from 'reformer';
import type { CreditApplicationForm } from '../../types/credit-application.types';

export const personalBehaviorSchema: BehaviorSchemaFn<CreditApplicationForm> = (
  path: FieldPath<CreditApplicationForm>
) => {
  // ==========================================
  // 1. Вычисляемое поле: Полное имя (ФИО)
  // Подписываемся только на поля, от которых зависит ФИО
  // ==========================================
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  computeFrom<any, string>(
    [path.personalData.lastName, path.personalData.firstName, path.personalData.middleName],
    path.fullName,
    (values: { lastName: string; firstName: string; middleName: string }) => {
      const parts = [values.lastName, values.firstName, values.middleName].filter(Boolean);
      return parts.join(' ');
    }
  );

  // ==========================================
  // 2. Вычисляемое поле: Возраст
  // Подписываемся только на дату рождения
  // ==========================================
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  computeFrom<any, number | null>(
    [path.personalData.birthDate],
    path.age,
    (values: { birthDate: string }) => {
      const birthDate = values.birthDate;
      if (!birthDate) return null;

      const today = new Date();
      const birth = new Date(birthDate);
      let age = today.getFullYear() - birth.getFullYear();
      const monthDiff = today.getMonth() - birth.getMonth();

      if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) {
        age--;
      }

      return age;
    }
  );

  // ==========================================
  // 3. Отключить вычисляемые поля (только для чтения)
  // ==========================================
  disableWhen(path.fullName, () => true);
  disableWhen(path.age, () => true);
};
