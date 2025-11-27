import { computeFrom, disableWhen } from 'reformer/behaviors';
import type { BehaviorSchemaFn } from 'reformer/behaviors';
import type { FieldPath, FieldPathNode } from 'reformer';
import type { CreditApplicationForm } from '@/types/credit-application.types';

export const step2PersonalBehaviors: BehaviorSchemaFn<CreditApplicationForm> = (
  path: FieldPath<CreditApplicationForm>
) => {
  // ==========================================
  // Computed: Full Name from nested personalData
  // ==========================================
  // Type assertion needed because computeFrom expects all paths from same form type
  // but nested paths (personalData.*) have PersonalData as their form type
  computeFrom(
    [path.personalData.lastName, path.personalData.firstName, path.personalData.middleName] as unknown as FieldPathNode<CreditApplicationForm, string>[],
    path.fullName,
    (values: unknown) => {
      const v = values as Record<string, string>;
      const parts = [
        v.lastName,
        v.firstName,
        v.middleName,
      ].filter(Boolean);
      return parts.join(' ');
    }
  );

  // ==========================================
  // Computed: Age from birth date
  // ==========================================
  computeFrom(
    [path.personalData.birthDate] as unknown as FieldPathNode<CreditApplicationForm, string>[],
    path.age,
    (values: unknown) => {
      const v = values as Record<string, string>;
      const birthDate = v.birthDate;
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
  // Disable Computed Fields (Always Read-Only)
  // ==========================================
  disableWhen(path.fullName, () => true);
  disableWhen(path.age, () => true);
};
