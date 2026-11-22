import type { RuntimePropDoc } from './props-schema';

/**
 * Seam-контракт: props, которые резолвит форма, а НЕ автор `componentProps`.
 * Общий для всех field-вариантов; вариант может переопределить `value`/`onChange` под свой адаптер
 * (см. `mergeFieldPropsSchema` — спред варианта идёт последним).
 *
 * Держится отдельно от `properties` схемы, чтобы схема не врала, будто эти ключи можно указать
 * в `componentProps`. Валидатор DSL этот блок не видит (вырезается вместе с `x-*`).
 */
export const seamRuntimeProps: Record<string, RuntimePropDoc> = {
  value: {
    group: 'Control',
    type: 'unknown',
    kind: 'readonly',
    description:
      'Текущее значение поля. Резолвится формой (сигнал модели), не задаётся в componentProps.',
  },
  onChange: {
    group: 'Control',
    type: '(value: unknown) => void',
    kind: 'readonly',
    description: 'Value-based колбэк изменения. Форма подставляет control.setValue.',
  },
  onBlur: {
    group: 'Control',
    type: '() => void',
    kind: 'readonly',
    description: 'Отметка touched. Форма подставляет control.markAsTouched.',
  },
  disabled: {
    group: 'State',
    type: 'boolean',
    kind: 'boolean',
    default: false,
    description:
      'Блокировка поля. Задаётся через control.disable()/enable(), НЕ через componentProps: ' +
      'FormFieldControl.tsx:104-115 ставит disabled ПОСЛЕ спреда componentProps, поэтому ' +
      'componentProps.disabled мёртв.',
  },
};
