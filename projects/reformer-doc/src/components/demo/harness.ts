import { useRef } from 'react';
import { createModel, createForm } from '@reformer/core';
import { defineValidationSchema, validate, validateModel } from '@reformer/core/validation';
import type { ValidationSchema } from '@reformer/core/validation';

/**
 * Конфиг одного поля для живого демо: значение, компонент, его пропсы и валидаторы.
 * Layout-нода M1 — `{ value, component, componentProps }`; правила валидации в неё
 * НЕ кладутся — из `validators` собирается отдельная validation-схема
 * (`@reformer/core/validation`), запускаемая раннером `validateModel`.
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
  /**
   * Пометить поле как `touched` сразу на маунте — чтобы статически показать
   * состояние ошибки (invalid) в variant-карточке: `shouldShowError` истинен
   * только для touched-поля с ошибкой. Вместе с `validators`, которые не
   * проходят на `initial`, harness сразу прогоняет `validateModel`, и ошибка
   * ложится в ноду.
   */
  touched?: boolean;
  /**
   * Презентационная опция обёртки {@link makeFieldVariant}: не ограничивать
   * поле шириной 380px, а растянуть на всю ширину превью — для широких
   * контролов (dropzone-зоны FileUpload и т.п.).
   */
  fullWidth?: boolean;
}

/**
 * Поднимает минимальную M1-форму c одним полем `field` и возвращает
 * `{ model, form, control, validation }`. Стабилен на весь жизненный цикл демо
 * (`useRef`), поэтому вызывать ТОЛЬКО из компонента, который живёт под
 * `<BrowserOnly>`.
 *
 * Паттерн привязки — как в реальном использовании: layout без валидаторов
 * (`<FormField control={control} />`), правила — в `validation`
 * (готовая `ValidationSchema`, запуск: `await validateModel(model, validation)`).
 */
export function useDemoField(config: DemoFieldConfig) {
  // Собираем форму один раз (на первом рендере) и фиксируем — конфиг после
  // маунта не переслушиваем (knobs обновляют компонент через updateComponentProps).
  const ref = useRef<{
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    model: any;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    form: any;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    control: any;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    validation: ValidationSchema<any>;
  } | null>(null);
  if (ref.current === null) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const model = createModel<any>({ field: config.initial });
    const schema = {
      field: {
        value: model.$.field,
        component: config.component,
        componentProps: config.componentProps,
      },
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const form = createForm<any>({ model, schema });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const control = (form as any).field;
    // Правила — отдельным слоем (schema стабильна на жизнь демо, abort-дедуп работает).
    const rules = config.validators ?? [];
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const validation = defineValidationSchema<any>(({ model: m }) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      if (rules.length) validate((m as any).$.field, rules);
    });
    if (config.disabled) control.disable();
    if (config.touched) control.markAsTouched();
    // Статическое error-состояние карточки: прогоняем валидацию сразу —
    // validateModel сам роутит ошибки в ноду.
    if (config.touched && rules.length) void validateModel(model, validation);
    ref.current = { model, form, control, validation };
  }
  return ref.current;
}
