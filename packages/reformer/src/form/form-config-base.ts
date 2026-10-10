/**
 * Общие типы фабрик формы, построенных поверх `createForm`: `createReactForm`
 * (`@reformer/renderer-react`) и `createJsonForm` (`@reformer/renderer-json`).
 *
 * Сборка одна на все способы реализации формы — `createForm` (`form-bundle`); здесь лежит только
 * то, чем родственные фабрики описывают свой конфиг и результат.
 *
 * @module form/form-config-base
 */

import type { FormModel } from '../model/types';
import type { FormBehavior } from './behaviors';
import type { FormGroup } from './types/index';
import type { FormFlowConfig, FormLevel, FormValidation } from './form-level';
import type { ValidationDefinition } from './validation';

/**
 * Общая часть конфига всех фабрик формы.
 *
 * @typeParam T - Форма данных модели.
 * @typeParam B - Бандл конкретной фабрики (его получает {@link CreateFormConfigBase.setup}).
 */
export interface CreateFormConfigBase<T, B> {
  /** Начальные значения — из них создаётся модель. Взаимоисключимо с `model`. */
  initial?: T;
  /** Готовая модель (если создана отдельной фабрикой). Приоритетнее `initial`. */
  model?: FormModel<T>;
  /** Декларативное поведение модели (compute/copyFrom/enableWhen/onChange). */
  behavior?: FormBehavior<T>;
  /** Правила валидации: готовый набор либо {@link FormValidation} с `extras` и стратегией. */
  validation?: FormValidation<T> | ValidationDefinition<T>;
  /** Поток шагов: идентификатор шага и его правила — {@link FormFlowConfig}. */
  flow?: FormFlowConfig<T>;
  /**
   * Правка модели ДО сборки формы. Нужна там, где значение обязано существовать к моменту
   * построения нод — например, массив, наполняемый из вычислений (реактивные `onChange` на
   * инициализации не срабатывают).
   */
  seed?: (model: FormModel<T>) => void;
  /** Донастройка ПОСЛЕ сборки: получает готовый бандл фабрики. */
  setup?: (bundle: B) => void;
}

/**
 * Общая часть результата фабрик: модель, форма и уровень формы ({@link FormLevel}) — проверка,
 * отправка и поток шагов.
 */
export interface CoreForm<T> extends FormLevel<T> {
  readonly model: FormModel<T>;
  readonly form: FormGroup<T>;
}
