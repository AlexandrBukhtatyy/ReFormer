/* eslint-disable @typescript-eslint/no-explicit-any */
import type { CSSProperties, ReactNode } from 'react';
import { FormField as FieldRoot } from '@reformer/cdk/form-field';
import { FormField, InputField } from '@reformer/ui-kit';
import { required, email } from '@reformer/core/validators';
import { useDemoField } from '../harness';
import type { ComponentDocConfig } from '../types';

// Цвета зон анатомии — насыщенные средние тона, различимые в light и dark.
const ZONE = {
  label: '#3b82f6',
  input: '#8b5cf6',
  hint: '#64748b',
  validation: '#ef4444',
} as const;

/**
 * Обводит одну зону поля тонким пунктиром через `outline` (не влияет на layout —
 * отступы поля остаются «формовыми») и выносит подпись зоны вбок тонким текстом.
 */
function Zone({ name, color, children }: { name: string; color: string; children: ReactNode }) {
  return (
    <div style={{ position: 'relative' }}>
      <div style={{ outline: `1px dashed ${color}`, outlineOffset: 3, borderRadius: 4 }}>
        {children}
      </div>
      <span
        style={{
          position: 'absolute',
          left: '100%',
          top: '50%',
          transform: 'translateY(-50%)',
          marginLeft: 18,
          fontSize: 10,
          fontWeight: 700,
          letterSpacing: 0.5,
          textTransform: 'uppercase',
          color,
          whiteSpace: 'nowrap',
        }}
      >
        {name}
      </span>
    </div>
  );
}

/**
 * Анатомия поля: живой FormField с обычными «формовыми» отступами, у которого
 * каждая зона лишь помечена тонким пунктиром и подписью сбоку. Порядок сверху
 * вниз ровно как рисует ui-kit FormField — label → input → hint (description) →
 * validation (error).
 */
function AnatomyField() {
  const { control } = useDemoField({
    initial: '',
    component: InputField,
    componentProps: { label: 'Email', type: 'email', placeholder: 'you@example.com' },
    validators: [required({ message: 'Введите email' }), email()],
    touched: true,
  });

  const hintText: CSSProperties = { fontSize: 12, color: 'var(--ifm-color-emphasis-600)' };

  return (
    // Ширина как у поля в форме; справа — запас под боковые подписи зон.
    <div style={{ width: 300, paddingRight: 96 }}>
      <FieldRoot.Root control={control as any} hasDescription>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <Zone name="label" color={ZONE.label}>
            <FieldRoot.Label className="block text-sm font-medium" />
          </Zone>

          <Zone name="input" color={ZONE.input}>
            <FieldRoot.Control />
          </Zone>

          <Zone name="hint" color={ZONE.hint}>
            <FieldRoot.Description>
              <span
                style={{ display: 'flex', justifyContent: 'space-between', gap: 12, ...hintText }}
              >
                <span>Подсказка к полю</span>
                <span>слева / справа</span>
              </span>
            </FieldRoot.Description>
          </Zone>

          <Zone name="validation" color={ZONE.validation}>
            <FieldRoot.Error className="text-destructive text-sm block" />
          </Zone>
        </div>
      </FieldRoot.Root>
    </div>
  );
}

/** Обычное использование — тот же компонент без пунктирной разметки. */
function PlainUsage() {
  const { control } = useDemoField({
    initial: '',
    component: InputField,
    componentProps: {
      label: 'Email',
      type: 'email',
      placeholder: 'you@example.com',
      description: 'Не передаём email третьим сторонам.',
    },
    validators: [required({ message: 'Введите email' }), email()],
    touched: true,
  });
  return (
    <div style={{ maxWidth: 380, width: '100%' }}>
      <FormField control={control as any} />
    </div>
  );
}

export const uiKitFormFieldDocConfig: ComponentDocConfig = {
  name: 'FormField',
  importFrom: '@reformer/ui-kit',
  description:
    'Готовый wrapper поля: одним компонентом рисует четыре зоны — label, input, hint (description) и validation (error). Анатомия ниже показывает, где что рендерится.',
  variants: [
    {
      id: 'anatomy',
      title: 'Анатомия зон',
      description:
        'Сверху вниз: label → input → hint → validation. Hint — светлая подсказка под полем (выравнивается слева или справа); ошибка валидации показывается после hint.',
      render: AnatomyField,
      code: `import { FormField, InputField } from '@reformer/ui-kit';

// Зоны задаются через componentProps поля:
email: {
  value: model.$.email,
  component: InputField,
  componentProps: {
    label: 'Email',                        // → зона label
    placeholder: 'you@example.com',        // → зона input
    description: 'Подсказка под полем',     // → зона hint
  },
}

// Разметка — один компонент рисует все зоны:
<FormField control={form.email} />
// validation-зона появляется автоматически из ошибки поля (после touch)`,
    },
  ],
  examples: [
    {
      id: 'plain',
      title: 'Обычное использование',
      description:
        'Тот же FormField без пунктирной разметки: label, поле, светлый hint и ошибка валидации под ним.',
      render: PlainUsage,
      code: `import { FormField } from '@reformer/ui-kit';

<FormField control={form.email} />`,
    },
  ],
  props: [
    {
      name: 'label',
      type: 'string · componentProps',
      description: 'Зона label — подпись над полем; «*» добавляется при required.',
    },
    {
      name: 'input',
      type: 'component · componentProps',
      description:
        'Зона input — контрол из control.component (InputField и т.п.); placeholder/type берутся из componentProps.',
    },
    {
      name: 'description',
      type: 'string · componentProps',
      description:
        'Зона hint — светлая подсказка под полем (text-muted-foreground). Рендерится перед ошибкой.',
    },
    {
      name: 'validation',
      type: '— (auto)',
      description:
        'Зона validation — ошибка поля (text-destructive); показывается после hint, когда поле touched и невалидно.',
    },
    {
      name: 'control',
      type: 'FieldNode<T>',
      description: 'Само поле формы — источник component, componentProps, value и ошибки.',
    },
    {
      name: 'testId',
      type: 'string',
      description: 'Префикс data-testid: field-/label-/input-/error-<id>.',
    },
  ],
};
