/**
 * Синхронное монтирование формы: всё уже загружено.
 *
 * Отделение от `FormOutlet` не косметическое. Хук сборки — ленивый `useState`, его фабрика
 * вызывается РОВНО один раз; строить форму, пока не приехали схема, реестр и поведение, нельзя —
 * первый вызов зафиксировал бы неполный набор навсегда.
 *
 * Путей монтирования два, и выбирает их формат загруженного документа:
 * - формат 2 — единая сборка `createForm` + `FormRenderer`;
 * - прежний формат — `createJsonForm` + `JsonFormRenderer`. Так монтируются только записи прежнего
 *   контракта (с `renderBehavior`): документы остальных записей загрузчик уже перевёл в формат 2.
 *
 * @module reformer/form-registry/react/mounted-form
 */

import { useEffect, useMemo, type ReactNode } from 'react';
import { createForm, useFormBundle, type FormBundle, type FormModel } from '@reformer/core';
import type { FormBehavior } from '@reformer/core/behaviors';
import { FormRenderer } from '@reformer/renderer-react';
import {
  JsonFormRenderer,
  SchemaErrorBoundary,
  createJsonForm,
  schemaFormatOf,
  useJsonForm,
  useJsonRendererSettingsUnchecked,
  type JsonForm,
  type JsonFormSchemaV1,
} from '@reformer/renderer-json';
import type { FormEntry } from '../types';
import type { LoadedForm } from '../loader';

/**
 * Собранная форма, которую получает `onReady`: бандл единой сборки, а у записи прежнего
 * контракта — бандл `createJsonForm`. `model`, `form` и `validation` есть у обоих.
 */
export type MountedFormBundle<T extends object> = FormBundle<T> | JsonForm<T>;

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
  /** @deprecated Прежнее имя {@link MountedFormProps.behaviorOptions}. */
  renderBehaviorOptions?: Record<string, unknown>;
  /** Своя отрисовка ошибки рендера формы. */
  errorFallback?: (error: Error, entry: FormEntry<T>) => ReactNode;
  onReady?: (form: MountedFormBundle<T>) => void;
}

/** Пропсы пути монтирования: настройки места уже сведены к одному значению. */
interface MountPathProps<T extends object> extends Omit<
  MountedFormProps<T>,
  'behaviorOptions' | 'renderBehaviorOptions'
> {
  options: Record<string, unknown> | undefined;
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

/** Единая сборка: документ формата 2 → `createForm` → `FormRenderer`. */
function BundleMountedForm<T extends object>({
  entry,
  loaded,
  initial,
  model,
  options,
  errorFallback,
  onReady,
}: MountPathProps<T>): ReactNode {
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

  // Резолв адаптеров полей чужого кита хост задаёт провайдером рендерера — доносим его и сюда.
  // Обёртку поля оттуда НЕ берём: её кладёт в бандл реестр формы, и он главнее реестра хоста.
  const { resolveFieldAdapter } = useJsonRendererSettingsUnchecked();
  const settings = useMemo(
    () => (resolveFieldAdapter ? { resolveFieldAdapter } : undefined),
    [resolveFieldAdapter]
  );

  return <FormRenderer<T> form={bundle} settings={settings} />;
}

/** Прежний путь: документ прежнего формата → `createJsonForm` → `JsonFormRenderer`. */
function LegacyMountedForm<T extends object>({
  entry,
  loaded,
  initial,
  model,
  options,
  errorFallback,
  onReady,
}: MountPathProps<T>): ReactNode {
  // Вся сборка — один вызов: модель, форма, валидация и render-behavior. Правила валидации уходят
  // в фабрику, и фабрика поведения получает уже СОБРАННЫЙ бандл (`validateStep`/`validateAll`) —
  // ровно то, что нужно визарду, вместо сырых правил. Ссылка на поведение стабильна по построению,
  // отдельный `useMemo` больше не нужен.
  const jsonForm = useJsonForm(() =>
    createJsonForm<T>({
      schema: loaded.schema as JsonFormSchemaV1<T>,
      registry: loaded.registry,
      ...modelSourceOf(loaded, model, initial),
      behavior: behaviorOf(loaded, options),
      ...(loaded.validation ? { validation: loaded.validation } : {}),
      ...(loaded.makeRenderBehavior
        ? {
            renderBehavior: (form, formModel, validation) =>
              loaded.makeRenderBehavior!(form, formModel, validation, options),
          }
        : {}),
    })
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
        // renderBehavior приезжает бандлом (см. выше) — отдельным пропом его дублировать не нужно.
        // Валидация схемы — ответственность загрузчика (этап 2), не рендерера:
        // проп тянет ajv и компилирует мета-схему на каждый инстанс формы.
        validateSchema={false}
      />
    </SchemaErrorBoundary>
  );
}

/**
 * Монтирует загруженную форму. Путь сборки выбирает формат документа: формат 2 — единая сборка
 * `createForm`, прежний формат — `createJsonForm` (записи прежнего контракта).
 */
export function MountedForm<T extends object>({
  behaviorOptions,
  renderBehaviorOptions,
  ...rest
}: MountedFormProps<T>): ReactNode {
  const options = behaviorOptions ?? renderBehaviorOptions;
  // Формат документа у смонтированной формы не меняется: запись пересоздаётся ключом `FormOutlet`.
  return schemaFormatOf(rest.loaded.schema) === 2 ? (
    <BundleMountedForm<T> {...rest} options={options} />
  ) : (
    <LegacyMountedForm<T> {...rest} options={options} />
  );
}
