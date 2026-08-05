/**
 * JsonFormRenderer — главный компонент для рендеринга форм из JSON-схемы
 *
 * @module reformer/renderer-json/components
 */

import { useEffect, useMemo, useRef, useState, type ComponentType, type ReactNode } from 'react';
import {
  FormRenderer,
  createRenderSchema,
  type FieldWrapperProps,
  type RenderBehaviorFn,
  type RenderSchemaProxy,
} from '@reformer/renderer-react';
import type { FormModel } from '@reformer/core';
import type { JsonFormSchema } from '../types/json-schema';
import type { JsonForm } from '../create-json-form';
import { useJsonRendererSettingsUnchecked } from '../context/json-renderer-context';
import { FIELD_WRAPPER } from '../registry/constants';
import type { ComponentRegistry } from '../registry/types';
import { createRenderSchemaFromJsonM1 } from '../converter/json-to-render-schema';
import { collectSchemaSelectors } from '../collect-schema-selectors';
import { SchemaErrorPanel } from './schema-error-panel';
import { SchemaErrorBoundary } from './schema-error-boundary';

/**
 * Props of {@link JsonFormRenderer}.
 *
 * @typeParam T - Тип формы (`getReformerForm<T>()`).
 */
export interface JsonFormRendererProps<T> {
  /**
   * Собранный бандл {@link createJsonForm} (`{ model, form, schema, registry }`). Если задан —
   * поставляет `schema` + `model` (передавать их отдельно не нужно). Иначе укажи `schema` + `model`.
   */
  form?: JsonForm<T>;
  /**
   * JSON-схема формы. См. {@link JsonFormSchema}. Опционально, если задан `form`. Тип намеренно
   * НЕ параметризован `T`: рендерер принимает любую схему (в т.ч. `.json`-импорт «строкой с сервера»);
   * типобезопасность путей `$model(...)` даётся на этапе авторинга (`defineJsonSchema<T>`/`createJsonForm<T>`).
   */
  schema?: JsonFormSchema;
  /**
   * Модель данных формы (M1). Листья схемы (`value: '$model(path)'`) биндятся к её сигналам
   * (`model.signalAt(path)`) конвертером {@link createRenderSchemaFromJsonM1}. Per-form состояние,
   * поэтому передаётся пропом рендерера (не глобальными настройками {@link JsonRendererProvider}).
   * Опционально, если задан `form`.
   */
  model?: FormModel<T>;
  /**
   * Реестр компонентов. Приоритет: `registry` → `form.registry` → контекст
   * {@link JsonRendererProvider}.
   *
   * Нужен, когда провайдер и рендерер оказываются в РАЗНЫХ бандлах (микрофронты): React-контекст
   * границу бандла не пересекает, поэтому провайдер хоста невидим рендереру из ремоута. В прод-сборке
   * такой отказ МОЛЧАЛИВЫЙ — DEV-guard в `useJsonRendererSettings` вырезается при сборке пакета.
   * Проп убирает эту точку отказа: реестр передаётся напрямую, провайдер становится необязательным.
   */
  registry?: ComponentRegistry;
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
  form,
  schema: schemaProp,
  model: modelProp,
  registry: registryProp,
  renderBehavior,
  onSchemaReady,
  validateSchema = false,
}: JsonFormRendererProps<T>): ReactNode {
  // Unchecked: реестр может прийти пропом или из бандла `form`, и тогда провайдер не нужен —
  // обязательный DEV-guard ломал бы полностью рабочую конфигурацию (микрофронты). Проверка ниже.
  const { registry: contextRegistry, ...rendererSettings } = useJsonRendererSettingsUnchecked();

  // Бандл createJsonForm (проп `form`) поставляет schema+model; иначе — отдельные пропы schema+model.
  const schema = form?.schema ?? schemaProp;
  const model = form?.model ?? modelProp;
  // Явный проп важнее бандла, бандл важнее контекста.
  const registry = registryProp ?? form?.registry ?? contextRegistry;

  // `$fieldWrapper` — не обычный компонент: из реестра его достаёт ПРОВАЙДЕР и кладёт в
  // `settings.fieldWrapper`. Реестр, пришедший пропом или бандлом `form`, провайдера не проходит,
  // поэтому обёртку берём из того реестра, который реально используется. Без этого поля
  // рендерились бы голыми — без label, hint и ошибок, — и притом молча.
  const ownFieldWrapper =
    registry && registry !== contextRegistry
      ? (registry.get(FIELD_WRAPPER)?.component as ComponentType<FieldWrapperProps> | undefined)
      : undefined;
  const settings = ownFieldWrapper
    ? { ...rendererSettings, fieldWrapper: ownFieldWrapper }
    : rendererSettings;

  // Результат валидации схемы: `undefined` — ещё считаем (validateSchema вкл.), `null` — выключена/прошла,
  // непустой массив — невалидна (рисуем панель вместо формы). ajv грузится динамически.
  const [schemaErrors, setSchemaErrors] = useState<string[] | null | undefined>(
    validateSchema ? undefined : null
  );

  useEffect(() => {
    if (!validateSchema || !schema) {
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
    if (!schema || !model) {
      throw new Error(
        'JsonFormRenderer: provide a `form` bundle (createJsonForm) or both `schema` and `model` props.'
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

  // §8: диагностика промаха selector — сверяет адресованные через schema.node(...) селекторы (ключи
  // override-карт proxy, заполненных renderBehavior) со всеми селекторами JSON-схемы. Промах раньше
  // был тихим (override просто не читался). Известные берём из СХЕМЫ (надёжно, incl. componentProps),
  // а не из рендер-дерева (кастомные компоненты держат детей вне node.children). Безусловный warn.
  useEffect(() => {
    if (!schemaProxy || !schema) return;
    const known = collectSchemaSelectors(schema);
    const maps = schemaProxy.__overrideMaps;
    const addressed = new Set<string>([
      ...maps.hiddenOverrides.keys(),
      ...maps.propsOverrides.keys(),
      ...maps.refRegistry.keys(),
      ...maps.conditionRegistry.keys(),
      ...maps.callbackRegistry.keys(),
      ...maps.lifecycleRegistry.keys(),
    ]);
    const missing = [...addressed].filter((s) => !known.has(s));
    if (missing.length > 0 && typeof console !== 'undefined') {
      console.warn(
        `[JsonFormRenderer] schema.node(...) адресует неизвестный selector: ${missing.join(', ')}. ` +
          `Известные селекторы: ${[...known].sort().join(', ') || '(нет)'}.`
      );
    }
  }, [schemaProxy, schema]);

  if (schemaErrors && schemaErrors.length > 0) {
    return <SchemaErrorPanel errors={schemaErrors} />;
  }
  if (!schemaProxy) {
    return null; // валидация ещё считается (динамический импорт ajv)
  }
  // §8: битая схема (неизвестный $component и т.п.) бросает на этапе рендера FormRenderer.
  // При выключенном validateSchema (prod) boundary рисует панель ошибок вместо белого экрана.
  return (
    <SchemaErrorBoundary resetKey={schemaProxy}>
      <FormRenderer render={schemaProxy} settings={settings} />
    </SchemaErrorBoundary>
  );
}
