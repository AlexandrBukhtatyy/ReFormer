/**
 * Три источника одной и той же схемы: из бандла, по HTTP со статики и по HTTP из MSW.
 *
 * **Почему `?url&no-inline`, а не копии в `public/`.** Копия схемы неизбежно разъезжается с
 * оригиналом — а тогда стенд проверяет не то, что показывает страница. Суффикс `?url` отдаёт Vite
 * настоящий ассет по настоящему URL: в разработке — файл, отданный `sirv` с `content-type:
 * application/json` и `ETag` (условный запрос и `304` работают), в сборке — хешированный
 * `/assets/*.json`.
 *
 * `&no-inline` обязателен и не косметичен. `assetsInlineLimit` по умолчанию 4096 байт, а схема
 * алертов весит 2040 — в прод-сборке она молча превратилась бы в `data:`-URL. `fetch` такой URL
 * проглотит и даже отдаст `application/json`, но сетевого запроса не будет вовсе: ни `ETag`, ни
 * `304`, ни попадания в кэш проверить стало бы нечем, а стенд бы об этом не сообщил.
 *
 * @module react-playground/examples/form-registry-lab/schema-sources
 */

import type { DataSource, FormEntry } from '@reformer/form-registry';
import type { JsonFormSchema } from '@reformer/renderer-json';
import { MOCK_FORMS_BASE } from '../../../mocks/form-schema-handlers';
import alertsSchemaUrl from '../../demo/alerts-list-renderer-json/json-schema.json?url&no-inline';
import registrationSchemaUrl from '../../demo/registration-form-renderer-json/json-schema.json?url&no-inline';
import creditSchemaUrl from '../../demo/complex-multy-step-form-renderer-json/json-schema.json?url&no-inline';

export type SchemaSourceKind = 'inline' | 'static' | 'msw';

export interface SchemaSourceInfo {
  kind: SchemaSourceKind;
  title: string;
  hint: string;
}

export const SCHEMA_SOURCES: readonly SchemaSourceInfo[] = [
  {
    kind: 'inline',
    title: 'Из бандла',
    hint: 'kind: inline — загрузчик отдаёт значение ДО кэша. Счётчики останутся нулевыми, и это норма.',
  },
  {
    kind: 'static',
    title: 'HTTP: статика',
    hint: 'Ассет Vite. Настоящий GET, ETag и 304 отдаёт dev-сервер. Работает и в прод-сборке.',
  },
  {
    kind: 'msw',
    title: 'HTTP: MSW',
    hint: 'Управляемый сценарий: задержка, 304, инъекция 500/429. Только в режиме разработки.',
  },
];

/** Файл схемы каждой формы, отданный настоящим URL. */
const STATIC_URL: Record<string, string> = {
  'alerts-list': alertsSchemaUrl,
  'registration-form': registrationSchemaUrl,
  'credit-application': creditSchemaUrl,
};

/**
 * Источник схемы для формы.
 *
 * `cache: 'no-store'` — не перестраховка: без него запрос закрыл бы HTTP-кэш браузера, и «ноль
 * сетевых обращений» оказалось бы заслугой браузера, а не `SchemaCache` — то есть стенд перестал бы
 * доказывать то, ради чего сделан. Именно `no-store`, а не `no-cache`: при `no-cache` браузер
 * ревалидирует сам и отдаёт полный `200` вместо `304`, и ветка `revalidated` стала бы ненаблюдаемой.
 * Свой условный запрос загрузчик всё равно шлёт — `If-None-Match` он ставит явным заголовком.
 */
export function schemaSource<T extends object>(
  formId: string,
  kind: SchemaSourceKind,
  inline: JsonFormSchema<T>
): DataSource<JsonFormSchema<T>> {
  if (kind === 'inline') return { kind: 'inline', value: inline };
  return { kind: 'http', url: sourceUrl(formId, kind)!, init: { cache: 'no-store' } };
}

/**
 * Адрес, по которому поедет схема. Показывается на стенде рядом с записью: без этого расхождение
 * адреса видно только по тексту отказа, то есть уже постфактум.
 */
export function sourceUrl(formId: string, kind: SchemaSourceKind): string | undefined {
  if (kind === 'inline') return undefined;
  return kind === 'static' ? STATIC_URL[formId] : `${MOCK_FORMS_BASE}/${formId}`;
}

/**
 * Вариант записи с другим источником схемы.
 *
 * Идентификатор обязан отличаться: `FormOutlet` монтирует поддерево с ключом `id@version`, и при
 * совпадающем ключе смена источника не пересоздала бы ни форму, ни загрузку. Заодно расходятся
 * ключи кэша — `${owner}/${id}@${version}#schema`, — так что варианты не делят одну ячейку.
 */
export function withSchemaSource<T extends object>(
  base: FormEntry<T>,
  kind: SchemaSourceKind,
  inline: JsonFormSchema<T>
): FormEntry<T> {
  return {
    ...base,
    id: `${base.id}--${kind}`,
    schema: schemaSource<T>(base.id, kind, inline),
  };
}
