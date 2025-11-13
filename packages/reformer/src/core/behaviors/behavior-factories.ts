/**
 * Behavior Factories - фабричные функции для создания behavior handlers
 *
 * Каждая фабрика принимает параметры поведения и возвращает BehaviorHandlerFn.
 * BehaviorHandlerFn - это функция, которая создает effect подписку.
 */

import { effect } from '@preact/signals-react';
import type { FormNode } from '../nodes/form-node';
import type { GroupNode } from '../nodes/group-node';
import type {
  BehaviorHandlerFn,
  BehaviorContext,
  CopyFromOptions,
  EnableWhenOptions,
  ComputeFromOptions,
  WatchFieldOptions,
  RevalidateWhenOptions,
  SyncFieldsOptions,
} from './types';
import type { FieldPathNode } from '../types';

/**
 * Вспомогательная функция для разрешения узла формы по пути
 *
 * @param form - Корневая форма
 * @param fieldPath - Путь к полю
 * @returns Узел формы или undefined
 */
function resolveNode<T extends Record<string, any>>(
  form: GroupNode<T>,
  fieldPath: string
): FormNode<any> | undefined {
  return form.getFieldByPath(fieldPath);
}

// ============================================================================
// copyFrom - Копирование значений между полями
// ============================================================================

/**
 * Создает behavior для копирования значений между полями
 *
 * @param target - Куда копировать
 * @param source - Откуда копировать
 * @param options - Опции копирования
 * @returns BehaviorHandlerFn
 */
export function createCopyBehavior<TForm extends Record<string, any>, TSource>(
  target: FieldPathNode<TForm, any>,
  source: FieldPathNode<TForm, TSource>,
  options?: CopyFromOptions<TForm, TSource>
): BehaviorHandlerFn<TForm> {
  const { when, fields = 'all', transform } = options || {};

  return (form, _context, withDebounce) => {
    const sourceNode = resolveNode(form, source.__path);
    const targetNode = resolveNode(form, target.__path);

    if (!sourceNode || !targetNode) return null;

    return effect(() => {
      const sourceValue = sourceNode.value.value;

      withDebounce(() => {
        // Проверка условия
        if (when) {
          const formValue = form.getValue();
          if (!when(formValue)) return;
        }

        // Трансформация значения
        const value = transform ? transform(sourceValue) : sourceValue;

        // Копирование
        if (fields === 'all' || !fields) {
          targetNode.setValue(value, { emitEvent: false });
        } else {
          // Частичное копирование для групп
          const patch: any = {};
          fields.forEach((key) => {
            if (sourceValue && typeof sourceValue === 'object') {
              patch[key] = (sourceValue as any)[key];
            }
          });
          if ('patchValue' in targetNode) {
            (targetNode as any).patchValue(patch);
          }
        }
      });
    });
  };
}

// ============================================================================
// enableWhen - Условное включение/выключение полей
// ============================================================================

/**
 * Создает behavior для условного включения/выключения поля
 *
 * @param field - Поле для включения/выключения
 * @param condition - Функция условия (true = enable, false = disable)
 * @param options - Опции
 * @returns BehaviorHandlerFn
 */
export function createEnableBehavior<TForm extends Record<string, any>>(
  field: FieldPathNode<TForm, any>,
  condition: (form: TForm) => boolean,
  options?: EnableWhenOptions
): BehaviorHandlerFn<TForm> {
  const { resetOnDisable = false } = options || {};

  return (form, _context, withDebounce) => {
    const targetNode = resolveNode(form, field.__path);
    if (!targetNode) return null;

    return effect(() => {
      const formValue = form.value.value;

      withDebounce(() => {
        const shouldEnable = condition(formValue);

        if (shouldEnable) {
          targetNode.enable && targetNode.enable();
        } else {
          targetNode.disable && targetNode.disable();
          if (resetOnDisable) {
            targetNode.reset();
          }
        }
      });
    });
  };
}

// ============================================================================
// showWhen - Условное отображение/скрытие полей
// ============================================================================

/**
 * Создает behavior для условного отображения/скрытия поля
 *
 * @param field - Поле для отображения/скрытия
 * @param condition - Функция условия (true = show, false = hide)
 * @returns BehaviorHandlerFn
 */
export function createShowBehavior<TForm extends Record<string, any>>(
  _field: FieldPathNode<TForm, any>,
  _condition: (form: TForm) => boolean
): BehaviorHandlerFn<TForm> {
  return (_form, _context, _withDebounce) => {
    if (import.meta.env.DEV) {
      console.warn(
        'BehaviorRegistry: "show" behavior is not implemented yet. Use "enable" instead.'
      );
    }
    return null;
  };
}

// ============================================================================
// computeFrom - Вычисляемые поля
// ============================================================================

/**
 * Создает behavior для вычисления значения поля на основе других полей
 *
 * @param target - Поле для записи результата
 * @param sources - Массив полей-зависимостей
 * @param computeFn - Функция вычисления
 * @param options - Опции
 * @returns BehaviorHandlerFn
 */
