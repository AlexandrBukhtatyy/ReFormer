/**
 * Стенд реестра форм: три формы, три источника схемы, живой кэш и его метрики.
 *
 * Собственный вложенный `FormRegistryProvider` — не прихоть: `maxAgeMs` и хранилище замкнуты внутри
 * `createSchemaCache` и меняются только пересозданием экземпляра, а провайдеры вкладываются, и
 * внутренний перекрывает внешний. Так настройки кэша крутятся на лету, не задевая остальную витрину.
 *
 * Что здесь можно увидеть глазами:
 * - холодный старт → повторный монтаж без единого сетевого обращения;
 * - F5 при хранилище IndexedDB/OPFS — схема поднимается из L2, а не из сети;
 * - срок свежести 0 → условный запрос и подтверждение 304;
 * - две копии формы одновременно → один запрос на двоих (дедупликация);
 * - падение 500 → ретраи → успех, и 404 → ошибка с кнопкой повтора.
 *
 * @module react-playground/examples/form-registry-lab/FormRegistryLab
 */

import { useCallback, useMemo, useState } from 'react';
import type { ResolveContext } from '@reformer/form-registry';
import { FormOutlet, FormRegistryProvider } from '@reformer/form-registry/react';
import { Alert, AlertDescription, Badge, Button, Spinner } from '@reformer/ui-kit';
import { baseComponentRegistry } from '../../../forms/registry';
import { LAB_FORMS, labEntryId, labRegistry } from './lab-registry';
import { SCHEMA_SOURCES, sourceUrl, type SchemaSourceKind } from './schema-sources';
import {
  MAX_AGE_PRESETS,
  STORAGE_OPTIONS,
  createLabCache,
  diagnosticLog,
  type LabStorageKind,
} from './lab-cache';
import { countingFetch } from './lab-net';
import { describeLoadError } from './load-error';
import { CachePanel } from './cache-panel';
import { RegistryPanel } from './registry-panel';
import { MswScenario } from './msw-scenario';

/** Прав и флагов у стенда нет — константа на модуль, чтобы не пересчитывать разрешение записи. */
const LAB_CONTEXT: ResolveContext = { permissions: new Set(), flags: new Set() };

const OWNER = 'react-playground';

/** Ключ кэша схемы. Тот же расчёт, что в загрузчике: владелец в ключе, хранилище общее на origin. */
const schemaCacheKey = (entryId: string): string => `${OWNER}/${entryId}@1.0.0#schema`;

function Chooser<T extends string>({
  label,
  value,
  options,
  testIdPrefix,
  onChange,
}: {
  label: string;
  value: T;
  options: readonly { kind: T; title: string; hint: string; disabled?: boolean }[];
  testIdPrefix: string;
  onChange: (next: T) => void;
}) {
  const active = options.find((o) => o.kind === value);
  return (
    <div className="space-y-1">
      <span className="text-xs font-semibold tracking-wide text-gray-500 uppercase">{label}</span>
      <div className="flex flex-wrap gap-2">
        {options.map((option) => (
          <Button
            key={option.kind}
            size="sm"
            disabled={option.disabled}
            variant={option.kind === value ? 'default' : 'outline'}
            data-testid={`${testIdPrefix}-${option.kind}`}
            onClick={() => onChange(option.kind)}
          >
            {option.title}
          </Button>
        ))}
      </div>
      {active && <p className="text-xs text-gray-500">{active.hint}</p>}
    </div>
  );
}

/**
 * Отказ загрузки с настоящей причиной, а не с одним обёрточным сообщением.
 *
 * Загрузчик оборачивает и 404, и «пришёл html вместо JSON», и обрыв сети в один и тот же текст
 * «не загрузилось по сети (url)». Разобрать по нему нечего, поэтому панель разворачивает цепочку
 * `cause` до `FormFetchError` и показывает `kind`, код ответа и адрес.
 */
