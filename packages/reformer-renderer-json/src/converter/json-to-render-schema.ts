/**
 * Конвертер JSON-схемы → RenderNode-дерево `@reformer/renderer-react`.
 *
 * Привязки — СТРОКИ-операторы (`operators.ts`); голые строки НЕ резолвятся. Один обход на оба
 * формата документа:
 *
 * Формат 2 — {@link convertJsonSchema}:
 * - поле:      `{ model: '$model(path)', component: '$component(Name)', componentProps: { … } }`
 * - массив:    `{ model: '$model(arr)', item: { $template: <узел> } | '$part(name)' }`
 * - подформа:  `{ model: '$model(group)', part: '$part(name)' }`
 * - контейнер: `{ component: '$component(Name)', children: [...] }`
 *
 * Формат v1 — {@link convertJsonToM1Tree}: ключи `value` (поле) и `array` (массив), подформ нет.
 *
 * `selector` — plain-строка (id узла для поведения формы), НЕ путь модели.
 *
 * @module reformer/renderer-json/converter
 */

import { type RenderSchemaFn, type RenderNode } from '@reformer/renderer-react';
import { isModelContainerSignal, isValueSignal, type FormModel } from '@reformer/core';
import { schemaFormatOf, type JsonFormSchema } from '../types/json-schema';
import type { JsonFormSchemaV1 } from '../types/json-schema-v1';
import {
  parseOperator,
  isModelOp,
  isComponentOp,
  isHtmlOp,
  isDataSourceOp,
  isFnOp,
  isLocaleOp,
  isPartOp,
} from '../operators';
import { isAllowedHtmlTag, sanitizeHtmlProps } from '../html/html-tags';
import { isJsonStepRef } from '../compose';
import type { ComponentRegistry } from '../registry/types';

/* eslint-disable @typescript-eslint/no-explicit-any */

/**
 * Резолв нативного тега из `'$html(tag)'`. Тег вне whitelist — ошибка конвертации, а не молчаливый
 * пропуск: схема недоверенная, и `$html(script)` должен упасть здесь так же, как падает
 * `validateFormSchema`.
 */
function resolveHtmlTag(op: string): string {
  const tag = parseOperator(op)?.arg;
  if (!tag) throw new Error(`Invalid $html operator: "${op}"`);
  if (!isAllowedHtmlTag(tag)) {
    throw new Error(
      `HTML tag "${tag}" is not allowed in $html(...). Presentational tags only — ` +
        'script/style/iframe/form-controls are excluded by design.'
    );
  }
  return tag.toLowerCase();
}

/** Резолв компонента реестра по строке `'$component(name)'` (тип component) либо тега `'$html(tag)'`. */
function resolveComponent(op: string | undefined, registry: ComponentRegistry): any {
  if (!op) return undefined;
  if (isHtmlOp(op)) return resolveHtmlTag(op);
  const name = parseOperator(op)?.arg;
  if (!name) throw new Error(`Invalid $component operator: "${op}"`);
  const meta = registry.get(name);
  if (!meta) {
    throw new Error(
      `Component "${name}" not found in registry. Available: ${registry.names().join(', ')}`
    );
  }
  // Не даём использовать не-'component'-запись (dataSource/fn/locale) как $component(...),
  // иначе рантайм принял бы схему, которую validateFormSchema (getComponentNames) отклоняет.
  if (meta.type !== 'component') {
    throw new Error(`Entry "${name}" is a '${meta.type}' and cannot be used as $component(...)`);
  }
  return meta.component;
}

/** Резолв registry-source по имени из `'$dataSource(name)'` (options/itemLabel/константа/loading-компонент). */
function resolveDataSource(name: string, registry: ComponentRegistry): unknown {
  const meta = registry.get(name);
  if (!meta) {
    throw new Error(
      `Data source "${name}" not found in registry. Available: ${registry.names().join(', ')}`
    );
  }
  // Симметрично resolveComponent: не даём использовать 'component'-запись как $dataSource(...),
  // иначе рантайм принял бы схему, которую validateFormSchema (getDataSourceNames) отклоняет.
  if (meta.type !== 'dataSource') {
    throw new Error(`Entry "${name}" is a '${meta.type}' and cannot be used as $dataSource(...)`);
  }
  return meta.component;
}

