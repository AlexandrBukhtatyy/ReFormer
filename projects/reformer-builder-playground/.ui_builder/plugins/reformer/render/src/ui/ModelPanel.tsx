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
 * ровно то, что зовёт рендерер (см. `@/plugins/reformer/core/form-inspect`). Поэтому `compute`, `copyFrom`,
 * `onChange` и `enableWhen` отрабатывают сами, а расходиться с формой нечему.
 *
 * ## Связь с выделением
 *
 * Выделенный в схеме узел подсвечивает строку своего пути, а щелчок по пути выделяет узел — тем
 * же общим каналом выделения, что связывает редактор схемы и превью. Связь «узел ↔ путь»
 * выводится из схемы документа (`indexModelPaths`): поле шаблона строки массива ведёт к строке
 * массива, потому что строки массива панель по путям не показывает.
 *
 * ## Чего панель не делает
 *
 * Не хранит историю правок: журнал потребовал бы перехвата записи в каждый сигнал — отдельная
 * задача с другой ценой, а без неё панель уже отвечает на свой вопрос.
 *
 * @module plugins/reformer/render/ui/ModelPanel
 */

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from 'react';
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
} from '../../../core/form-inspect';
import { ensureSchema, indexModelPaths, isFormSchema } from '../../../core/form-model';
import type {
  NodeId,
  PreviewFormHandle,
  PreviewLiveService,
  ResourceId,
} from '@reformer/builder-plugin-api';
import type { PreviewHost } from '../host';

/** Идентификатор панели. */
export const MODEL_PANEL_ID = 'preview.model';

export interface ModelPanelProps {
  readonly host: PreviewHost;
  /**
   * Живой вид превью — у его владельца, плагина превью, и спрашивается в момент отрисовки.
   *
   * Функция, а не значение: превью выключаемо, и выключенное оставило бы здесь мёртвую
   * ссылку. `undefined` — превью нет, а значит нет и формы, которую показывать.
   */
  readonly live: () => PreviewLiveService | undefined;
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

const NO_SELECTION: readonly NodeId[] = [];

/** Связь строк панели с выделением узлов документа — см. шапку модуля. */
interface SchemaLinks {
  /** Пути выделенных узлов. */
  readonly selected: ReadonlySet<string>;
  /** Узел, которого выделяет щелчок по пути; `undefined` — у пути узла в схеме нет. */
  nodeOf(path: string): NodeId | undefined;
  select(path: string): void;
}

function useSchemaLinks(host: PreviewHost, documentId: ResourceId | null): SchemaLinks {
  const selection = host.selection?.() ?? null;

  const subscribe = useCallback(
    (onChange: () => void) => {
      if (selection === null || documentId === null) return () => {};
      const subscription = selection.onDidChange((resource) => {
        if (resource === documentId) onChange();
      });
      return () => {
        subscription.dispose();
      };
    },
    [selection, documentId]
  );
  const read = useCallback(
    () => (selection === null || documentId === null ? NO_SELECTION : selection.get(documentId)),
    [selection, documentId]
  );
  const ids = useSyncExternalStore(subscribe, read, read);

  // Схема меняется вместе с текстом документа — указатель пересчитывается по его смене.
  const [revision, setRevision] = useState(0);
  useEffect(() => {
    if (documentId === null) return;
    const subscription = host
      .documentOf(documentId)
      ?.onDidChangeContent(() => setRevision((value) => value + 1));
    return () => {
      subscription?.dispose();
    };
  }, [host, documentId]);
  const index = useMemo(() => {
    void revision;
    const schema = documentId === null ? undefined : host.documentOf(documentId)?.model();
    return isFormSchema(schema) ? indexModelPaths(ensureSchema(schema)) : null;
  }, [host, documentId, revision]);

  const selected = useMemo(
    () =>
      new Set(
        ids.flatMap((id) => {
          const path = index?.pathOf.get(id);
          return path === undefined ? [] : [path];
        })
      ),
    [ids, index]
  );

  return {
    selected,
    nodeOf: (path) => index?.nodeOf.get(path),
    select: (path) => {
      const id = index?.nodeOf.get(path);
      if (id === undefined || selection === null || documentId === null) return;
      selection.set(documentId, [id]);
    },
  };
}

/** Значение одной строкой: длинные объекты режутся, потому что строка одна. */
function preview(value: unknown): string {
  if (value === null) return 'null';
  if (value === undefined) return '—';
  if (typeof value === 'string') return value === '' ? '""' : value;
  const text = JSON.stringify(value);
  return text.length > 60 ? `${text.slice(0, 60)}…` : text;
}

/** Ключ значения: строки различаются с числами (`"1"` и `1`), `undefined` — со всем прочим. */
function valueKey(value: unknown): string {
  return value === undefined ? 'undefined' : JSON.stringify(value);
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
      {state.pending ? <Badge variant="outline">pending</Badge> : null}
      {state.touched ? <Badge variant="outline">touched</Badge> : null}
      {state.errors.map((error) => (
        <Badge key={error} variant="destructive">
          {error}
        </Badge>
      ))}
    </>
  );
}

