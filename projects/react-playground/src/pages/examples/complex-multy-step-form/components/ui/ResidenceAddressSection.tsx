/**
 * ResidenceAddressSection - секция адреса проживания с кнопками
 *
 * Компонент для рендеринга секции "Адрес проживания" с возможностью:
 * - Копировать данные из адреса регистрации
 * - Очистить адрес проживания
 *
 * Использует useAddressCopy хук для логики копирования.
 */

import type { ReactNode } from 'react';
import { Button } from '@reformer/ui-kit';
import { useAddressCopy } from './useAddressCopy';

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
  const { copyRegistrationAddress, clearResidenceAddress } = useAddressCopy();

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
