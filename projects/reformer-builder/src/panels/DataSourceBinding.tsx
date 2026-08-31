/**
 * Общая «шапка» редакторов пропа-списка в инспекторе: откуда берутся данные — из инлайн-литерала
 * в самой схеме или из именованного `$dataSource(NAME)`. Одинакова для плоских опций
 * ({@link '../panels/OptionsField'}) и для иерархии ({@link '../panels/TreeNodesField'}), а вот
 * инлайн-редактор у них разный — он и приходит сюда через `renderInline`.
 *
 * Вынесено ровно потому, что выбор источника — не деталь оформления: новый источник создаётся
 * В МОК-ДАННЫХ (спрашиваем имя → добавляем в секцию `dataSources` → привязываем → открываем
 * вкладку «Registry»), и вторая копия этой цепочки разъехалась бы с первой на первой же правке.
 *
 * @module reformer-builder/panels/DataSourceBinding
 */

import { useMemo, useState, type ReactNode } from 'react';
import { ExternalLink, X } from 'lucide-react';
import { Input } from '@reformer/ui-kit';
import { parseOperator, type JsonNode } from '@reformer/renderer-json';
import { setComponentProp, type JsonPath } from '../model';
import type { InspectorProp } from '../catalog';
import { editorActions, useActiveTab, useUi } from '../store';
import { effectiveMock, serializeSection } from '../canvas/mock-data';

const SELECT_CLS =
  'h-[26px] min-w-0 flex-1 rounded-md border border-input bg-background px-2 text-xs outline-none focus:border-ring';

export function DataSourceBinding({
  node,
  path,
  prop,
  inlineLabel,
  seed,
  renderInline,
}: {
  node: JsonNode;
  path: JsonPath;
  prop: InspectorProp;
  /** Подпись пункта «данные лежат прямо в схеме» — она называет их вид («Инлайн-опции»/«дерево»). */
  inlineLabel: string;
  /** Значение, которым наполняется ТОЛЬКО ЧТО созданный источник: пустой мок правит вслепую. */
  seed: (name: string) => unknown;
  /** Редактор инлайн-значения; показывается, когда привязки к источнику нет. */
  renderInline: (value: unknown, onChange: (next: unknown) => void) => ReactNode;
}) {
  const tab = useActiveTab();
  const { rawJsonOpen } = useUi();

  const props = (node as { componentProps?: Record<string, unknown> }).componentProps ?? {};
  const value = props[prop.key];
  const bound = parseOperator(value);
  const boundName = bound?.op === 'dataSource' ? bound.arg : null;

  // Доступные для привязки источники: из мок-данных (option/scalar) + уже привязанный (на всякий).
  const sourceNames = useMemo(() => {
    const names = new Set<string>(
      tab ? Object.keys(effectiveMock(tab.schema, tab.mock).dataSources) : []
    );
    if (boundName) names.add(boundName);
    return [...names].sort();
  }, [tab, boundName]);

  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState('');

  const setValue = (v: unknown) =>
    editorActions.apply((s) => setComponentProp(s, path, prop.key, v), {
      coalesceKey: `${prop.key}@${path.join('.')}`,
    });
  const bindTo = (name: string) => setValue(`$dataSource(${name})`);

  const openRegistry = () => {
    editorActions.setBottomTab('registry');
    if (!rawJsonOpen) editorActions.toggleRawJson();
  };

  const createSource = () => {
    const name = newName.trim();
    if (!name || !tab) return;
    const mock = effectiveMock(tab.schema, tab.mock);
    if (!(name in mock.dataSources)) {
      mock.dataSources = { ...mock.dataSources, [name]: seed(name) };
      editorActions.setMockText(tab.id, 'dataSources', serializeSection(mock, 'dataSources'));
    }
    bindTo(name);
    setCreating(false);
    setNewName('');
    openRegistry();
  };

  const onSelect = (v: string) => {
    if (v === '__inline__') {
      setCreating(false);
      setValue(Array.isArray(value) ? value : []); // сохранить текущее инлайн-значение, если было
    } else if (v === '__new__') {
      setCreating(true);
    } else {
      setCreating(false);
      bindTo(v);
    }
  };

  const mode = creating ? '__new__' : (boundName ?? '__inline__');

  return (
    <div className="flex flex-col gap-2">
      <div className="flex min-h-6 items-center gap-1.5">
        <span className="flex-none text-xs" title={prop.description}>
          {prop.label}
        </span>
        {boundName && !creating && (
          <button
            onClick={openRegistry}
            title={`Данные источника «${boundName}» — во вкладке «Registry»`}
            className="flex-none rounded p-0.5 text-muted-foreground hover:bg-muted hover:text-foreground"
          >
            <ExternalLink className="h-3 w-3" />
          </button>
        )}
        <select value={mode} onChange={(e) => onSelect(e.target.value)} className={SELECT_CLS}>
          <option value="__inline__">{inlineLabel}</option>
          {sourceNames.map((n) => (
            <option key={n} value={n}>
              $dataSource({n})
            </option>
          ))}
          <option value="__new__">+ Новый источник…</option>
        </select>
      </div>

      {creating && (
        <div className="flex items-center gap-1.5">
          <Input
            autoFocus
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') createSource();
              if (e.key === 'Escape') {
                setCreating(false);
                setNewName('');
              }
            }}
            placeholder="ИМЯ_ИСТОЧНИКА"
            className="h-[26px] flex-1 bg-background text-xs"
          />
          <button
            onClick={createSource}
            disabled={!newName.trim()}
            className="flex-none rounded-md bg-primary px-2 py-1 text-[11px] text-primary-foreground disabled:opacity-50"
          >
            Создать
          </button>
          <button
            onClick={() => {
              setCreating(false);
              setNewName('');
            }}
            className="flex-none rounded-md px-1.5 py-1 text-muted-foreground hover:bg-muted"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      )}

      {!boundName && !creating && renderInline(value, setValue)}
    </div>
  );
}
