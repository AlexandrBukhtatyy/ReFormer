/**
 * Синхронное монтирование формы: всё уже загружено.
 *
 * Отделение от `FormOutlet` не косметическое. Хук сборки — ленивый `useState`, его фабрика
 * вызывается РОВНО один раз; строить форму, пока не приехали схема, реестр и поведение, нельзя —
 * первый вызов зафиксировал бы неполный набор навсегда.
 *
 * Сборка — `createForm` + `FormRenderer`: документ формата 2 (прежний формат загрузчик уже
 * перевёл).
 *
 * @module reformer/form-registry/react/mounted-form
 */

import { useEffect, useMemo, type ReactNode } from 'react';
import { createForm, type FormBundle, type FormModel } from '@reformer/core';
import { useFormBundle } from '@reformer/core/react';
import type { FormBehavior } from '@reformer/core/behaviors';
import { FormRenderer, type RendererSettings } from '@reformer/renderer-react';
import { SchemaErrorBoundary } from '@reformer/renderer-json';
import type { FormEntry } from '../types';
import type { LoadedForm } from '../loader';

/** Собранная форма, которую получает `onReady`, — бандл сборки `createForm`. */
export type MountedFormBundle<T extends object> = FormBundle<T>;

export interface MountedFormProps<T extends object> {
  entry: FormEntry<T>;
  loaded: LoadedForm<T>;
  /** Переопределение начальных значений (напр. из параметров маршрута). */
  initial?: T;
  /** Готовая модель — приоритетнее `initial` и того, что несёт запись. */
  model?: FormModel<T>;
  /**
   * Настройки МЕСТА монтирования — колбэки хоста (напр. `onResult`). Приходят аргументом в
   * фабрику поведения записи (`FormEntry.behavior`). В самой записи им не место — она одна на все
   * места, где форму покажут.
   */
  behaviorOptions?: Record<string, unknown>;
  /**
   * Резолв адаптеров полей для компонентов чужого кита (`settings.resolveFieldAdapter` рендерера).
   * `FormOutlet` передаёт сюда `options.resolveFieldAdapter` провайдера реестра.
   */
  resolveFieldAdapter?: RendererSettings['resolveFieldAdapter'];
  /** Своя отрисовка ошибки рендера формы. */
  errorFallback?: (error: Error, entry: FormEntry<T>) => ReactNode;
  onReady?: (form: MountedFormBundle<T>) => void;
}

/** Поведение записи: готовое либо собранное фабрикой из настроек места монтирования. */
function behaviorOf<T extends object>(
  loaded: LoadedForm<T>,
  options: Record<string, unknown> | undefined
): FormBehavior<T> | undefined {
  const { behavior } = loaded;
  return typeof behavior === 'function' ? behavior(options ?? {}) : behavior;
}

/** Откуда взять модель: проп места → фабрика записи → начальные значения. */
function modelSourceOf<T extends object>(
  loaded: LoadedForm<T>,
  model: FormModel<T> | undefined,
  initial: T | undefined
): { model: FormModel<T> } | { initial: T } {
  if (model) return { model };
  if (loaded.makeModel) return { model: loaded.makeModel() };
  return { initial: (initial ?? loaded.initial) as T };
}

/**
 * Монтирует загруженную форму: документ формата 2 → `createForm` → `FormRenderer`.
 */
export function MountedForm<T extends object>({
  entry,
  loaded,
  initial,
  model,
  behaviorOptions: options,
  resolveFieldAdapter,
  errorFallback,
  onReady,
}: MountedFormProps<T>): ReactNode {
  // Вся сборка — один вызов: модель, дерево из документа (его строит реестр), форма, поведение и
  // валидация. Реестр уходит в сборку ЯВНО, а не через контекст: провайдер хоста и рендерер
  // ремоута могут оказаться в разных бандлах, а React-контекст границу не пересекает.
  const bundle = useFormBundle(() => {
    const behavior = behaviorOf(loaded, options);
    const built = createForm<T>({
      schema: loaded.schema,
      registry: loaded.registry,
      ...modelSourceOf(loaded, model, initial),
      ...(behavior ? { behavior } : {}),
      ...(loaded.validation ? { validation: loaded.validation } : {}),
      ...(loaded.flow ? { flow: loaded.flow } : {}),
    });
    if (!errorFallback) return built;
    // Своя отрисовка ошибки: границу, которую положил в бандл реестр, заменяет граница с
    // fallback'ом места монтирования. Компонент создаётся один раз — вместе с бандлом.
    const Boundary = ({ children }: { children: ReactNode }): ReactNode => (
      <SchemaErrorBoundary fallback={(error) => errorFallback(error, entry)}>
        {children}
      </SchemaErrorBoundary>
    );
    return { ...built, render: { ...built.render, errorBoundary: Boundary } };
  });

  useEffect(() => {
    onReady?.(bundle);
  }, [bundle, onReady]);

  // Обёртку поля из настроек хоста НЕ берём: её кладёт в бандл реестр формы.
  const settings = useMemo(
    () => (resolveFieldAdapter ? { resolveFieldAdapter } : undefined),
    [resolveFieldAdapter]
  );

  return <FormRenderer<T> form={bundle} settings={settings} />;
}