function LoadErrorPanel({ error, onRetry }: { error: Error; onRetry: () => void }) {
  const detail = describeLoadError(error);
  return (
    <Alert variant="destructive" data-testid="lab-form-error">
      <AlertDescription className="space-y-2">
        <span className="block font-medium">{detail.message}</span>
        <div className="flex flex-wrap items-center gap-2 text-xs">
          {detail.kind && <Badge data-testid="lab-error-kind">{detail.kind}</Badge>}
          {detail.status !== undefined && (
            <Badge data-testid="lab-error-status">HTTP {detail.status}</Badge>
          )}
        </div>
        {detail.hint && <span className="block text-xs">{detail.hint}</span>}
        {detail.url && (
          <code data-testid="lab-error-url" className="block text-xs break-all opacity-80">
            {detail.url}
          </code>
        )}
        {detail.chain.length > 1 && (
          <details className="text-xs">
            <summary className="cursor-pointer">Цепочка причин</summary>
            <ol className="mt-1 list-decimal space-y-0.5 pl-4">
              {detail.chain.map((line, i) => (
                <li key={i}>{line}</li>
              ))}
            </ol>
          </details>
        )}
        <Button size="sm" variant="outline" data-testid="btn-form-retry" onClick={onRetry}>
          Повторить
        </Button>
      </AlertDescription>
    </Alert>
  );
}

