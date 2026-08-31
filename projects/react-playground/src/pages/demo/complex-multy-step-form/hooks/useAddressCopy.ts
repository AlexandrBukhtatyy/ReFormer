/**
 * useAddressCopy - хук для копирования/очистки адреса проживания
 *
 * Инкапсулирует логику:
 * - Копирование данных из адреса регистрации в адрес проживания
 * - Очистка адреса проживания
 */

import { useFormWizard } from '@reformer/cdk/form-wizard';
import type { CreditApplicationForm } from '../types/credit-application';

interface UseAddressCopyResult {
  /** Копировать адрес регистрации в адрес проживания */
  copyRegistrationAddress: () => void;
  /** Очистить адрес проживания */
  clearResidenceAddress: () => void;
}

/**
 * Хук для работы с копированием адреса
 *
 * @example
 * ```tsx
 * const { copyRegistrationAddress, clearResidenceAddress } = useAddressCopy();
 *
 * <Button onClick={copyRegistrationAddress}>Скопировать</Button>
 * <Button onClick={clearResidenceAddress}>Очистить</Button>
 * ```
 */
export function useAddressCopy(): UseAddressCopyResult {
  const { form } = useFormWizard<CreditApplicationForm>();

  const copyRegistrationAddress = () => {
    const regAddress = form.registrationAddress?.getValue();
    form.residenceAddress?.setValue(regAddress);
  };

  const clearResidenceAddress = () => {
    form.residenceAddress?.reset();
  };

  return {
    copyRegistrationAddress,
    clearResidenceAddress,
  };
}