/** Резолв функции реестра по имени из `'$fn(name)'` (форматтер/компаратор/itemLabel/обработчик). */
function resolveFn(name: string, registry: ComponentRegistry): unknown {
  const meta = registry.get(name);
  if (!meta) {
    throw new Error(
      `Function "${name}" not found in registry. Available: ${registry.names().join(', ')}`
    );
  }
  // Симметрично resolveDataSource: перепутанные $fn/$dataSource отвергаются (валидатор — раздельно).
  if (meta.type !== 'fn') {
    throw new Error(`Entry "${name}" is a '${meta.type}' and cannot be used as $fn(...)`);
  }
  return meta.component;
}

/**
 * Резолв ключа локализации в строку через сервис реестра. Промах/нет сервиса → сам ключ.
 * `params` (структурная форма `{ $locale, params }`) — литералы для интерполяции/склонения.
 */
function resolveLocale(
  key: string,
  registry: ComponentRegistry,
  params?: Record<string, unknown>
): string {
  return registry.getLocale?.()?.resolve(key, params) ?? key;
}

/**
 * Структурная форма `$locale` с параметрами в `componentProps`: `{ $locale: 'key', params?: {…} }`.
 * Объект (не строка-оператор), чтобы не парсить аргументы. `params` — литералы (статичный путь);
 * реактивные model-параметры — через компонент `I18n`.
 */
function isLocaleObjectForm(
  v: unknown
): v is { $locale: string; params?: Record<string, unknown> } {
  return (
    v !== null &&
    typeof v === 'object' &&
    typeof (v as Record<string, unknown>).$locale === 'string'
  );
}

/**
 * Разворачивает `params` структурной `$locale`-формы: `$model(path)` → снимок значения (`.peek()`,
 * БЕЗ подписки на сигнал), литералы — как есть. Строковый путь статичен, поэтому это снимок на момент
 * конвертации, а не реакция; для реактивных model-параметров — компонент `I18n`.
 */
function snapshotLocaleParams(
  params: Record<string, unknown> | undefined,
  scope: any
): Record<string, unknown> | undefined {
  if (!params) return params;
  let touched = false;
  const out: Record<string, unknown> = {};
  for (const k of Object.keys(params)) {
    const v = params[k];
    if (isModelOp(v)) {
      const sig = (scope as FormModel<unknown>).signalAt(parseOperator(v)!.arg);
      out[k] = sig?.peek?.();
      touched = true;
    } else {
      out[k] = v;
    }
  }
  return touched ? out : params;
}

/**
 * Предупреждение: `$model(...)` в `params` строковой `$locale`-формы берётся снимком и НЕ реактивен.
 * Направляет на компонент `I18n` для живого значения. Guard `typeof console` — как у сиблинг-warn ниже.
 */
function warnLocaleModelParams(key: string, params?: Record<string, unknown>): void {
  if (!params || typeof console === 'undefined') return;
  for (const k of Object.keys(params)) {
    if (isModelOp(params[k])) {
      console.warn(
        `[JsonRenderer] $locale("${key}"): параметр "${k}" (=${String(params[k])}) взят снимком ` +
          `значения на момент рендера и не обновляется при изменении модели. Для реактивного значения ` +
          `используй I18n: { component: "$component(I18n)", componentProps: { id: "${key}", values: { ${k}: "${String(params[k])}" } } }.`
      );
    }
  }
}

/** Значение по dot-пути в value-прокси модели ('properties' → model.properties массив-прокси). */
function resolveModelPath(scope: any, path: string): any {
  return path.split('.').reduce((acc, seg) => (acc == null ? acc : acc[seg]), scope);
}

/**
 * Ручка группы модели по dot-пути. `signalAt` для группы возвращает `undefined` (группа полем не
 * бывает), поэтому ручка ищется обходом дерева `scope.$`.
 */
function groupHandleAt(scope: any, path: string): object | undefined {
  const handle = resolveModelPath(scope.$, path);
  return isModelContainerSignal(handle) && !isValueSignal(handle) ? handle : undefined;
}

