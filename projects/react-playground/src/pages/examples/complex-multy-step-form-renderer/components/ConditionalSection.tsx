/**
 * ConditionalSection - реактивная секция с условным отображением
 *
 * Использует useFormControlValue для подписки на изменения формы
 * и реактивно показывает/скрывает содержимое.
 */

import type { ReactNode } from 'react';
import type { FormProxy, FieldNode } from '@reformer/core';
import { useFormControlValue, Section, type SectionProps } from '@reformer/core';
import type {
  LoanType,
  EmploymentStatus,
} from '../../complex-multy-step-form/types/credit-application';

interface ConditionalSectionProps extends SectionProps {
  /** FormProxy для подписки на изменения */
  form: FormProxy<unknown>;
  /** Имя поля для отслеживания */
  watchField: string;
  /** Значение, при котором секция видима */
  showWhen: string | string[];
  /** Дочерние элементы */
  children?: ReactNode;
}

/**
 * ConditionalSection - секция с реактивным условным отображением
 *
 * @example
 * ```tsx
 * <ConditionalSection
 *   form={form}
 *   watchField="loanType"
 *   showWhen="mortgage"
 *   title="Информация о недвижимости"
 * >
 *   {children}
 * </ConditionalSection>
 * ```
 */
export function ConditionalSection({
  form,
  watchField,
  showWhen,
  children,
  ...sectionProps
}: ConditionalSectionProps): ReactNode {
  // Получаем FieldNode по имени поля
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const fieldNode = (form as any)[watchField] as FieldNode<LoanType | EmploymentStatus>;

  // Подписываемся на изменения значения
  const value = useFormControlValue(fieldNode) as string;

  // Проверяем условие показа
  const shouldShow = Array.isArray(showWhen) ? showWhen.includes(value) : value === showWhen;

  if (!shouldShow) {
    return null;
  }

  return <Section {...sectionProps}>{children}</Section>;
}
