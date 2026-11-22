/**
 * Панель реестра: что зарегистрировано и что сообщил preflight.
 *
 * Показываются ОБА ключа — записи (`id@version`) и кэша (`owner/id@version#часть`). Они разные, и
 * это регулярно сбивает: сменив `owner`, получаешь промах кэша при той же самой записи.
 *
 * @module react-playground/examples/form-registry-lab/registry-panel
 */

import { useSyncExternalStore } from 'react';
import type { FormEntry, FormRegistry } from '@reformer/form-registry';
import { Badge, Card, CardContent, CardHeader, CardTitle } from '@reformer/ui-kit';
import { diagnosticLog } from './lab-cache';

const sourceKind = (entry: FormEntry): string => entry.schema.kind;

const kindTone: Record<string, string> = {
  inline: 'bg-gray-100 text-gray-700',
  http: 'bg-blue-100 text-blue-800',
  module: 'bg-purple-100 text-purple-800',
};

export function RegistryPanel({
  registry,
  activeId,
  owner,
}: {
  registry: FormRegistry;
  activeId: string;
  owner: string;
}) {
  // Состав реестра стенда меняться не должен, но подписка честнее снимка: если запись когда-нибудь
  // станет регистрироваться динамически, панель не начнёт врать молча.
  const entries = useSyncExternalStore(registry.subscribe, registry.list, registry.list);
  const diagnostics = useSyncExternalStore(
    diagnosticLog.subscribe,
    diagnosticLog.snapshot,
    diagnosticLog.snapshot
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Реестр стенда</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-xs text-gray-500">
          Свой экземпляр реестра, а не общий: <code>FormOutlet</code> без версии отдаёт первую
          запись после сортировки по убыванию версии, и варианты стенда угнали бы обычные страницы
          витрины.
        </p>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="text-gray-500">
              <tr>
                <th className="py-1 pr-3 font-medium">Запись</th>
                <th className="py-1 pr-3 font-medium">Схема</th>
                <th className="py-1 font-medium">Ключ кэша</th>
              </tr>
            </thead>
            <tbody className="font-mono">
              {entries.map((entry) => {
                const active = entry.id === activeId;
                return (
                  <tr
                    key={`${entry.id}@${entry.version}`}
                    data-testid={`registry-row-${entry.id}`}
                    className={active ? 'bg-blue-50' : undefined}
                  >
                    <td className="py-1 pr-3 whitespace-nowrap text-gray-900">
                      {active && <span className="mr-1 text-blue-600">●</span>}
                      {entry.id}@{entry.version}
                    </td>
                    <td className="py-1 pr-3">
                      <Badge className={kindTone[sourceKind(entry)]}>{sourceKind(entry)}</Badge>
                    </td>
                    <td className="py-1 text-gray-500">
                      {entry.schema.kind === 'http'
                        ? `${owner}/${entry.id}@${entry.version}#schema`
                        : '— кэш не участвует'}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <section className="space-y-1">
          <h4 className="text-xs font-semibold tracking-wide text-gray-500 uppercase">
            Диагностика (preflight и L2)
          </h4>
          <div
            data-testid="lab-diagnostics"
            className="max-h-40 space-y-1 overflow-auto rounded-md bg-gray-50 p-2"
          >
            {diagnostics.length === 0 && (
              <p className="text-xs text-gray-400">Чисто: ни одной проблемы.</p>
            )}
            {[...diagnostics].reverse().map((d, i) => (
              <div key={diagnostics.length - i} className="text-xs">
                <Badge
                  className={
                    d.level === 'error' ? 'bg-red-100 text-red-800' : 'bg-amber-100 text-amber-900'
                  }
                >
                  {d.code}
                </Badge>{' '}
                <span className="text-gray-700">{d.message}</span>{' '}
                <code className="text-gray-400">{d.source}</code>
              </div>
            ))}
          </div>
        </section>
      </CardContent>
    </Card>
  );
}
