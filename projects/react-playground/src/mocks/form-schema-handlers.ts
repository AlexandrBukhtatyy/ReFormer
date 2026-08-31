/**
 * Отдача JSON-схем форм по сети — рукописные обработчики для стенда реестра форм.
 *
 * Файл НЕ генерируется: `_generated/msw-handlers.ts` перезаписывается `npm run generate:mocks`
 * внутри `npm run build`, и всё дописанное туда исчезло бы. Подключается в `browser.ts` перед
 * генерёнными.
 *
 * **Обработчики исполняются в СТРАНИЦЕ, а не в Service Worker.** SW лишь перехватывает запрос и
 * пересылает его на страницу, где живёт `setupWorker`. Поэтому сценарий читается прямо из
 * `window` и переключатели на стенде действуют немедленно — заблуждение здесь распространённое.
 *
 * Зачем вообще этот источник, если есть статика: только здесь можно задать задержку, заставить
 * сервер ответить `304` и уронить пару запросов кодом `500`/`429`. Без этого ветки кэша
 * `revalidated`, `error` и ретраи `fetchJson` наблюдать нечем.
 *
 * @module react-playground/mocks/form-schema-handlers
 */

import { http, HttpResponse, delay } from 'msw';
import alertsSchema from '../pages/demo/alerts-list-renderer-json/json-schema.json';
import registrationSchema from '../pages/demo/registration-form-renderer-json/json-schema.json';
import creditSchema from '../pages/demo/complex-multy-step-form-renderer-json/json-schema.json';

/** Базовый путь MSW-источника схем. Совпадает с тем, что подставляет стенд в `kind: 'http'`. */
export const MOCK_FORMS_BASE = '/mock-forms';

const SCHEMAS: Record<string, unknown> = {
  'alerts-list': alertsSchema,
  'registration-form': registrationSchema,
  'credit-application': creditSchema,
};

export interface FormSchemaMockScenario {
  /** Искусственная задержка ответа, мс. Чтобы состояние загрузки было видно глазами. */
  delayMs: number;
  /** Отдавать `ETag` и отвечать `304` на совпавший `If-None-Match`. */
  useEtag: boolean;
  /** Сколько ближайших запросов провалить. Уменьшается на каждом провале. */
  failTimes: number;
  /** Каким кодом валить. `500` и `429` ретраятся `fetchJson`, `404` — нет. */
  failStatus: number;
  /** Меняется вручную со стенда: другой `ETag` = сервер отдаст новое тело вместо `304`. */
  revision: number;
}

declare global {
  interface Window {
    __formSchemaMock?: FormSchemaMockScenario;
  }
}

export const DEFAULT_SCENARIO: FormSchemaMockScenario = {
  delayMs: 0,
  useEtag: true,
  failTimes: 0,
  failStatus: 500,
  revision: 1,
};

/** Живой объект сценария: стенд правит его поля, обработчик читает при каждом запросе. */
export function formSchemaScenario(): FormSchemaMockScenario {
  if (typeof window === 'undefined') return { ...DEFAULT_SCENARIO };
  window.__formSchemaMock ??= { ...DEFAULT_SCENARIO };
  return window.__formSchemaMock;
}

const etagOf = (id: string, revision: number): string => `W/"${id}-${revision}"`;

export const formSchemaHandlers = [
  http.get(`${MOCK_FORMS_BASE}/:id`, async ({ params, request }) => {
    const id = String(params.id).replace(/\.json$/, '');
    const schema = SCHEMAS[id];
    if (!schema) {
      return HttpResponse.json({ message: `Схема "${id}" не объявлена` }, { status: 404 });
    }

    const scenario = formSchemaScenario();

    // Инъекция отказа идёт ДО задержки: смысл сценария — увидеть ретраи, а не ждать их.
    if (scenario.failTimes > 0) {
      scenario.failTimes -= 1;
      return HttpResponse.json(
        { message: `Сценарий стенда: отказ ${scenario.failStatus}` },
        {
          status: scenario.failStatus,
          // Потолка у `retryDelay` нет, а `Retry-After` он уважает буквально: значение
          // побольше усыпило бы загрузчик на минуты и повесило бы e2e.
          headers: { 'Retry-After': '1' },
        }
      );
    }

    if (scenario.delayMs > 0) await delay(scenario.delayMs);

    if (!scenario.useEtag) return HttpResponse.json(schema);

    const etag = etagOf(id, scenario.revision);
    if (request.headers.get('if-none-match') === etag) {
      // Тело обязано быть пустым: `304` входит в список кодов без тела, и SW пересобирает ответ
      // как `new Response(response.body, response)` — с телом конструктор бросил бы внутри
      // воркера, и запрос повис бы вместо ответа.
      return new HttpResponse(null, { status: 304, headers: { ETag: etag } });
    }
    return HttpResponse.json(schema, { headers: { ETag: etag } });
  }),
];
