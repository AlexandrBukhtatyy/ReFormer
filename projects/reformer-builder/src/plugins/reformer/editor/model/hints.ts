/**
 * Подсказки текстовому редактору по схеме формы: JSON Schema кита и пути `$model(...)`.
 *
 * ## Схема — готовая, из рендерера
 *
 * `buildFormSchemaMetaSchema` уже умеет ровно то, что нужно подсказке: сужает `$component(...)`
 * до enum имён, ставит enum тегов `$html(...)` и добавляет ветки `componentProps` по компоненту
 * (с `description` каталога — они и показываются при наведении). Здесь её кормят каталогом
 * активного кита и досказывают то, чего она не видит (см. {@link buildHintSchema}). Проверкой
 * эта схема не служит: находки публикует валидатор.
 *
 * ## Пути модели — не из JSON Schema
 *
 * Пути свои у каждой формы и зависят от места: внутри `item.$template` они относительны элементу.
 * Поэтому они приходят отдельной подсказкой по строке под курсором, из областей видимости модели
 * (`form-model/model-scopes`).
 *
 * @module plugins/reformer/editor/model/hints
 */

import {
  buildFormSchemaMetaSchema,
  parseOperator,
  toComponentPropsValidatorSchema,
  toFormStepMetaSchema,
  type JsonFormSchema,
} from '@reformer/renderer-json';
import type { CatalogEntry } from '@/plugins/reformer/core/catalog';
import {
  boundPathsIn,
  collectModelScopes,
  scopeOfPath,
  STEPS_HOST_NAMES,
  type ModelScope,
} from '@/plugins/reformer/core/form-model';
import type { JsonSchemaHint, TextCompletion, TextStringSite } from '@reformer/builder-plugin-api';

/** Префикс оператора привязки вместе со скобкой. */
const MODEL_OPEN = '$model(';

/** Ключи, в значении которых стоит ОБЪЯВЛЕНИЕ привязки: там подсказывается оператор целиком. */
const BINDING_KEYS: ReadonlySet<string> = new Set(['value', 'array']);

/**
 * Схема по каталогу — запоминается по ССЫЛКЕ на каталог.
 *
 * Каталог заморожен, новая ссылка означает другой кит или доехавшую загрузку. Номер в адресе
 * растёт вместе со сменой ссылки: по адресу редактор решает, перерегистрировать ли схему, а
 * одинаковый адрес у разных схем оставил бы в подсказке имена прошлого кита.
 */
const schemaCache = new WeakMap<readonly CatalogEntry[], JsonSchemaHint>();
let schemaSerial = 0;

export function formJsonSchema(catalog: readonly CatalogEntry[]): JsonSchemaHint {
  let hint = schemaCache.get(catalog);
  if (hint === undefined) {
    schemaSerial += 1;
    hint = {
      uri: `inmemory://schema/reformer-form/${schemaSerial}.json`,
      schema: buildHintSchema(catalog),
    };
    schemaCache.set(catalog, hint);
  }
  return hint;
}

/** Ссылка на файл шага в `componentProps.steps`. */
const STEP_REF_SCHEMA = {
  type: 'object',
  required: ['$ref'],
  additionalProperties: false,
  properties: {
    $ref: { type: 'string', description: 'Файл шага: ./steps/<шаг>/form.schema.json' },
  },
};

const stepSchemaCache = new WeakMap<readonly CatalogEntry[], JsonSchemaHint>();

/**
 * Схема подсказок файла шага (`{ "$schema", "node" }`) — те же узлы и пропсы кита, другой корень.
 * Запоминается по каталогу, как {@link formJsonSchema}, и строится из неё же.
 */
export function formStepJsonSchema(catalog: readonly CatalogEntry[]): JsonSchemaHint {
  let hint = stepSchemaCache.get(catalog);
  if (hint === undefined) {
    const form = formJsonSchema(catalog);
    hint = {
      uri: form.uri.replace('reformer-form/', 'reformer-form-step/'),
      schema: toFormStepMetaSchema(form.schema as Record<string, unknown>),
    };
    stepSchemaCache.set(catalog, hint);
  }
  return hint;
}

/** Мета-схема в той части, которую дополняет {@link buildHintSchema}. */
interface MetaSchema {
  definitions: Record<string, { allOf?: unknown[] }>;
}

