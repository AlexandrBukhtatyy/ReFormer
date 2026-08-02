/**
 * JsonFormRenderer — главный компонент для рендеринга форм из JSON-схемы
 *
 * @module reformer/renderer-json/components
 */

import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import {
  FormRenderer,
  createRenderSchema,
  type RenderBehaviorFn,
  type RenderSchemaProxy,
} from '@reformer/renderer-react';
import type { FormModel } from '@reformer/core';
import type { JsonFormSchema } from '../types/json-schema';
import { useJsonRendererSettings } from '../context/json-renderer-context';
import { createRenderSchemaFromJsonM1 } from '../converter/json-to-render-schema';
import { SchemaErrorPanel } from './schema-error-panel';

/**
 * Props of {@link JsonFormRenderer}.
 *
 * @typeParam T - Тип формы (`getReformerForm<T>()`).
 */
export interface JsonFormRendererProps<T> {
  /** JSON-схема формы. См. {@link JsonFormSchema}. */
  schema: JsonFormSchema;
  /**
   * Модель данных формы (M1). Листья схемы (`value: '$model(path)'`) биндятся к её сигналам
   * (`model.signalAt(path)`) конвертером {@link createRenderSchemaFromJsonM1}. Обязательна — это
   * per-form состояние, поэтому передаётся пропом рендерера, а не глобальными настройками
   * {@link JsonRendererProvider} (там — общий на всё поддерево реестр/`fieldWrapper`).
   */
  model: FormModel<T>;
  /** Опциональный behavior: hideWhen/patchProps/onComponentEvent поверх готовой схемы. */
  renderBehavior?: RenderBehaviorFn<T>;
  /** Колбэк, получающий построенный `RenderSchemaProxy` для внешних манипуляций. */
  onSchemaReady?: (schema: RenderSchemaProxy<T>) => void;
  /**
   * Валидировать JSON-схему против мета-схемы перед рендером. При ошибках рисует
   * {@link SchemaErrorPanel} вместо формы. ajv грузится **динамически** (`import('../validate')`) —
   * в prod-бандл не попадает, пока `validateSchema` не включён.
   *
   * По умолчанию `false`. Чтобы валидировать только в dev, приложение передаёт значение из
   * СВОЕГО окружения: `validateSchema={import.meta.env.DEV}` — детекцию dev нельзя «запечь» в пакет,
   * т.к. `import.meta.env.DEV` инлайнится в `false` при production-сборке самого пакета.
   */
  validateSchema?: boolean;
}

/**
 * Главный компонент пакета. Рендерит форму, описанную JSON-схемой.
 *
 * Должен использоваться внутри {@link JsonRendererProvider}, который снабжает рендерер
 * реестром компонентов. Без реестра компонент бросит исключение при попытке резолва.
 *
 * @typeParam T - Тип формы.
 *
 * @example Форма из JSON-схемы (M1)
 * ```tsx
 * import { useMemo } from 'react';
 * import { createModel } from '@reformer/core';
 * import { Input, Box, FormField } from '@reformer/ui-kit';
 * import {
 *   JsonFormRenderer,
 *   JsonRendererProvider,
 *   defineRegistry,
 *   FIELD_WRAPPER,
 *   type JsonFormSchema,
 * } from '@reformer/renderer-json';
 *
 * // Привязки — строки-операторы: '$model(...)', '$component(...)', '$dataSource(...)'.
 * const schema: JsonFormSchema = {
 *   version: '1.0',
 *   root: {
 *     component: '$component(Box)',
 *     children: [
 *       {
 *         value: '$model(email)',
 *         component: '$component(Input)',
 *         componentProps: { label: 'Email' },
 *       },
 *     ],
 *   },
 * };
 *
 * type MyForm = { email: string };
 *
 * function MyFormPage() {
 *   // M1: модель — источник истины значений; листья схемы биндятся к её сигналам.
 *   const model = useMemo(() => createModel<MyForm>({ email: '' }), []);
 *   const registry = useMemo(() => defineRegistry((reg) => {
 *     reg.component('Input', Input);
 *     reg.component('Box', Box);
 *     reg.component(FIELD_WRAPPER, FormField); // системная обёртка полей
 *   }), []);
 *
 *   // Реестр — глобальная настройка через провайдер; модель — per-form проп рендерера.
 *   return (
 *     <JsonRendererProvider settings={{ registry }}>
 *       <JsonFormRenderer<MyForm> schema={schema} model={model} validateSchema={import.meta.env.DEV} />
 *     </JsonRendererProvider>
 *   );
 * }
 * ```
 *
 * **Note**: `JsonFormRenderer` принимает `{ schema, model, renderBehavior?, onSchemaReady?, validateSchema? }`.
 * Под M1 модель (`FormModel`) обязательна и передаётся пропом `model` — это per-form состояние;
 * листья JSON-схемы биндятся к её сигналам конвертером {@link createRenderSchemaFromJsonM1}.
 *
 * @see [docs/llms/01-overview.md](../../docs/llms/01-overview.md)
 */
