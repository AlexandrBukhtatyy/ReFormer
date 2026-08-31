/**
 * Панель «Модель»: что форма насчитала и чем это можно поправить.
 *
 * ## Зачем она есть
 *
 * Значения формы существуют только внутри контролов. Понять, сработал ли `compute`, что лежит
 * в скрытом поле и почему `required` не гаснет, — можно лишь по косвенным признакам на экране.
 * А подать форме то, чего интерфейс не производит (`null` в обязательном, значение вне списка
 * опций, серверную ошибку), нельзя вообще: единственный способ ввода — сам контрол.
 *
 * ## Правка идёт ТЕМ ЖЕ путём, что ввод
 *
 * Панель не заводит второй точки ввода: она зовёт `fieldNode.setValue` и `markAsTouched` —
 * ровно то, что зовёт рендерер (см. `lib/form-inspect`). Поэтому `compute`, `copyFrom`,
 * `onChange` и `enableWhen` отрабатывают сами, а расходиться с формой нечему.
 *
 * ## Чего панель не делает
 *
 * Не хранит историю правок: журнал потребовал бы перехвата записи в каждый сигнал — отдельная
 * задача с другой ценой, а без неё панель уже отвечает на свой вопрос.
 *
 * @module plugins/preview/ui/ModelPanel
 */

import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { Badge } from '@reformer/ui-kit/badge';
import { Button } from '@reformer/ui-kit/button';
import { Checkbox } from '@reformer/ui-kit/checkbox';
import { Input } from '@reformer/ui-kit/input';
import { ScrollArea } from '@reformer/ui-kit/scroll-area';
import {
  collectRows,
  readNodeState,
  resetNode,
  setNodeDisabled,
  snapshot,
  writeValue,
  type ModelRow,
  type NodeState,
} from '@/lib/form-inspect';
import type { PreviewHost } from '../host';
import type { PreviewSessions } from '../sessions';

/** Идентификатор панели. */
export const MODEL_PANEL_ID = 'preview.model';

export interface ModelPanelProps {
  readonly host: PreviewHost;
  readonly sessions: PreviewSessions;
}

/** Модель как источник подписки: `model.$` — сигнал значений целиком. */
interface ObservableModel {
  readonly $?: { subscribe?(cb: (value: unknown) => void): () => void };
}

/**
 * Счётчик изменений модели.
 *
 * Подписка на корневой сигнал, а не на каждый путь: путей десятки, подписок было бы столько же,
 * и заводить их пришлось бы заново на каждую пересборку. Цена — перерисовка панели на каждое
 * нажатие клавиши в форме; она приемлема, пока панель рисует строки, а не форму.
 */
function useModelVersion(model: unknown): number {
  const [version, setVersion] = useState(0);
  useEffect(() => {
    const root = (model as ObservableModel | null)?.$;
    if (typeof root?.subscribe !== 'function') return;
    const off = root.subscribe(() => setVersion((value) => value + 1));
    return () => {
      off();
    };
  }, [model]);
  return version;
}

/** Значение одной строкой: длинные объекты режутся, потому что строка одна. */
function preview(value: unknown): string {
  if (value === null) return 'null';
  if (value === undefined) return '—';
  if (typeof value === 'string') return value === '' ? '""' : value;
  const text = JSON.stringify(value);
  return text.length > 60 ? `${text.slice(0, 60)}…` : text;
}

/** Редактор значения по его ТИПУ: узла схемы у панели нет, а тип значения есть всегда. */
function ValueEditor({
  row,
  state,
  onWrite,
}: {
  row: ModelRow;
  state: NodeState | null;
  onWrite: (value: unknown) => void;
}): ReactNode {
  const disabled = state?.derived === true;

  if (typeof row.value === 'boolean') {
    return (
      <Checkbox
        checked={row.value}
        disabled={disabled}
        onCheckedChange={(next) => onWrite(next === true)}
      />
    );
  }
  if (typeof row.value === 'number') {
    return (
      <Input
        type="number"
        className="h-6 w-32 text-xs"
        disabled={disabled}
        defaultValue={String(row.value)}
        onBlur={(event) => {
          const text = event.currentTarget.value;
          // Пустая строка — это `null`, а не `NaN`: «поле очистили» и «в поле мусор» —
          // разные состояния, и первое встречается на порядок чаще.
          onWrite(text === '' ? null : Number(text));
        }}
      />
    );
  }
  if (row.kind === 'leaf') {
    return (
      <Input
        className="h-6 w-48 text-xs"
        disabled={disabled}
        defaultValue={row.value === null ? '' : String(row.value)}
        onBlur={(event) => onWrite(event.currentTarget.value)}
      />
    );
  }
  // Объект и массив правятся JSON'ом целиком: это же покрывает добавление и удаление
  // элементов, а кнопка «добавить» обязана была бы воспроизвести шаблон элемента.
  return (
    <Input
      className="h-6 w-64 font-mono text-xs"
      disabled={disabled || row.kind === 'group'}
      defaultValue={JSON.stringify(row.value)}
      onBlur={(event) => {
        try {
          onWrite(JSON.parse(event.currentTarget.value));
        } catch {
          // Битый JSON — не повод писать мусор в модель. Значение вернётся на следующей
          // перерисовке, и это самый понятный отказ из возможных.
        }
      }}
    />
  );
}

