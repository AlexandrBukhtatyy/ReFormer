import { enableWhen, watchField, computeFrom, disableWhen } from '@reformer/core/behaviors';
import type { BehaviorSchemaFn } from '@reformer/core/behaviors';
import type { FieldPath } from '@reformer/core';
import type { CreditApplicationForm } from '../../type';

export const employmentBehaviorSchema: BehaviorSchemaFn<CreditApplicationForm> = (
  path: FieldPath<CreditApplicationForm>
) => {
  // Показать поля компании для трудоустроенных
  enableWhen(path.companyName, (form) => form.employmentStatus === 'employed');
  enableWhen(path.companyInn, (form) => form.employmentStatus === 'employed');
  enableWhen(path.companyPhone, (form) => form.employmentStatus === 'employed');
  enableWhen(path.companyAddress, (form) => form.employmentStatus === 'employed');
  enableWhen(path.position, (form) => form.employmentStatus === 'employed');
  enableWhen(path.workExperienceTotal, (form) => form.employmentStatus === 'employed');
  enableWhen(path.workExperienceCurrent, (form) => form.employmentStatus === 'employed');

  // Показать поля бизнеса для самозанятых
  enableWhen(path.businessType, (form) => form.employmentStatus === 'selfEmployed');
  enableWhen(path.businessInn, (form) => form.employmentStatus === 'selfEmployed');
  enableWhen(path.businessActivity, (form) => form.employmentStatus === 'selfEmployed');

  // Сброс полей при смене статуса занятости
  watchField(path.employmentStatus, (value, ctx) => {
    if (value !== 'employed') {
      ctx.form.companyName.setValue('', { emitEvent: false });
      ctx.form.companyInn.setValue('', { emitEvent: false });
      ctx.form.companyPhone.setValue('', { emitEvent: false });
      ctx.form.companyAddress.setValue('', { emitEvent: false });
      ctx.form.position.setValue('', { emitEvent: false });
      ctx.form.workExperienceTotal.setValue(0, { emitEvent: false });
      ctx.form.workExperienceCurrent.setValue(0, { emitEvent: false });
    }

    if (value !== 'selfEmployed') {
      ctx.form.businessType.setValue('', { emitEvent: false });
      ctx.form.businessInn.setValue('', { emitEvent: false });
      ctx.form.businessActivity.setValue('', { emitEvent: false });
    }
  });

  // Вычисляемое поле: Общий доход
  computeFrom([path.monthlyIncome, path.additionalIncome], path.totalIncome, (values) => {
    const main = (values.monthlyIncome as number) || 0;
    const additional = (values.additionalIncome as number) || 0;
    return main + additional;
  });

  // Отключить totalIncome (только для чтения)
  disableWhen(path.totalIncome, () => true);
};
