import * as React from 'react';
import { type FieldNode } from '@reformer/core';
import { FormField as CdkFormField, useFormFieldContext } from '@reformer/cdk/form-field';
import { Checkbox } from './checkbox';

/** Props компонента {@link FormField}. */
export interface FormFieldProps {
  /**
   * Поле формы. Из него берутся `component` (тип контрола), `componentProps`,
   * `value`, `error`, `pending`, `setValue`, `blur`. Контрол инстанцируется
   * автоматически через `CdkFormField.Control`.
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  control: FieldNode<any>;
  /** Дополнительный CSS-класс для корневой `<div>`-обёртки. */
  className?: string;
  /**
   * Префикс для `data-testid` (`field-<id>`, `label-<id>`, `input-<id>`,
   * `error-<id>`). Если опущен — пытается взять `componentProps.testId`,
   * иначе подставляет `'unknown'`.
   */
  testId?: string;
  /**
   * Кастомный input — оборачивается в `CdkFormField.Control asChild`. Используется,
   * когда нужен нестандартный контрол (например, сторонняя маска), не
   * зарегистрированный в `control.component`.
   */
  children?: React.ReactNode;
}

interface FormFieldInnerProps {
  className?: string;
  testIdProp?: string;
  isCheckbox: boolean;
  customChildren?: React.ReactNode;
}

/**
 * Inner component reads context provided by CdkFormField.Root.
 * Needed to access componentProps for testId fallback and pending state.
 */
function FormFieldInner({
  className,
  testIdProp,
  isCheckbox,
  customChildren,
}: FormFieldInnerProps) {
  const { componentProps, pending } = useFormFieldContext();
  const testId = testIdProp ?? (componentProps as { testId?: string })?.testId ?? 'unknown';

  return (
    <div className={className} data-testid={`field-${testId}`}>
      {!isCheckbox && (
        <CdkFormField.Label
          className="block mb-1 text-sm font-medium"
          data-testid={`label-${testId}`}
        />
      )}

      {customChildren ? (
        <CdkFormField.Control asChild>{customChildren}</CdkFormField.Control>
      ) : (
        <CdkFormField.Control data-testid={`input-${testId}`} />
      )}

      <CdkFormField.Error
        className="text-destructive text-sm mt-1 block"
        data-testid={`error-${testId}`}
      />

      {pending && <span className="text-gray-500 text-sm mt-1 block">Проверка...</span>}
    </div>
  );
}

const FormFieldComponent: React.FC<FormFieldProps> = ({ control, className, testId, children }) => {
  const isCheckbox = control.component === Checkbox;

  return (
    <CdkFormField.Root control={control}>
      <FormFieldInner
        className={className}
        testIdProp={testId}
        isCheckbox={isCheckbox}
        customChildren={children}
      />
    </CdkFormField.Root>
  );
};

/**
 * Готовый wrapper поля: автоматически рендерит `Label` → `Control` → `Error`
 * из `@reformer/cdk/form-field`. Подключается напрямую `<FormField control=... />`
 * или как `fieldWrapper` для `FormRenderer`.
 *
 * Особенности:
 * - Для `Checkbox` верхний `Label` не рендерится (label идёт справа от контрола).
 * - При `pending = true` (async-валидация) под полем показывается «Проверка...».
 * - Обёрнут в `React.memo` со сравнением по ссылке `control` — критично для
 *   производительности больших форм.
 *
 * @example Standalone в обычной форме
 * ```tsx
 * import { useMemo } from 'react';
 * import { createForm, type FormSchema } from '@reformer/core';
 * import { Button, FormField, Input } from '@reformer/ui-kit';
 *
 * function RegistrationPage() {
 *   const form = useMemo(
 *     () => createForm<FormSchema<{ email: string }>>({
 *       email: { component: Input, componentProps: { label: 'Email' } },
 *     }),
 *     []
 *   );
 *   return (
 *     <form>
 *       <FormField control={form.email} testId="email" />
 *       <Button type="submit">OK</Button>
 *     </form>
 *   );
 * }
 * ```
 *
 * @example В качестве `fieldWrapper` для FormRenderer
 * ```tsx
 * import { FormRenderer, createRenderSchema } from '@reformer/renderer-react';
 * import { FormField } from '@reformer/ui-kit';
 *
 * const schema = createRenderSchema<MyForm>((path) => ({
 *   component: 'Box',
 *   children: [{ component: path.email }, { component: path.phone }],
 * }));
 *
 * <FormRenderer render={schema} settings={{ fieldWrapper: FormField }} />
 * ```
 */
export const FormField = React.memo(FormFieldComponent, (prevProps, nextProps) => {
  return (
    prevProps.control === nextProps.control &&
    prevProps.className === nextProps.className &&
    prevProps.testId === nextProps.testId &&
    prevProps.children === nextProps.children
  );
});