/** Метки состояния узла. Их немного намеренно: строка одна, и она про значение. */
function StateBadges({ state }: { state: NodeState | null }): ReactNode {
  if (state === null) return null;
  return (
    <>
      {state.derived ? <Badge variant="outline">compute</Badge> : null}
      {state.disabled ? <Badge variant="outline">disabled</Badge> : null}
      {state.touched ? <Badge variant="outline">touched</Badge> : null}
      {state.errors.map((error) => (
        <Badge key={error} variant="destructive">
          {error}
        </Badge>
      ))}
    </>
  );
}

export function ModelPanel({ host, sessions }: ModelPanelProps): ReactNode {
  const t = host.useTranslate();
  const documentId = host.useActiveDocument();
  const store = documentId === null ? null : sessions.storeFor(documentId);
  const [raw, setRaw] = useState(false);

  const state = useSessionState(store);
  const form = state?.form ?? null;
  const model = form?.model ?? null;
  const version = useModelVersion(model);

  const rows = useMemo(() => {
    void version;
    return model === null ? [] : collectRows(snapshot(model));
  }, [model, version]);

  const write = useCallback(
    (path: string, value: unknown) => {
      if (model === null) return;
      writeValue(model, path, value, { raw });
    },
    [model, raw]
  );

  if (model === null) {
    return <div className="text-muted-foreground p-3 text-xs">{t('model.empty')}</div>;
  }

  return (
    <div className="flex h-full flex-col">
      <div className="border-border flex items-center gap-2 border-b px-3 py-1 text-[11px]">
        <label className="flex items-center gap-1">
          <Checkbox checked={raw} onCheckedChange={(next) => setRaw(next === true)} />
          {t('model.raw')}
        </label>
        <span className="text-muted-foreground">{t('model.raw.hint')}</span>
        <Button
          size="sm"
          variant="ghost"
          className="ml-auto h-6"
          onClick={() => {
            void navigator.clipboard?.writeText(JSON.stringify(snapshot(model), null, 2));
          }}
        >
          {t('model.copy')}
        </Button>
      </div>

      <ScrollArea className="min-h-0 flex-1">
        <table className="w-full text-xs">
          <tbody>
            {rows.map((row) => {
              const nodeState = readNodeState(model, row.path);
              return (
                <tr key={row.path} className="border-border/50 border-b">
                  <td className="py-1 pr-2 font-mono" style={{ paddingLeft: 8 + row.depth * 12 }}>
                    {row.path}
                  </td>
                  <td className="py-1 pr-2">
                    {row.kind === 'group' ? (
                      <span className="text-muted-foreground">{preview(row.value)}</span>
                    ) : (
                      <ValueEditor
                        row={row}
                        state={nodeState}
                        onWrite={(value) => write(row.path, value)}
                      />
                    )}
                  </td>
                  <td className="flex flex-wrap items-center gap-1 py-1 pr-2">
                    <StateBadges state={nodeState} />
                  </td>
                  <td className="py-1 pr-2 text-right">
                    {nodeState === null ? null : (
                      <>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-5 px-1"
                          onClick={() => resetNode(model, row.path)}
                        >
                          {t('model.reset')}
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-5 px-1"
                          onClick={() => setNodeDisabled(model, row.path, !nodeState.disabled)}
                        >
                          {nodeState.disabled ? t('model.enable') : t('model.disable')}
                        </Button>
                      </>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </ScrollArea>
    </div>
  );
}

/** Снимок состояния сеанса. Именованная функция — ради правил хуков. */
function useSessionState(store: ReturnType<PreviewSessions['storeFor']> | null) {
  const [, force] = useState(0);
  useEffect(() => {
    if (store === null) return;
    const subscription = store.subscribe(() => force((value) => value + 1));
    return () => {
      subscription.dispose();
    };
  }, [store]);
  return store?.get() ?? null;
}