export function JsonFormRenderer<T>({
  schema,
  model,
  renderBehavior,
  onSchemaReady,
  validateSchema = false,
}: JsonFormRendererProps<T>): ReactNode {
  const { registry, ...rendererSettings } = useJsonRendererSettings();

  // Результат валидации схемы: `undefined` — ещё считаем (validateSchema вкл.), `null` — выключена/прошла,
  // непустой массив — невалидна (рисуем панель вместо формы). ajv грузится динамически.
  const [schemaErrors, setSchemaErrors] = useState<string[] | null | undefined>(
    validateSchema ? undefined : null
  );

  useEffect(() => {
    if (!validateSchema) {
      setSchemaErrors(null);
      return;
    }
    let cancelled = false;
    setSchemaErrors(undefined);
    import('../validate')
      .then(({ validateFormSchema }) => {
        if (cancelled) return;
        const { valid, errors } = validateFormSchema(schema, { registry });
        setSchemaErrors(valid ? null : errors);
      })
      .catch((err: unknown) => {
        if (!cancelled) setSchemaErrors([`Schema validator failed to load: ${String(err)}`]);
      });
    return () => {
      cancelled = true;
    };
  }, [validateSchema, schema, registry]);

  // §8 (dev): renderBehavior должен быть стабильным по ссылке — от него зависит useMemo сборки
  // дерева ниже. Смена идентичности между рендерами пересобирает proxy каждый рендер (лишняя работа,
  // потеря наложенного behavior-состояния). Раньше это было тихо — теперь громко предупреждаем в dev.
  const prevRenderBehavior = useRef(renderBehavior);
  useEffect(() => {
    if (import.meta.env.DEV && prevRenderBehavior.current !== renderBehavior) {
      console.warn(
        '[JsonFormRenderer] `renderBehavior` changed identity between renders — the render tree is ' +
          'rebuilt every render. Provide a stable reference (useMemo/useCallback/module-level const).'
      );
    }
    prevRenderBehavior.current = renderBehavior;
  }, [renderBehavior]);

  const schemaProxy = useMemo(() => {
    // M1 (единая схема): листья биндятся к сигналам модели. Модель обязательна (legacy
    // FieldPath-конвертер удалён в Ф7) — передаётся пропом рендерера (per-form состояние).
    if (!model) {
      throw new Error(
        'JsonFormRenderer: `model` prop is required (M1). Pass the FormModel to <JsonFormRenderer model={...} />.'
      );
    }
    // Не строим дерево, пока валидация не прошла: невалидную схему `resolveComponent` всё равно
    // не сконвертирует (кинет до показа панели). null → форму рендерим; иначе — ждём/показываем ошибки.
    if (schemaErrors !== null) return null;
    // Явная проверка (как для model): DEV-only guard в useJsonRendererSettings вырезается из прод-сборки,
    // без этого `registry!` тихо ломается позже внутри конвертера (`registry.get is not a function`).
    if (!registry) {
      throw new Error(
        'JsonFormRenderer: settings.registry is required. Pass a ComponentRegistry via JsonRendererProvider.'
      );
    }
    const fn = createRenderSchemaFromJsonM1<T>(schema, registry, model);
    const proxy = createRenderSchema<T>(fn);
    if (renderBehavior) {
      renderBehavior(proxy);
    }
    return proxy;
  }, [schema, registry, renderBehavior, model, schemaErrors]);

  useMemo(() => {
    if (schemaProxy && onSchemaReady) onSchemaReady(schemaProxy);
  }, [schemaProxy]);

  if (schemaErrors && schemaErrors.length > 0) {
    return <SchemaErrorPanel errors={schemaErrors} />;
  }
  if (!schemaProxy) {
    return null; // валидация ещё считается (динамический импорт ajv)
  }
  return <FormRenderer render={schemaProxy} settings={rendererSettings} />;
}
