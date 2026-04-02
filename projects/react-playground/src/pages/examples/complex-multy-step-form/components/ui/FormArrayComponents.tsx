/**
 * Компоненты для FormArray в RenderSchema
 *
 * Используют FormArrayContext и FormArrayItemContext для доступа к методам массива.
 */

import type { ReactNode } from 'react';
import { useFormArrayContext, useFormArrayItemContext } from '@reformer/renderer-react';

// ============================================================================
// Array Header - заголовок с кнопкой "Добавить"
// ============================================================================

interface ArrayHeaderProps {
  title: string;
  addButtonLabel: string;
  className?: string;
}

// Общие стили для FormArray компонентов (экспортируются для переиспользования)
export const primaryButtonClassName =
  'inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 bg-primary text-primary-foreground shadow hover:bg-primary/90 h-9 px-4 py-2';

export const emptyStateClassName =
  'p-4 bg-gray-100 border border-gray-300 rounded text-center text-gray-600';

export function ArrayHeader({
  title,
  addButtonLabel,
  className = 'flex justify-between items-center mb-4',
}: ArrayHeaderProps): ReactNode {
  const arrayContext = useFormArrayContext();

  if (!arrayContext) {
    return null;
  }

  return (
    <div className={className}>
      <h3 className="text-lg font-semibold">{title}</h3>
      <button className={primaryButtonClassName} onClick={() => arrayContext.add()}>
        {addButtonLabel}
      </button>
    </div>
  );
}

// ============================================================================
// Array Empty - сообщение когда массив пуст
// ============================================================================

interface ArrayEmptyProps {
  message: string;
  hint?: string;
  className?: string;
}

export function ArrayEmpty({
  message,
  hint,
  className = emptyStateClassName,
}: ArrayEmptyProps): ReactNode {
  return (
    <div className={className}>
      {message}
      {hint && <div className="mt-2 text-xs text-gray-500">{hint}</div>}
    </div>
  );
}

// ============================================================================
// Array Item Header - заголовок элемента с кнопкой "Удалить"
// ============================================================================

interface ArrayItemHeaderProps {
  itemLabel: string;
  className?: string;
}

export function ArrayItemHeader({
  itemLabel,
  className = 'flex justify-between items-center mb-3',
}: ArrayItemHeaderProps): ReactNode {
  const itemContext = useFormArrayItemContext();

  if (!itemContext) {
    return null;
  }

  return (
    <div className={className}>
      <h4 className="font-medium">
        {itemLabel} #{itemContext.index + 1}
      </h4>
      <button className={primaryButtonClassName} onClick={itemContext.remove}>
        Удалить
      </button>
    </div>
  );
}

// ============================================================================
// Специфичные компоненты для каждого типа массива
// ============================================================================

// --- Имущество (Properties) ---

export function PropertyArrayHeader(): ReactNode {
  return <ArrayHeader title="Имущество" addButtonLabel="+ Добавить имущество" />;
}

export function PropertyArrayEmpty(): ReactNode {
  return <ArrayEmpty message='Нажмите "Добавить имущество" для добавления информации' />;
}

export function PropertyItemHeader(): ReactNode {
  return <ArrayItemHeader itemLabel="Имущество" />;
}

// --- Существующие кредиты (ExistingLoans) ---

export function ExistingLoanArrayHeader(): ReactNode {
  return <ArrayHeader title="Существующие кредиты" addButtonLabel="+ Добавить кредит" />;
}

export function ExistingLoanArrayEmpty(): ReactNode {
  return <ArrayEmpty message='Нажмите "Добавить кредит" для добавления информации' />;
}

export function ExistingLoanItemHeader(): ReactNode {
  return <ArrayItemHeader itemLabel="Кредит" />;
}

// --- Созаёмщики (CoBorrowers) ---

export function CoBorrowerArrayHeader(): ReactNode {
  return <ArrayHeader title="Созаемщики" addButtonLabel="+ Добавить созаемщика" />;
}

export function CoBorrowerArrayEmpty(): ReactNode {
  return (
    <ArrayEmpty
      message='Нажмите "Добавить созаемщика" для добавления информации'
      hint="CoBorrowerForm поддерживает вложенную группу personalData"
    />
  );
}

export function CoBorrowerItemHeader(): ReactNode {
  return <ArrayItemHeader itemLabel="Созаемщик" />;
}
