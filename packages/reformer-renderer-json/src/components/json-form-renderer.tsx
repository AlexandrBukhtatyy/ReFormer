/**
 * JsonFormRenderer — главный компонент для рендеринга форм из JSON-схемы
 *
 * @module reformer/renderer-json/components
 */

import { useMemo, type ReactNode } from 'react';
import {
  FormRenderer,
  createRenderSchema,
  type RenderBehaviorFn,
  type RenderSchemaProxy,
} from '@reformer/renderer-react';
import type { JsonFormSchema } from '../types/json-schema';
import { useJsonRendererSettings } from '../context/json-renderer-context';
import { createRenderSchemaFromJson } from '../converter/json-to-render-schema';
import { defaultRegistry } from '../registry/default-registry';

/**
 * Props для JsonFormRenderer
 *
 * Форма(ы) подключаются через registry: `registerForm('myForm', formProxy)`,
 * после чего JSON-схема ссылается на форму по имени через `componentProps.form`
 * внутри соответствующего контейнера (wizard, раздел страницы и т.д.).
 * Конвертер при встрече form-type-записи открывает form-scope: дочерние `model:`
 * резолвятся против этой формы. Это позволяет рендерить страницы с несколькими формами.
 */
export interface JsonFormRendererProps<T> {
  /**
   * JSON-схема (одна форма или страница с несколькими формами).
   */
  schema: JsonFormSchema;

  /**
   * Поведение схемы: условная видимость, реактивные эффекты, колбэки.
   * Применяется к RenderSchemaProxy, полученному из JSON-схемы — позволяет
   * переиспользовать behavior-функцию между TS-variant и JSON-variant.
   */
  renderBehavior?: RenderBehaviorFn<T>;

  /**
   * Колбэк получает собранный schemaProxy — полезен для подключения
   * внешних панелей управления (SchemaControlPanel и т.п.).
   */
  onSchemaReady?: (schema: RenderSchemaProxy<T>) => void;
}

/**
 * JsonFormRenderer — рендеринг формы из JSON-схемы
 *
 * Компонент конвертирует JSON-схему в RenderSchema и использует
 * FormRenderer из @reformer/renderer-react под капотом.
 *
 * Настройки (registry, fieldWrapper) берутся из JsonRendererProvider.
 *
 * @example
 * ```tsx
 * // Форма регистрируется в реестре, JSON ссылается на неё по имени
 * const schema = {
 *   root: {
 *     component: 'Box',
 *     componentProps: { form: 'loginForm' },
 *     children: [
 *       { model: 'email' },
 *       { model: 'password', component: 'InputPassword' }
 *     ]
 *   }
 * };
 *
 * function LoginForm() {
 *   const form = useMemo(() => createLoginForm(), []);
 *   const registry = useMemo(
 *     () => createDefaultRegistry().registerForm('loginForm', form),
 *     [form]
 *   );
 *
 *   return (
 *     <JsonRendererProvider settings={{ fieldWrapper: FormField, registry }}>
 *       <JsonFormRenderer schema={schema} />
 *     </JsonRendererProvider>
 *   );
 * }
 * ```
 */
export function JsonFormRenderer<T>({
  schema,
  renderBehavior,
  onSchemaReady,
}: JsonFormRendererProps<T>): ReactNode {
  // Получаем настройки из контекста
  const { registry, ...rendererSettings } = useJsonRendererSettings();

  // Используем registry из контекста или defaultRegistry
  const effectiveRegistry = registry ?? defaultRegistry;

  // Мемоизируем конвертацию JSON → RenderSchemaFn → RenderSchemaProxy.
  // Proxy нужен, чтобы renderBehavior мог вызывать schema.node(selector).hideWhen(...)
  // — тот же API, что использует TypeScript-variant.
  const schemaProxy = useMemo(() => {
    const fn = createRenderSchemaFromJson<T>(schema, effectiveRegistry);
    const proxy = createRenderSchema<T>(fn);
    if (renderBehavior) {
      renderBehavior(proxy);
    }
    return proxy;
  }, [schema, effectiveRegistry, renderBehavior]);

  // Сигналим наружу готовую schema-proxy (для демо-панелей и т.п.)
  useMemo(() => {
    if (onSchemaReady) onSchemaReady(schemaProxy);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [schemaProxy]);

  // Делегируем рендеринг в FormRenderer из renderer-react
  return <FormRenderer render={schemaProxy} settings={rendererSettings} />;
}