/**
 * Что конвертеру нужно знать о документе помимо узла: реестр, именованные части и формат привязки.
 */
interface ConvertContext {
  registry: ComponentRegistry;
  /** Именованные части документа (формат 2); в формате v1 пусто. */
  parts: Record<string, unknown>;
  /**
   * Формат 2: привязка одним ключом `model`, на выходе — узлы с ручками модели (`model`).
   * Формат v1: ключи `value` / `array`, на выходе — прежние `value` / `array`.
   */
  v2: boolean;
}

/** Похож ли объект на узел схемы (несёт строку-оператор в привязке или в `component`). */
function looksLikeNode(v: unknown, v2: boolean): boolean {
  if (v === null || typeof v !== 'object') return false;
  const n = v as Record<string, unknown>;
  const bound = v2 ? isModelOp(n.model) : isModelOp(n.value) || isModelOp(n.array);
  return bound || isComponentOp(n.component) || isHtmlOp(n.component);
}

/** Глубокий клон литерал-объекта (initialValue нового элемента массива — без shared-ссылок). */
function cloneLiteral<T>(v: T): T {
  return v == null ? v : (JSON.parse(JSON.stringify(v)) as T);
}

/**
 * Рекурсивная трансформация значений `componentProps`: резолв строк-операторов + вложенных узлов.
 * Обычные значения (label/placeholder/className/testId, инлайн-массивы options) — как есть.
 */
function transformPropValue(value: unknown, scope: any, ctx: ConvertContext): unknown {
  const { registry } = ctx;
  if (isDataSourceOp(value)) return resolveDataSource(parseOperator(value)!.arg, registry);
  if (isComponentOp(value)) return resolveComponent(value, registry);
  if (isFnOp(value)) return resolveFn(parseOperator(value)!.arg, registry);
  if (isLocaleOp(value)) return resolveLocale(parseOperator(value)!.arg, registry);
  if (isModelOp(value)) return (scope as FormModel<unknown>).signalAt(parseOperator(value)!.arg);
  if (isLocaleObjectForm(value)) {
    warnLocaleModelParams(value.$locale, value.params);
    return resolveLocale(value.$locale, registry, snapshotLocaleParams(value.params, scope));
  }
  if (looksLikeNode(value, ctx.v2)) return convertNode(value, scope, ctx);
  if (Array.isArray(value)) return value.map((v) => transformPropValue(v, scope, ctx));
  if (value !== null && typeof value === 'object') {
    const src = value as Record<string, unknown>;
    const out: Record<string, unknown> = {};
    for (const k of Object.keys(src)) out[k] = transformPropValue(src[k], scope, ctx);
    return out;
  }
  return value;
}

function transformProps(
  props: unknown,
  scope: any,
  ctx: ConvertContext
): Record<string, unknown> | undefined {
  if (!props) return undefined;
  const src = props as Record<string, unknown>;
  const out: Record<string, unknown> = {};
  for (const k of Object.keys(src)) out[k] = transformPropValue(src[k], scope, ctx);
  return out;
}

/**
 * Резолв текстовой части `children` в форму, понятную рендереру: `'$model(path)'` → сигнал
 * (рендерер подпишется и обновит текст), `'$locale(key)'` → строка каталога, `'$dataSource(name)'` →
 * значение из реестра (обычно сигнал UI-состояния — «живой» текст не из модели), прочие строки и
 * числа — литералы.
 *
 * Набор операторов здесь УЖЕ, чем в `componentProps`: компонент или функция в позиции текста —
 * заведомая ошибка схемы, и падать на ней надо в конвертере с внятным сообщением, а не в React
 * на попытке отрендерить объект. Структурная форма `{ $locale, params }` в этой позиции невозможна
 * (объект в `children` — это узел); реактивные параметры — через компонент `I18n`.
 */
