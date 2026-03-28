/**
 * ResidenceAddressSection - секция адреса проживания с кнопками
 *
 * Компонент для рендеринга секции "Адрес проживания" с возможностью:
 * - Копировать данные из адреса регистрации
 * - Очистить адрес проживания
 *
 * Использует useFormNavigation для доступа к form.
 */

import type { ReactNode } from 'react';
import { useFormNavigation } from '@reformer/ui/form-navigation';
import { Button } from '@/components/ui/button';
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
  const { form } = useFormNavigation<CreditApplicationForm>();

  // Копировать адрес регистрации в адрес проживания
  const copyRegistrationAddress = () => {
    const regAddress = form.registrationAddress?.getValue();
    form.residenceAddress?.setValue(regAddress);
  };

  // Очистить адрес проживания
  const clearResidenceAddress = () => {
    form.residenceAddress?.reset();
  };

  return (
    <div className={className}>
      <div className="flex justify-between items-center">
        <h3 className="text-lg font-semibold">Адрес проживания</h3>
        <Button size="sm" onClick={copyRegistrationAddress}>
          Скопировать из адреса регистрации
        </Button>
      </div>

      {children}

      <Button size="sm" onClick={clearResidenceAddress}>
        Очистить адрес проживания
      </Button>
    </div>
  );
}
