/**
 * Обёртка поля (`FIELD_WRAPPER`) на визуальной базе HexaUI `Field`, поверх headless
 * `@reformer/cdk/form-field` — тот же контракт, что у `FormField` из `@reformer/ui-kit`.
 *
 * Отличие от ui-kit-версии структурное: HexaUI `Field` принимает контрол ПРОПОМ `control`
 * (ReactElement), а подпись, звёздочку required и сообщение об ошибке рисует сам. Поэтому здесь
 * не композиция `Label → Control → Error`, а чтение состояния из cdk-контекста и раздача его в
 * пропсы `Field`.
 *
 * @module reformer/kit-hexa-ui/form-field
 */

import * as React from 'react';
import { Field } from '@kaspersky/hexa-ui';
import { FormField as CdkFormField, useFormFieldContext } from '@reformer/cdk/form-field';

/* eslint-disable @typescript-eslint/no-explicit-any */

/** Пропсы обёртки — зеркало `FormFieldProps` из ui-kit. */
export interface HexaFormFieldProps {
  control: any;
  className?: string;
  testId?: string;
  children?: React.ReactNode;
}

/** Контролы, рисующие подпись рядом с собой (Checkbox/Toggle), помечены этим маркером. */
function hasInlineLabel(component: unknown): boolean {
  return (component as { reformerLayout?: string } | null)?.reformerLayout === 'inline-label';
}

/**
 * Внутренняя часть: читает cdk-контекст и собирает `Field`. Обязана быть отдельным компонентом —
 * контекст доступен только внутри `CdkFormField.Root`.
 */
function HexaFieldShell({
  className,
  testId,
  inlineLabel,
  customChildren,
}: {
  className?: string;
  testId?: string;
  inlineLabel: boolean;
  customChildren?: React.ReactNode;
}) {
  const ctx = useFormFieldContext();
  const { required, error, componentProps } = ctx;
  // `componentProps` из контекста может быть пустым — надёжный источник это сигнал самого контрола
  // (так же его читает `FormField` в ui-kit для `description`). `peek` намеренно: подпись и
  // раскладка поля статичны, подписка тут не нужна.
  const own = (ctx.control?.componentProps?.peek?.() ?? {}) as Record<string, unknown>;
  const props = { ...own, ...(componentProps ?? {}) } as {
    testId?: string;
    label?: string;
    description?: string;
  };
  const label = ctx.label ?? props.label;
  const id = testId ?? props.testId ?? 'unknown';

  const control = customChildren ? (
    <CdkFormField.Control asChild>{customChildren}</CdkFormField.Control>
  ) : (
    <CdkFormField.Control data-testid={`input-${id}`} />
  );

  return (
    <Field
      className={className}
      // Inline-контрол рисует подпись сам — вторую сверху не даём.
      label={inlineLabel ? undefined : label}
      required={required}
      message={error}
      messageMode={error ? 'error' : undefined}
      control={control}
      testId={`field-${id}`}
      description={props?.description}
    />
  );
}

const HexaFormFieldComponent: React.FC<HexaFormFieldProps> = ({
  control,
  className,
  testId,
  children,
}) => (
  <CdkFormField.Root control={control}>
    <HexaFieldShell
      className={className}
      testId={testId}
      inlineLabel={hasInlineLabel(control?.component)}
      customChildren={children}
    />
  </CdkFormField.Root>
);

/** `React.memo` по ссылке `control` — как в ui-kit: критично для больших форм. */
export const FormField = React.memo(
  HexaFormFieldComponent,
  (prev, next) =>
    prev.control === next.control &&
    prev.className === next.className &&
    prev.testId === next.testId &&
    prev.children === next.children
);