export function ModelPanel({ host, live }: ModelPanelProps): ReactNode {
  const t = host.useTranslate();
  const documentId = host.useActiveDocument();
  const [raw, setRaw] = useState(false);

  const form = usePublishedForm(live(), documentId);
  const model = form?.model ?? null;
  const version = useModelVersion(model);
  const links = useSchemaLinks(host, documentId);

  // Строка выделенного узла показывается: в форме на десятки полей её иначе ищут прокруткой.
  const tableRef = useRef<HTMLTableElement | null>(null);
  useEffect(() => {
    tableRef.current?.querySelector('tr[data-selected]')?.scrollIntoView?.({ block: 'nearest' });
  }, [links.selected]);

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
        <table ref={tableRef} className="w-full text-xs">
          <tbody>
            {rows.map((row) => {
              const nodeState = readNodeState(model, row.path);
              const selected = links.selected.has(row.path);
              return (
                <tr
                  key={row.path}
                  data-selected={selected || undefined}
                  className={`border-border/50 border-b${selected ? ' bg-accent text-accent-foreground' : ''}`}
                >
                  <td className="py-1 pr-2 font-mono" style={{ paddingLeft: 8 + row.depth * 12 }}>
                    {links.nodeOf(row.path) === undefined ? (
                      row.path
                    ) : (
                      <button
                        type="button"
                        className="text-left hover:underline"
                        title={t('model.select')}
                        onClick={() => links.select(row.path)}
                      >
                        {row.path}
                      </button>
                    )}
                  </td>
                  <td className="py-1 pr-2">
                    {row.kind === 'group' ? (
                      <span className="text-muted-foreground">{preview(row.value)}</span>
                    ) : (
                      <ValueEditor
                        // Поля редактора неуправляемые: `defaultValue` применяется только при
                        // монтировании. Ключ по значению перемонтирует редактор, когда значение
                        // сменилось в форме, — иначе панель показывала бы начальное. Своя правка
                        // пишется на blur, поэтому набор в панели ключ не трогает.
                        key={valueKey(row.value)}
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

/**
 * Форма, опубликованная поверхностью для документа. Именованная функция — ради правил хуков.
 *
 * Читает её у живого вида, а не у реестра состояний превью: реестр — внутреннее дело плагина
 * превью, а наружу он отдаёт ровно этот вопрос и подписку на ответ.
 */
function usePublishedForm(
  live: PreviewLiveService | undefined,
  documentId: ResourceId | null
): PreviewFormHandle | null {
  const [, force] = useState(0);
  useEffect(() => {
    if (live === undefined || documentId === null) return;
    const subscription = live.onDidChangeForm(documentId, () => force((value) => value + 1));
    return () => {
      subscription.dispose();
    };
  }, [live, documentId]);
  return live === undefined || documentId === null ? null : live.formOf(documentId);
}