/** Ветка «если `component` равен этому — то `componentProps` такие». */
function whenComponent(component: string, componentProps: unknown): unknown {
  return {
    // `required` обязателен: без него узел без `component` вакуумно проходит `if`
    // и получает чужие пропсы — та же оговорка, что в `buildFormSchemaMetaSchema`.
    if: { required: ['component'], properties: { component: { const: component } } },
    then: { properties: { componentProps: componentProps } },
  };
}

/**
 * Мета-схема рендерера, досказанная тем, что знает каталог билдера.
 *
 * Две вещи мета-схема сама не видит, и обе на настоящих формах — не редкость, а норма:
 *
 * - **синтетические записи каталога** `$html(tag)`. Имя записи — уже оператор, и в enum
 *   `$component(...)` она попала бы бессмыслицей `$component($html(div))`. Такие записи идут
 *   не в имена, а в ветки `component: "$html(div)"` — с их пропсами (`className` и т. п.);
 * - **шаги мастера** лежат в `componentProps.steps`, а `componentProps` мета-схема держит
 *   непрозрачным объектом. Без ветки «элементы `steps` — узлы» внутри шага не было бы подсказок
 *   вовсе — ни компонентов, ни пропсов, — а в мастере лежит почти вся форма.
 */
function buildHintSchema(catalog: readonly CatalogEntry[]): unknown {
  const components = catalog.filter((entry) => parseOperator(entry.name) === null);
  const html = catalog.filter((entry) => parseOperator(entry.name)?.op === 'html');

  const schema = buildFormSchemaMetaSchema({
    componentNames: components.map((entry) => entry.name),
    propSchemas: Object.fromEntries(components.map((entry) => [entry.name, entry.propsSchema])),
  }) as unknown as MetaSchema;

  const container = schema.definitions.containerNode;
  container.allOf = [
    ...(container.allOf ?? []),
    ...html.map((entry) =>
      whenComponent(entry.name, toComponentPropsValidatorSchema(entry.propsSchema))
    ),
    ...[...STEPS_HOST_NAMES].map((name) =>
      whenComponent(`$component(${name})`, {
        properties: {
          steps: {
            type: 'array',
            // Шаг — узел либо ссылка на файл шага (визард, разбитый по шагам).
            items: { anyOf: [{ $ref: '#/definitions/node' }, STEP_REF_SCHEMA] },
          },
        },
      })
    ),
  ];
  return schema;
}

/** Области модели — запоминаются по ссылке на модель: подсказка зовётся на каждое нажатие. */
const scopesCache = new WeakMap<object, readonly ModelScope[]>();

function scopesOf(model: JsonFormSchema): readonly ModelScope[] {
  let scopes = scopesCache.get(model);
  if (scopes === undefined) {
    scopes = collectModelScopes(model);
    scopesCache.set(model, scopes);
  }
  return scopes;
}

/**
 * Подсказки путей модели в строке под курсором.
 *
 * Два случая:
 *
 * - курсор внутри скобок `$model(…)` — где угодно: в привязке, в текстовой части, в пропе.
 *   Заменяется аргумент целиком, кавычки и скобки остаются на месте;
 * - в значении `value`/`array` набрано начало оператора (`""`, `"$"`, `"$mo"`) — подсказывается
 *   `$model(путь)` целиком, чтобы привязку не приходилось набирать по буквам.
 *
 * Пути — объявленные в той области, где стоит курсор: внутри шаблона элемента массива это пути
 * ЭЛЕМЕНТА, а не формы.
 */
export function completeModelPath(model: JsonFormSchema, site: TextStringSite): TextCompletion[] {
  const bound = boundPathsIn(scopesOf(model), scopeOfPath(site.path));
  if (bound.length === 0) return [];

  const { value, offset } = site;
  if (value.startsWith(MODEL_OPEN) && offset >= MODEL_OPEN.length) {
    const close = value.indexOf(')', MODEL_OPEN.length);
    const end = close === -1 ? value.length : close;
    if (offset > end) return [];
    const replace = { start: MODEL_OPEN.length, end };
    return bound.map((path) => ({ label: path, insert: path, replace }));
  }

  const key = site.path[site.path.length - 1];
  if (typeof key !== 'string' || !BINDING_KEYS.has(key)) return [];
  const typed = value.slice(0, offset);
  if (!MODEL_OPEN.startsWith(typed)) return [];
  const replace = { start: 0, end: value.length };
  return bound.map((path) => ({
    label: `${MODEL_OPEN}${path})`,
    insert: `${MODEL_OPEN}${path})`,
    replace,
  }));
}
