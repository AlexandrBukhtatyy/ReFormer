/* eslint-disable @typescript-eslint/no-explicit-any */
import { FormField as FieldRoot } from '@reformer/cdk/form-field';
import { InputField } from '@reformer/ui-kit';
import { required, email } from '@reformer/core/validators';
import { useDemoField } from '../harness';
import type { ComponentDocConfig } from '../types';

function AutoRender() {
  const { control } = useDemoField({
    initial: '',
    component: InputField,
    componentProps: { label: 'Email', type: 'email', placeholder: 'you@example.com' },
    validators: [required({ message: 'Введите email' }), email()],
  });
  return (
    <div style={{ maxWidth: 380, width: '100%' }}>
      <FieldRoot.Root control={control as any}>
        <FieldRoot.Label className="block mb-1 text-sm font-medium" />
        <FieldRoot.Control />
        <FieldRoot.Error className="text-destructive text-sm mt-1 block" />
      </FieldRoot.Root>
    </div>
  );
}

function CustomLayout() {
  const { control } = useDemoField({
    initial: '',
    component: InputField,
    componentProps: { label: 'Email', type: 'email', placeholder: 'you@example.com' },
    validators: [required({ message: 'Введите email' }), email()],
  });
  return (
    <div style={{ maxWidth: 460, width: '100%' }}>
      <FieldRoot.Root control={control as any} hasDescription>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '110px 1fr',
            gap: 12,
            alignItems: 'start',
          }}
        >
          <FieldRoot.Label className="text-sm font-medium" style={{ paddingTop: 8 }} />
          <div>
            <FieldRoot.Control />
            <FieldRoot.Description
              style={{ fontSize: 12, color: 'var(--ifm-color-emphasis-600)', marginTop: 4 }}
            >
              Мы не передаём email третьим сторонам.
            </FieldRoot.Description>
            <FieldRoot.Error className="text-destructive text-sm mt-1 block" />
          </div>
        </div>
      </FieldRoot.Root>
    </div>
  );
}

export const cdkFormFieldDocConfig: ComponentDocConfig = {
  name: 'FormField (cdk)',
  importFrom: '@reformer/cdk/form-field',
  description:
    'Headless-анатомия поля: Root/Label/Control/Error/Description с автопровязкой id и aria. UI вы строите сами.',
  variants: [
    {
      id: 'auto',
      title: 'Auto-render',
      description:
        'Label и Control сами берут текст/компонент из ноды схемы, Error прячется до touch.',
      render: AutoRender,
      code: `import { FormField } from '@reformer/cdk/form-field';

<FormField.Root control={form.email}>
  <FormField.Label />
  <FormField.Control />
  <FormField.Error />
</FormField.Root>`,
    },
    {
      id: 'custom',
      title: 'Кастомная раскладка',
      description:
        'Горизонтальный layout + Description. hasDescription прописывает aria-describedby.',
      render: CustomLayout,
      code: `<FormField.Root control={form.email} hasDescription>
  <div className="grid grid-cols-[110px_1fr] gap-3 items-start">
    <FormField.Label className="pt-2 text-sm font-medium" />
    <div>
      <FormField.Control />
      <FormField.Description>Мы не передаём email третьим сторонам.</FormField.Description>
      <FormField.Error />
    </div>
  </div>
</FormField.Root>`,
    },
  ],
  examples: [
    {
      id: 'ui-kit',
      title: 'Готовый FormField из ui-kit',
      description:
        'В большинстве форм достаточно ui-kit FormField, собранного на этих блоках — без спуска на уровень cdk.',
      render: AutoRender,
      code: `import { FormField } from '@reformer/ui-kit';

// Один универсальный компонент вместо ручной анатомии:
<FormField control={form.email} />`,
    },
  ],
  props: [
    {
      name: 'FormField.Root',
      type: 'control: FieldNode<T>',
      description: 'Провайдер контекста; подписывается на useFormControl один раз.',
    },
    {
      name: 'FormField.Label',
      type: '—',
      description: '<label> с htmlFor; текст из componentProps.label, «*» при required.',
    },
    {
      name: 'FormField.Control',
      type: 'asChild?',
      description:
        'Auto-рендер control.component (value/onChange/onBlur/disabled/aria-*) или Slot в свой элемент.',
    },
    {
      name: 'FormField.Error',
      type: 'multi?, render?',
      description: '<p role="alert"> с ошибкой; скрыт, пока shouldShowError=false.',
    },
    {
      name: 'FormField.Description',
      type: '—',
      description: '<p> с id для aria-describedby (нужен hasDescription на Root).',
    },
    {
      name: 'useFormFieldContext()',
      type: '→ { control, value, errors, ids, componentProps, pending }',
      description: 'Доступ к состоянию из произвольных детей.',
    },
  ],
};
