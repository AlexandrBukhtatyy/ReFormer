/**
 * Синхронное монтирование формы: всё уже загружено.
 *
 * Отделение от `FormOutlet` не косметическое. `useJsonForm` — ленивый `useState`, его фабрика
 * вызывается РОВНО один раз; строить форму, пока не приехали схема, реестр и поведение, нельзя —
 * первый вызов зафиксировал бы неполный набор навсегда.
 *
 * @module reformer/form-registry/react/mounted-form
 */

import { useEffect, useMemo, type ReactNode } from 'react';
import type { FormModel } from '@reformer/core';
import {
  JsonFormRenderer,
  SchemaErrorBoundary,
  createJsonForm,
  useJsonForm,
  type JsonForm,
} from '@reformer/renderer-json';
import type { FormEntry } from '../types';
import type { LoadedForm } from '../loader';

export interface MountedFormProps<T extends object> {
  entry: FormEntry<T>;
  loaded: LoadedForm<T>;
  /** Переопределение начальных значений (напр. из параметров маршрута). */
  initial?: T;
  /** Готовая модель — приоритетнее `initial` и того, что несёт запись. */
  model?: FormModel<T>;
  /**
   * Настройки МЕСТА монтирования для фабрики render-behavior: колбэки хоста (напр. `onResult`).
   * В записи реестра им не место — она одна на все места, где форму покажут.
   */
  renderBehaviorOptions?: Record<string, unknown>;
  /** Своя отрисовка ошибки рендера формы. */
  errorFallback?: (error: Error, entry: FormEntry<T>) => ReactNode;
  onReady?: (form: JsonForm<T>) => void;
}

export function MountedForm<T extends object>({
  entry,
  loaded,
  initial,
  model,
  renderBehaviorOptions,
  errorFallback,
  onReady,
}: MountedFormProps<T>): ReactNode {
  const jsonForm = useJsonForm(() =>
    createJsonForm<T>({
      schema: loaded.schema,
      registry: loaded.registry,
      ...(model
        ? { model }
        : loaded.makeModel
          ? { model: loaded.makeModel() }
          : { initial: (initial ?? loaded.initial) as T }),
      behavior: loaded.behavior,
    })
  );

  // renderBehavior обязан быть стабильным по ссылке — иначе рендерер пересобирает
  // дерево каждый рендер и предупреждает об этом в dev.
  const renderBehavior = useMemo(
    () =>
      loaded.makeRenderBehavior?.(
        jsonForm.form,
        jsonForm.model,
        loaded.validation,
        renderBehaviorOptions
      ),
    [jsonForm, loaded, renderBehaviorOptions]
  );

  useEffect(() => {
    onReady?.(jsonForm);
  }, [jsonForm, onReady]);

  return (
    <SchemaErrorBoundary
      resetKey={jsonForm}
      fallback={errorFallback ? (e) => errorFallback(e, entry) : undefined}
    >
      <JsonFormRenderer<T>
        form={jsonForm}
        // Реестр ПРОПОМ, а не через контекст: провайдер хоста и рендерер ремоута
        // могут оказаться в разных бандлах, а React-контекст границу не пересекает.
        registry={loaded.registry}
        renderBehavior={renderBehavior}
        // Валидация схемы — ответственность загрузчика (этап 2), не рендерера:
        // проп тянет ajv и компилирует мета-схему на каждый инстанс формы.
        validateSchema={false}
      />
    </SchemaErrorBoundary>
  );
}
