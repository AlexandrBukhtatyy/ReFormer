import type { FormModel, FormSchemaNode } from '@reformer/core';
import { Input, InputMask, Section, Textarea } from '@reformer/ui-kit';
import type { CreditApplicationForm } from '../../types/credit-application';

/**
 * Секция «Информация о бизнесе». Стоит в схеме дважды — на шаге «Кредит» (бизнес-кредит) и на
 * шаге «Работа» (самозанятый): поля одни и те же, различаются `selector` и отступ заголовка.
 */
export const businessSection = (
  model: FormModel<CreditApplicationForm>,
  { selector, titleClassName }: { selector: string; titleClassName: string }
): FormSchemaNode => ({
  selector,
  component: Section,
  componentProps: {
    title: 'Информация о бизнесе',
    titleClassName,
    className: 'space-y-4',
  },
  children: [
    {
      model: model.$.businessType,
      component: Input,
      componentProps: { label: 'Тип бизнеса', placeholder: 'ИП, ООО и т.д.' },
    },
    {
      model: model.$.businessInn,
      component: InputMask,
      componentProps: {
        label: 'ИНН ИП',
        placeholder: '123456789012',
        mask: '999999999999',
      },
    },
    {
      model: model.$.businessActivity,
      component: Textarea,
      componentProps: {
        label: 'Вид деятельности',
        placeholder: 'Опишите вид деятельности',
        rows: 3,
      },
    },
  ],
});