function resolveTextChild(part: string | number, scope: any, registry: ComponentRegistry): unknown {
  if (typeof part === 'number') return part;
  if (isModelOp(part)) return (scope as FormModel<unknown>).signalAt(parseOperator(part)!.arg);
  if (isLocaleOp(part)) return resolveLocale(parseOperator(part)!.arg, registry);
  if (isDataSourceOp(part)) {
    const value = resolveDataSource(parseOperator(part)!.arg, registry);
    // Источник может отдавать что угодно (options-массив, компонент-заглушку) — текстом становится
    // только примитив или сигнал; остальное отсекаем здесь, а не оставляем React.
    const renderable =
      value == null ||
      typeof value === 'string' ||
      typeof value === 'number' ||
      isValueSignal(value);
    if (!renderable) throw new Error(textChildError(part, 'resolves to a non-text value'));
    return value;
  }
  if (isComponentOp(part) || isHtmlOp(part) || isFnOp(part)) {
    throw new Error(textChildError(part, 'resolves to a component or a function'));
  }
  return part;
}

/** Сообщение об операторе, непригодном в позиции текстового ребёнка. */
function textChildError(op: string, why: string): string {
  return (
    `Operator "${op}" cannot be a text child — it ${why}. Text children accept $model(...), ` +
    '$locale(...) and $dataSource(...) that yields a string, a number or a signal; ' +
    'use a nested node for components and componentProps for functions.'
  );
}

/** Именованная часть документа по оператору `'$part(name)'`. */
function resolvePart(op: unknown, ctx: ConvertContext): unknown {
  const name = parseOperator(op)?.arg;
  if (!name) throw new Error(`Invalid $part operator: "${String(op)}"`);
  const part = ctx.parts[name];
  if (part === undefined) {
    const available = Object.keys(ctx.parts).join(', ') || '(none)';
    throw new Error(`Part "${name}" not found in the document "parts". Available: ${available}`);
  }
  return part;
}

/**
 * Шаблон строки массива: вписанный узел (`{ $template }`) либо, в формате 2, именованная часть
 * (`'$part(name)'`). `undefined` — у узла нет шаблона, это не массив под-форм.
 */
function rowTemplateOf(item: unknown, ctx: ConvertContext): unknown {
  if (ctx.v2 && isPartOp(item)) return resolvePart(item, ctx);
  if (typeof item === 'object' && item !== null && '$template' in item) {
    return (item as { $template: unknown }).$template;
  }
  return undefined;
}

/**
 * Конвертирует узел JSON-схемы в RenderNode. Дискриминация — по привязке и соседним ключам:
 * массив под-форм (`item`) → подформа (`part`, формат 2) → поле → контейнер (`component`).
 */
