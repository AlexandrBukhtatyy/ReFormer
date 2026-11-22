/**
 * ResidenceAddressSection - секция адреса проживания с кнопками
 *
 * Компонент для рендеринга секции "Адрес проживания" с возможностью:
 * - Копировать данные из адреса регистрации
 * - Очистить адрес проживания
 *
 * Использует useValueCopy хук для логики копирования; ноды адресов берёт из контекста визарда.
 */

import type { ReactNode } from 'react';
import { useFormWizard } from '@reformer/cdk/form-wizard';
import { Button } from '@reformer/ui-kit';
import { useValueCopy } from '../../hooks/useValueCopy';
import type { CreditApplicationForm } from '../../types/credit-application';

interface ResidenceAddressSectionProps {
  /** CSS классы */
  className?: string;
  /** Дочерние элементы (поля адреса) */
  children?: ReactNode;
}

/**
 * ResidenceAddressSection - секция адреса проживания
 *
 * Структура:
 * - Заголовок с кнопкой "Скопировать из адреса регистрации"
 * - Поля адреса (children)
 * - Кнопка "Очистить адрес проживания"
 */
export function ResidenceAddressSection({
  className = 'space-y-4 p-4 bg-gray-50 rounded-lg border border-gray-200',
  children,
}: ResidenceAddressSectionProps): ReactNode {
  const { form } = useFormWizard<CreditApplicationForm>();
  const { copy, reset } = useValueCopy(form.registrationAddress, form.residenceAddress);

  return (
    <div className={className}>
      <div className="flex justify-between items-center">
        <h3 className="text-lg font-semibold">Адрес проживания</h3>
        <Button onClick={copy}>Скопировать из адреса регистрации</Button>
      </div>

      {children}

      <Button onClick={reset}>Очистить адрес проживания</Button>
    </div>
  );
}