export function createComputeBehavior<TForm extends Record<string, any>>(
  target: FieldPathNode<TForm, any>,
  sources: FieldPathNode<TForm, any>[],
  computeFn: (...values: any[]) => any,
  options?: ComputeFromOptions<TForm>
): BehaviorHandlerFn<TForm> {
  const { condition } = options || {};

  return (form, _context, withDebounce) => {
    const targetNode = resolveNode(form, target.__path);
    if (!targetNode) return null;

    // Разрешаем source узлы
    const sourceNodes = sources
      .map((field) => resolveNode(form, field.__path))
      .filter((node): node is FormNode<any> => node !== undefined);

    if (sourceNodes.length === 0) return null;

    return effect(() => {
      // Читаем значения всех source полей
      const sourceValues = sourceNodes.map((node) => node.value.value);

      withDebounce(() => {
        // Проверка условия
        if (condition) {
          const formValue = form.getValue();
          if (!condition(formValue)) return;
        }

        // Вычисляем новое значение
        const computedValue = computeFn(...sourceValues);

        // Устанавливаем значение без триггера событий
        targetNode.setValue(computedValue, { emitEvent: false });
      });
    });
  };
}

// ============================================================================
// watchField - Подписка на изменения
// ============================================================================

/**
 * Создает behavior для выполнения callback при изменении поля
 *
 * @param field - Поле для отслеживания
 * @param callback - Функция обратного вызова
 * @param options - Опции
 * @returns BehaviorHandlerFn
 */
export function createWatchBehavior<TForm extends Record<string, any>, TField>(
  field: FieldPathNode<TForm, TField>,
  callback: (value: TField, ctx: BehaviorContext<TForm>) => void | Promise<void>,
  options?: WatchFieldOptions
): BehaviorHandlerFn<TForm> {
  const { immediate = false } = options || {};

  return (form, context, withDebounce) => {
    const node = resolveNode(form, field.__path);
    if (!node) return null;

    // Вызвать сразу если immediate: true
    if (immediate) {
      const value = node.value.value;
      callback(value, context);
    }

    return effect(() => {
      const value = node.value.value;

      withDebounce(() => {
        callback(value, context);
      });
    });
  };
}

// ============================================================================
// revalidateWhen - Перевалидация при изменении других полей
// ============================================================================

/**
 * Создает behavior для перевалидации поля при изменении других полей
 *
 * @param target - Поле для перевалидации
 * @param triggers - Поля-триггеры
 * @param options - Опции
 * @returns BehaviorHandlerFn
 */
export function createRevalidateBehavior<TForm extends Record<string, any>>(
  target: FieldPathNode<TForm, any>,
  triggers: FieldPathNode<TForm, any>[],
  _options?: RevalidateWhenOptions
): BehaviorHandlerFn<TForm> {
  return (form, _context, withDebounce) => {
    const targetNode = resolveNode(form, target.__path);
    if (!targetNode) return null;

    const sourceNodes = triggers
      .map((field) => resolveNode(form, field.__path))
      .filter((node): node is FormNode<any> => node !== undefined);

    if (sourceNodes.length === 0) return null;

    return effect(() => {
      // Отслеживаем изменения source полей
      sourceNodes.forEach((node) => node.value.value);

      withDebounce(() => {
        // Перезапускаем валидацию target поля
        targetNode.validate();
      });
    });
  };
}

// ============================================================================
// syncFields - Двусторонняя синхронизация
// ============================================================================

/**
 * Создает behavior для двусторонней синхронизации полей
 *
 * @param field1 - Первое поле
 * @param field2 - Второе поле
 * @param options - Опции
 * @returns BehaviorHandlerFn
 */
export function createSyncBehavior<TForm extends Record<string, any>, T>(
  field1: FieldPathNode<TForm, T>,
  field2: FieldPathNode<TForm, T>,
  options?: SyncFieldsOptions<T>
): BehaviorHandlerFn<TForm> {
  const { transform } = options || {};

  return (form, _context, withDebounce) => {
    const sourceNode = resolveNode(form, field1.__path);
    const targetNode = resolveNode(form, field2.__path);

    if (!sourceNode || !targetNode) return null;

    // Флаг для предотвращения циклических обновлений
    let isUpdating = false;

    const dispose1 = effect(() => {
      const sourceValue = sourceNode.value.value;

      if (isUpdating) return;

      withDebounce(() => {
        isUpdating = true;
        const finalValue = transform ? transform(sourceValue) : sourceValue;
        targetNode.setValue(finalValue, { emitEvent: false });
        isUpdating = false;
      });
    });

    const dispose2 = effect(() => {
      const targetValue = targetNode.value.value;

      if (isUpdating) return;

      withDebounce(() => {
        isUpdating = true;
        // Обратная синхронизация (без трансформации)
        sourceNode.setValue(targetValue, { emitEvent: false });
        isUpdating = false;
      });
    });

    // Возвращаем комбинированный cleanup
    return () => {
      dispose1();
      dispose2();
    };
  };
}