function convertNode<T>(node: unknown, scope: any, ctx: ConvertContext): RenderNode<T> {
  const n = node as Record<string, unknown>;
  const { registry, v2 } = ctx;
  const selector = typeof n.selector === 'string' && n.selector ? { selector: n.selector } : {};
  const binding = v2 ? n.model : undefined;

  // Массив под-форм: данные принадлежат модели, строка — из шаблона. Опциональный `component`
  // уводит рендер на зарегистрированный компонент (секция с управлением либо chrome-less список).
  const arrayOp = v2 ? binding : n.array;
  const template = isModelOp(arrayOp) ? rowTemplateOf(n.item, ctx) : undefined;
  if (isModelOp(arrayOp) && template !== undefined) {
    const path = parseOperator(arrayOp)!.arg;
    const initial = n.initialValue;
    const component = n.component ? resolveComponent(n.component as string, registry) : undefined;
    const item = (im: FormModel<unknown>) => convertNode(template, im, ctx);
    const componentProps = transformProps(n.componentProps, scope, ctx);
    if (!v2) {
      return {
        ...selector,
        array: resolveModelPath(scope, path),
        ...(component ? { component } : {}),
        initialValue: () => (initial ? cloneLiteral(initial) : {}),
        item,
        componentProps,
      } as unknown as RenderNode<T>;
    }
    const handle = (scope as FormModel<unknown>).signalAt(path);
    if (!isModelContainerSignal(handle)) {
      throw new Error(
        `"$model(${path})" is not an array of the model — an array node needs an array field ` +
          '(its initial value must be an array, not null).'
      );
    }
    return {
      ...selector,
      model: handle,
      ...(component ? { component } : {}),
      // Запасной шаблон нового элемента: шаблон модели (`arrayOf`) главнее.
      ...(initial !== undefined ? { initialValue: () => cloneLiteral(initial) } : {}),
      item,
      componentProps,
    } as unknown as RenderNode<T>;
  }

  // Подформа (формат 2): именованная часть, подключённая к группе модели. Пути внутри части
  // относительны этой группе — часть конвертируется для её под-модели.
  if (v2 && isModelOp(binding) && isPartOp(n.part)) {
    const path = parseOperator(binding)!.arg;
    const handle = groupHandleAt(scope, path);
    if (!handle) {
      throw new Error(
        `"$model(${path})" is not a group of the model — a sub-form ("part") attaches to an ` +
          'object field.'
      );
    }
    const partNode = resolvePart(n.part, ctx);
    return {
      ...selector,
      model: handle,
      part: (subModel: FormModel<unknown>) => convertNode(partNode, subModel, ctx),
    } as unknown as RenderNode<T>;
  }

  // Поле: привязка — сигнал модели по пути из '$model(...)'
  const fieldOp = v2 ? binding : n.value;
  if (isModelOp(fieldOp)) {
    const path = parseOperator(fieldOp)!.arg;
    const signal = (scope as FormModel<unknown>).signalAt(path);
    if (!signal && typeof console !== 'undefined') {
      console.warn(`[JsonRenderer/M1] No model signal for "${path}".`);
    }
    const componentProps = transformProps(n.componentProps, scope, ctx);
    // Пер-полевая обёртка: JSON `wrapper: { component: '$component(FormField)' }` →
    // renderer `componentProps.fieldWrapper` (обёртка получает control/label/errors одного поля).
    const fieldWrapper = n.wrapper
      ? resolveComponent((n.wrapper as { component?: string }).component, registry)
      : undefined;
    return {
      ...selector,
      [v2 ? 'model' : 'value']: signal,
      component: resolveComponent(n.component as string | undefined, registry),
      componentProps: fieldWrapper ? { ...(componentProps ?? {}), fieldWrapper } : componentProps,
    } as unknown as RenderNode<T>;
  }

  // Контейнер: компонент реестра либо нативный HTML-тег
  if (isComponentOp(n.component) || isHtmlOp(n.component)) {
    const isHtml = isHtmlOp(n.component);
    const component = resolveComponent(n.component, registry);
    const props = transformProps(n.componentProps, scope, ctx);
    const children = n.children as unknown[] | undefined;
    return {
      ...selector,
      component,
      // У html-узла componentProps — DOM-атрибуты, пришедшие из недоверенной схемы: чистим их
      // (обработчики, innerHTML, javascript:-URL). Props компонентов реестра не трогаем —
      // их поверхность определяет сам компонент.
      componentProps: isHtml ? sanitizeHtmlProps(props, component as string) : props,
      // Ребёнок-объект — вложенный узел, примитив — текстовая часть (рендерер выведет её на этом
      // же месте, а соседние части склеит).
      children: children?.map((c) => {
        if (typeof c !== 'object' || c === null) {
          return resolveTextChild(c as string | number, scope, registry);
        }
        if (isJsonStepRef(c)) {
          throw new Error(
            `Step reference "${c.$ref}" is not resolved — assemble the schema with ` +
              'composeJsonFormSchema(schema, stepSchemas) before building the form.'
          );
        }
        return convertNode(c, scope, ctx);
      }),
    } as unknown as RenderNode<T>;
  }

  throw new Error(`Invalid JSON node: ${JSON.stringify(node)}`);
}

/**
 * Дерево узлов из документа JSON-схемы формата 2 — для сборки `createForm`. Привязки (`model`)
 * становятся ручками модели, компоненты и источники берутся из реестра, именованные части
 * (`parts`) разворачиваются для под-моделей мест подключения.
 *
 * Обычно вызывается не напрямую, а реестром — `createForm({ model, schema: document, registry })`
 * зовёт `registry.resolveSchema`.
 *
 * @typeParam T - Тип формы (форма данных модели).
 * @param schema - Документ JSON-схемы формата 2 ({@link JsonFormSchema}).
 * @param registry - Реестр компонентов/источников (см. {@link defineRegistry}).
 * @param model - Модель данных — источник значений (`FormModel`).
 * @returns Корневой {@link RenderNode}.
 * @throws Error если документ — прежнего формата: его переводит `migrateJsonSchema`.
 *
 * @example
 * ```ts
 * const tree = convertJsonSchema<MyForm>(document, registry, model);
 * const form = createFormFromModel<MyForm>({ model, schema: tree });
 * ```
 *
 * @group Converter
 */
