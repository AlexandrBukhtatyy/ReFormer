import { useRef } from 'react';
import { createModel, createForm } from '@reformer/core';

/**
 * Конфиг одного поля для живого демо: значение, компонент, его пропсы и валидаторы.
 * Отражает M1-ноду схемы `{ value, component, componentProps, validators }`.
 */
export interface DemoFieldConfig {
  initial: unknown;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  component: any;
  componentProps?: Record<string, unknown>;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  validators?: any[];
  /**
   * Отключить поле. `disabled` в `componentProps` не сработает: контрол
   * жёстко прокидывает `disabled` из состояния узла (см. FormFieldControl),
   * поэтому disabled-пресеты выражаем через `control.disable()`.
   */
  disabled?: boolean;
}

/**
 * Поднимает минимальную M1-форму c одним полем `field` и возвращает
 * `{ model, form, control }`. Стабилен на весь жизненный цикл демо (`useMemo([])`),
 * поэтому вызывать ТОЛЬКО из компонента, который живёт под `<BrowserOnly>`.
 *
 * Паттерн привязки — как в реальном использовании: `<FormField control={control} />`.
 */
export function useDemoField(config: DemoFieldConfig) {
  // Собираем форму один раз (на первом рендере) и фиксируем — конфиг после
  // маунта не переслушиваем (knobs обновляют компонент через updateComponentProps).
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const ref = useRef<{ model: any; form: any; control: any; schema: any } | null>(null);
  if (ref.current === null) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const model = createModel<any>({ field: config.initial });
    const schema = {
      field: {
        value: model.$.field,
        component: config.component,
        componentProps: config.componentProps,
        validators: config.validators,
      },
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const form = createForm<any>({ model, schema });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const control = (form as any).field;
    if (config.disabled) control.disable();
    ref.current = { model, form, control, schema };
  }
  return ref.current;
}