export default function FormRegistryLab() {
  const [formId, setFormId] = useState(LAB_FORMS[0]!.formId);
  const [source, setSource] = useState<SchemaSourceKind>('static');
  const [storage, setStorage] = useState<LabStorageKind>('indexeddb');
  const [maxAgeMs, setMaxAgeMs] = useState(MAX_AGE_PRESETS[0]!.ms);
  const [mounted, setMounted] = useState(true);
  const [twin, setTwin] = useState(false);

  // Пересоздание кэша — это и есть способ применить новые настройки; смена ссылки заодно
  // перезагружает смонтированные формы, что на стенде и нужно показать.
  const { cache, events } = useMemo(() => createLabCache(storage, maxAgeMs), [storage, maxAgeMs]);

  const onDiagnostic = useCallback(
    (d: { level: 'warn' | 'error'; code: string; message: string }) =>
      diagnosticLog.push({
        code: d.code,
        message: d.message,
        source: 'preflight',
        level: d.level,
      }),
    []
  );

  // `preflight: 'warn'` вместо умолчания: непройденную проверку интереснее показать в панели, чем
  // получить пустое место вместо формы. `fetchImpl` считает обращения — это главное доказательство
  // стенда, потому что запросы через Service Worker до перехватчиков Playwright не доходят.
  const options = useMemo(
    () => ({ preflight: 'warn' as const, fetchImpl: countingFetch, onDiagnostic }),
    [onDiagnostic]
  );

  const entryId = labEntryId(formId, source);
  const activeForm = LAB_FORMS.find((f) => f.formId === formId);
  const activeUrl = sourceUrl(formId, source);

  const invalidateActive = useCallback(() => {
    void cache.invalidate(schemaCacheKey(entryId));
  }, [cache, entryId]);

  const slot = (
    <FormOutlet
      id={entryId}
      // Без fallback и loadErrorFallback FormOutlet рендерит null: с сетевым источником и
      // ожидание, и отказ выглядели бы одинаково — пустым местом.
      fallback={
        <div
          data-testid="lab-form-pending"
          className="flex items-center gap-2 p-6 text-sm text-gray-500"
        >
          <Spinner /> Загружаем части формы…
        </div>
      }
      loadErrorFallback={(error, retry) => <LoadErrorPanel error={error} onRetry={retry} />}
      errorFallback={(error) => (
        <Alert variant="destructive" data-testid="lab-form-render-error">
          <AlertDescription>Форма упала на рендере: {error.message}</AlertDescription>
        </Alert>
      )}
    />
  );

  return (
    <FormRegistryProvider
      registry={labRegistry}
      context={LAB_CONTEXT}
      baseRegistry={baseComponentRegistry}
      cache={cache}
      options={options}
    >
      <div className="space-y-4">
        <div className="rounded-lg border border-gray-200 bg-white p-4">
          <div className="flex flex-wrap gap-2" role="tablist">
            {LAB_FORMS.map((form) => (
              <Button
                key={form.formId}
                size="sm"
                role="tab"
                aria-selected={form.formId === formId}
                variant={form.formId === formId ? 'default' : 'outline'}
                data-testid={`lab-tab-${form.formId}`}
                onClick={() => setFormId(form.formId)}
              >
                {form.title}
              </Button>
            ))}
          </div>
          {activeForm && <p className="mt-2 text-xs text-gray-500">{activeForm.note}</p>}

          <div className="mt-4 grid gap-4 md:grid-cols-3">
            <Chooser
              label="Источник схемы"
              value={source}
              options={SCHEMA_SOURCES}
              testIdPrefix="lab-source"
              onChange={setSource}
            />
            <Chooser
              label="Хранилище L2"
              value={storage}
              options={STORAGE_OPTIONS.map((o) => ({ ...o, disabled: !o.available() }))}
              testIdPrefix="lab-storage"
              onChange={setStorage}
            />
            <div className="space-y-1">
              <span className="text-xs font-semibold tracking-wide text-gray-500 uppercase">
                Срок свежести
              </span>
              <div className="flex flex-wrap gap-2">
                {MAX_AGE_PRESETS.map((preset) => (
                  <Button
                    key={preset.ms}
                    size="sm"
                    variant={preset.ms === maxAgeMs ? 'default' : 'outline'}
                    data-testid={`lab-maxage-${preset.ms}`}
                    onClick={() => setMaxAgeMs(preset.ms)}
                  >
                    {preset.title}
                  </Button>
                ))}
              </div>
              <p className="text-xs text-gray-500">
                {MAX_AGE_PRESETS.find((p) => p.ms === maxAgeMs)?.hint}
              </p>
            </div>
          </div>

          <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-gray-100 pt-3">
            <Button
              size="sm"
              variant={mounted ? 'outline' : 'default'}
              data-testid="lab-toggle-mount"
              onClick={() => setMounted((v) => !v)}
            >
              {mounted ? 'Размонтировать' : 'Смонтировать'}
            </Button>
            <Button
              size="sm"
              variant={twin ? 'default' : 'outline'}
              data-testid="lab-toggle-twin"
              onClick={() => setTwin((v) => !v)}
            >
              Две копии сразу
            </Button>
            <Badge className="bg-gray-100 font-mono text-gray-700">{entryId}</Badge>
            {activeUrl && (
              <code
                data-testid="lab-active-url"
                title="Адрес, по которому поедет схема"
                className="max-w-full truncate text-xs text-gray-500"
              >
                {activeUrl}
              </code>
            )}
            {twin && (
              <span className="text-xs text-gray-500">
                Один запрос на двоих: второй монтаж присоединяется к первому — <code>dedup</code>.
                Учтите, что две копии регистрации делят состояние отправки.
              </span>
            )}
          </div>
        </div>

        <div className="grid gap-4 xl:grid-cols-2">
          <div className="space-y-4">
            <div
              data-testid="lab-form-slot"
              className="rounded-lg border border-gray-200 bg-white p-4"
            >
              {mounted ? (
                // Копии стопкой, а не в колонки: шапка шагов визарда не переносится и в узкой
                // колонке наезжает сама на себя. Смысл режима — счётчик дедупликации, а не
                // сравнение бок о бок.
                <div className={twin ? 'space-y-4 divide-y divide-gray-100' : undefined}>
                  {slot}
                  {twin && slot}
                </div>
              ) : (
                <p
                  data-testid="lab-form-unmounted"
                  className="p-6 text-center text-sm text-gray-400"
                >
                  Форма размонтирована. Смонтируйте снова — и посмотрите, пошёл ли загрузчик в сеть.
                </p>
              )}
            </div>
            <MswScenario enabled={source === 'msw'} />
          </div>

          <div className="space-y-4">
            <CachePanel cache={cache} events={events} onInvalidateAll={invalidateActive} />
            <RegistryPanel registry={labRegistry} activeId={entryId} owner={OWNER} />
          </div>
        </div>
      </div>
    </FormRegistryProvider>
  );
}
