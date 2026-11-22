/**
 * Конфиг ноды поля.
 *
 * @group Types
 */

import type { Signal } from '@preact/signals-core';
import type { ComponentRef } from './schema-node';

/**
 * Конфигурация поля формы ({@link FormControl}): сигнал значения из модели и то, что нода берёт
 * из узла схемы.
 *
 * В схеме формы поле записывают узлом `{ model: model.$.field, component, componentProps }`;
 * сборка `createFormFromModel` превращает узел в этот конфиг сама. Правил валидации в конфиге нет —
 * они живут в схеме валидации (`defineValidation`, `@reformer/core/validation`).
 *
 * @group Types
 * @category Configuration Types
 */
export interface FieldConfig<T> {
  /**
   * Сигнал значения из {@link FormModel} — источник истины значения поля. Нода значением не
   * владеет, а ссылается на этот сигнал.
   */
  valueSignal: Signal<T>;
  /**
   * UI-компонент поля. Опционален: core-часть можно использовать без ссылки на компонент
   * (значение и состояние работают без UI; компонент нужен только для рендеринга).
   */
  component?: ComponentRef;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  componentProps?: any;
  disabled?: boolean;
}