export function convertJsonSchema<T>(
  schema: JsonFormSchema,
  registry: ComponentRegistry,
  model: FormModel<T>
): RenderNode<T> {
  if (schemaFormatOf(schema) !== 2) {
    throw new Error(
      'The document is in the previous JSON schema format (no "format": 2). Convert it with ' +
        'migrateJsonSchema(document) before building the form, or use createJsonForm for v1.'
    );
  }
  return convertNode(schema.root, model, { registry, parts: schema.parts ?? {}, v2: true });
}

/**
 * Сырое дерево RenderNode из JSON прежнего формата (v1) — для `createFormFromModel({ model, schema })`.
 * Листья привязываются к сигналам модели (`'$model(path)'` → `model.signalAt`), компоненты/источники —
 * из реестра.
 *
 * @typeParam T - Тип формы (форма данных модели).
 * @param schema - JSON-схема формы прежнего формата ({@link JsonFormSchemaV1}).
 * @param registry - Реестр компонентов/источников (см. {@link defineRegistry}).
 * @param model - Модель данных — источник значений (`FormModel`).
 * @returns Корневой {@link RenderNode} — кладётся в `createFormFromModel({ model, schema })`.
 *
 * @example Собрать форму из JSON-схемы (M1)
 * ```ts
 * import { createFormFromModel } from '@reformer/core';
 *
 * const form = createFormFromModel<MyForm>({
 *   model,
 *   schema: convertJsonToM1Tree(jsonSchema, registry, model),
 *   behavior,
 * });
 * ```
 *
 * @group Converter
 */
export function convertJsonToM1Tree<T>(
  schema: JsonFormSchemaV1,
  registry: ComponentRegistry,
  model: FormModel<T>
): RenderNode<T> {
  return convertNode(schema.root, model, { registry, parts: {}, v2: false });
}

/**
 * `RenderSchemaFn` из JSON прежнего формата (v1) — для `FormRenderer`/`JsonFormRenderer`. Листья
 * привязываются к сигналам модели (`'$model(path)'` → `model.signalAt`), компоненты/источники — из
 * реестра.
 *
 * В отличие от {@link convertJsonToM1Tree} (который возвращает готовое дерево), здесь результат —
 * ленивая функция-фабрика дерева, как её ждёт `createRenderSchema`. Обычно вызывается внутри
 * {@link JsonFormRenderer}; напрямую нужен для интеграции с `FormRenderer` без JSON-обёртки.
 *
 * @typeParam T - Тип формы.
 * @param schema - JSON-схема формы прежнего формата ({@link JsonFormSchemaV1}).
 * @param registry - Реестр компонентов/источников (см. {@link defineRegistry}).
 * @param model - Модель данных — источник значений (`FormModel`).
 * @returns `RenderSchemaFn<T>` — фабрика {@link RenderNode}-дерева для `createRenderSchema`.
 *
 * @example
 * ```ts
 * import { createRenderSchema, FormRenderer } from '@reformer/renderer-react';
 *
 * const fn = createRenderSchemaFromJsonM1<MyForm>(jsonSchema, registry, model);
 * const proxy = createRenderSchema<MyForm>(fn);
 * <FormRenderer render={proxy} />;
 * ```
 *
 * @group Converter
 */
export function createRenderSchemaFromJsonM1<T>(
  schema: JsonFormSchemaV1,
  registry: ComponentRegistry,
  model: FormModel<T>
): RenderSchemaFn<T> {
  return (): RenderNode<T> => convertNode(schema.root, model, { registry, parts: {}, v2: false });
}
/* eslint-enable @typescript-eslint/no-explicit-any */
