/**
 * Сценарий MSW-источника: задержка, ETag/304, инъекция отказов, смена ревизии схемы.
 *
 * Обработчик читает объект сценария при КАЖДОМ запросе, поэтому переключатели действуют сразу и
 * перезагрузка страницы не нужна. Работает только когда моки подняты — то есть в режиме разработки
 * и без `?mocks=off`.
 *
 * @module react-playground/examples/form-registry-lab/msw-scenario
 */

import { useState } from 'react';
import { Button, Card, CardContent, CardHeader, CardTitle } from '@reformer/ui-kit';
import { formSchemaScenario } from '../../../mocks/form-schema-handlers';

const DELAYS = [0, 300, 1500];

export function MswScenario({ enabled }: { enabled: boolean }) {
  const scenario = formSchemaScenario();
  // Сценарий — обычный объект, а не сигнал: перерисовку вызываем сами, чтобы не тащить в моки
  // реактивность ради трёх переключателей.
  const [, force] = useState(0);
  const update = (patch: Partial<typeof scenario>): void => {
    Object.assign(scenario, patch);
    force((n) => n + 1);
  };

  return (
    <Card className={enabled ? undefined : 'opacity-50'}>
      <CardHeader>
        <CardTitle className="text-base">Сценарий MSW</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3 text-sm">
        {!enabled && (
          <p className="rounded-md bg-gray-100 p-2 text-xs text-gray-600">
            Активен только при источнике «HTTP: MSW». Сами моки поднимаются лишь в режиме разработки
            и глушатся флагом <code>?mocks=off</code>.
          </p>
        )}

        <fieldset disabled={!enabled} className="space-y-3">
          <div className="space-y-1">
            <span className="text-xs font-semibold tracking-wide text-gray-500 uppercase">
              Задержка ответа
            </span>
            <div className="flex flex-wrap gap-2">
              {DELAYS.map((ms) => (
                <Button
                  key={ms}
                  size="sm"
                  variant={scenario.delayMs === ms ? 'default' : 'outline'}
                  data-testid={`msw-delay-${ms}`}
                  onClick={() => update({ delayMs: ms })}
                >
                  {ms === 0 ? 'без задержки' : `${ms} мс`}
                </Button>
              ))}
            </div>
          </div>

          <div className="space-y-1">
            <span className="text-xs font-semibold tracking-wide text-gray-500 uppercase">
              Условные запросы
            </span>
            <div className="flex flex-wrap items-center gap-2">
              <Button
                size="sm"
                variant={scenario.useEtag ? 'default' : 'outline'}
                data-testid="msw-toggle-etag"
                onClick={() => update({ useEtag: !scenario.useEtag })}
              >
                ETag: {scenario.useEtag ? 'включён' : 'выключен'}
              </Button>
              <Button
                size="sm"
                variant="outline"
                data-testid="msw-bump-revision"
                onClick={() => update({ revision: scenario.revision + 1 })}
              >
                Изменить схему на сервере (ревизия {scenario.revision})
              </Button>
            </div>
            <p className="text-xs text-gray-500">
              С включённым ETag протухшая запись даёт <code>stale</code> → <code>revalidated</code>.
              Смена ревизии меняет ETag, и вместо 304 приедет новое тело — <code>refetched</code>.
            </p>
          </div>

          <div className="space-y-1">
            <span className="text-xs font-semibold tracking-wide text-gray-500 uppercase">
              Инъекция отказа
            </span>
            <div className="flex flex-wrap items-center gap-2">
              {[500, 429, 404].map((status) => (
                <Button
                  key={status}
                  size="sm"
                  variant="outline"
                  data-testid={`msw-fail-${status}`}
                  onClick={() => update({ failStatus: status, failTimes: 1 })}
                >
                  Уронить один запрос: {status}
                </Button>
              ))}
              {scenario.failTimes > 0 && (
                <Button
                  size="sm"
                  variant="outline"
                  data-testid="msw-fail-cancel"
                  onClick={() => update({ failTimes: 0 })}
                >
                  Отменить ({scenario.failTimes})
                </Button>
              )}
            </div>
            <p className="text-xs text-gray-500">
              500 и 429 загрузчик ретраит (две попытки сверх первой), поэтому один «уронить» даёт до
              трёх строк в журнале сети и всё равно успешную загрузку. 404 не ретраится — форма
              уйдёт в ошибку.
            </p>
          </div>
        </fieldset>
      </CardContent>
    </Card>
  );
}
