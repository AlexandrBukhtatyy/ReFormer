/**
 * JsonFormRenderer — главный компонент для рендеринга форм из JSON-схемы
 *
 * @module reformer/renderer-json/components
 */

import { useEffect, useMemo, useState, type ReactNode } from 'react';
import {
  FormRenderer,
  createRenderSchema,
  type RenderBehaviorFn,
  type RenderSchemaProxy,
} from '@reformer/renderer-react';
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
  /** Опциональный behavior: hideWhen/patchProps/onComponentEvent поверх готовой схемы. */
  renderBehavior?: RenderBehaviorFn<T>;
  /** Колбэк, получающий построенный `RenderSchemaProxy` для внешних манипуляций. */
  onSchemaReady?: (schema: RenderSchemaProxy<T>) => void;
  /**
   * Валидировать JSON-схему против мета-схемы перед рендером. При ошибках рисует
   * {@link SchemaErrorPanel} вместо формы. ajv грузится **динамически** (`import('../validate')`) —
   * в prod-бандл не попадает, пока `validate` не включён.
   *
   * По умолчанию `false`. Чтобы валидировать только в dev, приложение передаёт значение из
   * СВОЕГО окружения: `validate={import.meta.env.DEV}` — детекцию dev нельзя «запечь» в пакет,
   * т.к. `import.meta.env.DEV` инлайнится в `false` при production-сборке самого пакета.
   */
  validate?: boolean;
}

/**
 * Главный компонент пакета. Рендерит форму, описанную JSON-схемой.
 *
 * Должен использоваться внутри {@link JsonRendererProvider}, который снабжает рендерер
 * реестром компонентов. Без реестра компонент бросит исключение при попытке резолва.
 *
 * @typeParam T - Тип формы.
 *
 * @example
 * ```tsx
 * import { useMemo } from 'react';
 * import { createForm } from '@reformer/core';
 * import { Input, FormField } from '@reformer/ui-kit';
 * import {
 *   JsonFormRenderer,
 *   JsonRendererProvider,
 *   defineRegistry,
 *   FIELD_WRAPPER,
 *   type JsonFormSchema,
 * } from '@reformer/renderer-json';
 *
 * const schema: JsonFormSchema = {
 *   version: '1.0',
 *   root: {
 *     component: 'Box',
 *     children: [
 *       { selector: 'email', model: 'email', component: 'Input' },
 *     ],
 *   },
 * };
 *
 * type MyForm = { email: string };
 *
 * function MyFormPage() {
 *   // form живёт в page-state и передаётся в registry через closure (см. ниже)
 *   const form = useMemo(() => createForm<MyForm>({
 *     form: { email: { value: '', component: Input, componentProps: { label: 'Email' } } },
 *   }), []);
 *
 *   // registry с FormRoot-closure: компоненты, использующие форму, получают её
 *   // через componentProps closure (JsonFormRenderer НЕ имеет form-prop'а — это by-design,
 *   // т.к. JSON-схема статична, а форма runtime).
 *   const registry = useMemo(() => defineRegistry((reg) => {
 *     reg.field('Input', Input);
 *     reg.container('Box', ({ children }) => <div>{children}</div>);
 *     reg.container(FIELD_WRAPPER, FormField);
 *   }), []);
 *
 *   return (
 *     <JsonRendererProvider settings={{ registry, form }}>
 *       <JsonFormRenderer schema={schema} />
 *     </JsonRendererProvider>
 *   );
 * }
 * ```
 *
 * **Note**: `JsonFormRenderer` принимает ТОЛЬКО `{ schema, renderBehavior?, onSchemaReady? }`.
 * Под M1 модель (`FormModel`) передаётся через {@link JsonRendererProvider} settings (`model`);
 * листья JSON-схемы биндятся к её сигналам конвертером `convertJsonToM1Tree`.
 *
 * @see [docs/llms/01-overview.md](../../docs/llms/01-overview.md)
 */
export function JsonFormRenderer<T>({
  schema,
  renderBehavior,
  onSchemaReady,
  validate = false,
}: JsonFormRendererProps<T>): ReactNode {
  const { registry, model, ...rendererSettings } = useJsonRendererSettings();

  // Результат валидации схемы: `undefined` — ещё считаем (validate вкл.), `null` — выключена/прошла,
  // непустой массив — невалидна (рисуем панель вместо формы). ajv грузится динамически.
  const [schemaErrors, setSchemaErrors] = useState<string[] | null | undefined>(
    validate ? undefined : null
  );

  useEffect(() => {
    if (!validate) {
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
  }, [validate, schema, registry]);

  const schemaProxy = useMemo(() => {
    // M1 (единая схема): листья биндятся к сигналам модели. Модель обязательна (legacy
    // FieldPath-конвертер удалён в Ф7) — передаётся через JsonRendererProvider settings.
    if (!model) {
      throw new Error(
        'JsonFormRenderer: settings.model is required (M1). Pass the FormModel via JsonRendererProvider.'
      );
    }
    // Не строим дерево, пока валидация не прошла: невалидную схему `resolveComponent` всё равно
    // не сконвертирует (кинет до показа панели). null → форму рендерим; иначе — ждём/показываем ошибки.
    if (schemaErrors !== null) return null;
    const fn = createRenderSchemaFromJsonM1<T>(schema, registry!, model);
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
