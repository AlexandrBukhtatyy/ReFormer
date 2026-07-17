import * as React from 'react';
import { type FieldNode } from '@reformer/core';
import { FormField as CdkFormField, useFormFieldContext } from '@reformer/cdk/form-field';

import { Field, FieldContent } from '@/components/field';

/** Props компонента {@link FormField}. */
export interface FormFieldProps {
  /**
   * Поле формы. Из него берутся `component` (тип контрола), `componentProps`, `value`, `error`,
   * `pending`, `setValue`, `blur`. Контрол инстанцируется автоматически через `CdkFormField.Control`.
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  control: FieldNode<any>;
  /** Дополнительный CSS-класс корневого `Field`. */
  className?: string;
  /**
   * Префикс `data-testid` (`field-<id>`, `label-<id>`, `input-<id>`, `error-<id>`).
   * Если опущен — берётся `componentProps.testId`, иначе `'unknown'`.
   */
  testId?: string;
  /**
   * Кастомный input — оборачивается в `CdkFormField.Control asChild` (нестандартный контрол,
   * не зарегистрированный в `control.component`).
   */
  children?: React.ReactNode;
}

/**
 * Контролы с inline-раскладкой (Checkbox/Switch/Toggle — сами рисуют подпись рядом с контролом)
 * помечают field-версию статическим маркером `reformerLayout = 'inline-label'`. Для них FormField
 * НЕ рендерит верхнюю подпись (иначе она задвоится).
 *
 * ⚠️ ИНВАРИАНТ (playbook, фаза D2): каждая inline-field-версия (CheckboxField/SwitchField/ToggleField)
 * ОБЯЗАНА проставить `Field.reformerLayout = 'inline-label'`. Маркер — неэнфорсимая конвенция: если
 * inline-контрол его не выставит, верхняя подпись задвоится молча (замена v6-детекции `=== Checkbox`).
 */
function hasInlineLabel(component: unknown): boolean {
  return (component as { reformerLayout?: string } | null)?.reformerLayout === 'inline-label';
}

interface FormFieldInnerProps {
  className?: string;
  testIdProp?: string;
  inlineLabel: boolean;
  description?: string;
  customChildren?: React.ReactNode;
}

/**
 * Читает контекст `CdkFormField.Root`: `componentProps` (fallback testId) и `pending`.
 * Визуал — shadcn `Field`/`FieldContent`; данные и a11y-wiring (htmlFor/id/aria-*) — из CDK-слотов.
 */
function FormFieldInner({
  className,
  testIdProp,
  inlineLabel,
  description,
  customChildren,
}: FormFieldInnerProps) {
  const { componentProps, pending } = useFormFieldContext();
  const testId = testIdProp ?? (componentProps as { testId?: string })?.testId ?? 'unknown';

  return (
    <Field className={className} data-testid={`field-${testId}`}>
      {/* CdkFormField.Label остаётся нативным <label> (htmlFor→controlId): asChild уронил бы htmlFor.
          shadcn-вид даём классами field-label. */}
      {!inlineLabel && (
        <CdkFormField.Label
          data-slot="field-label"
          className="flex w-fit items-center gap-2 text-sm leading-snug font-medium select-none group-data-[disabled=true]/field:opacity-50"
          data-testid={`label-${testId}`}
        />
      )}

      <FieldContent>
        {customChildren ? (
          <CdkFormField.Control asChild>{customChildren}</CdkFormField.Control>
        ) : (
          <CdkFormField.Control data-testid={`input-${testId}`} />
        )}

        {description && (
          <CdkFormField.Description
            data-slot="field-description"
            className="text-sm leading-normal font-normal text-muted-foreground"
          >
            {description}
          </CdkFormField.Description>
        )}

        <CdkFormField.Error
          data-slot="field-error"
          className="text-sm font-normal text-destructive"
          data-testid={`error-${testId}`}
        />

        {pending && (
          <span role="status" aria-live="polite" className="text-sm text-muted-foreground">
            Проверка...
          </span>
        )}
      </FieldContent>
    </Field>
  );
}

const FormFieldComponent: React.FC<FormFieldProps> = ({ control, className, testId, children }) => {
  const inlineLabel = hasInlineLabel(control.component);
  // peek: structural, без подписки — hasDescription нужен ДО Root. Ограничение: `description`
  // фиксируется первым рендером (компонент memo'ится по control). Динамическая смена description
  // через updateComponentProps не подхватится (в отличие от реактивных label/required из контекста).
  // Допущение осознанное: description поля статичен, как и раскладка. Нужна динамика — пересоздать поле.
  const description = (control.componentProps.peek() as { description?: string })?.description;

  return (
    <CdkFormField.Root control={control} hasDescription={Boolean(description)}>
      <FormFieldInner
        className={className}
        testIdProp={testId}
        inlineLabel={inlineLabel}
        description={description}
        customChildren={children}
      />
    </CdkFormField.Root>
  );
};

/**
 * Готовый wrapper поля на визуальной базе shadcn `Field`, поверх headless
 * `@reformer/cdk/form-field`: `Label` → `Control` → `Error` (+ опц. `Description`, pending).
 * Подключается `<FormField control={…} />` или как `fieldWrapper` для `FormRenderer`.
 *
 * - Для inline-контролов (Checkbox/Switch — `reformerLayout='inline-label'`) верхняя подпись не рендерится.
 * - При `pending` (async-валидация) под полем показывается «Проверка…».
 * - `React.memo` по ссылке `control` — критично для больших форм.
 */
export const FormField = React.memo(
  FormFieldComponent,
  (prev, next) =>
    prev.control === next.control &&
    prev.className === next.className &&
    prev.testId === next.testId &&
    prev.children === next.children
);
