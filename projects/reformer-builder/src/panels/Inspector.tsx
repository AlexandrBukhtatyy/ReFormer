/**
 * Инспектор свойств (спека §8): секции из props-схемы каталога, виджет по `x-doc.kind`
 * (boolean→Switch, enum→select, number/text→Input, readonly→серое поле), `x-runtimeProps` скрыты
 * (§5). Значения берутся из `componentProps` узла, правка идёт через `setComponentProp` с
 * коалесингом (одна запись истории на серию правок одного пропа). Секция «Привязки» — read-only
 * чипы `$model(...)`/`$dataSource(...)` (Q37).
 *
 * @module reformer-builder/panels/Inspector
 */

import { Input, Switch } from '@reformer/ui-kit';
import {
  isArrayNode,
  isFieldNode,
  parseOperator,
  type JsonNode,
} from '@reformer/renderer-json';
import { findByPath, type JsonPath } from '../model';
import { setComponentProp } from '../model';
import { getCatalogEntry, inspectorGroups, type InspectorProp } from '../catalog';
import { editorActions, useActiveTab, useSelectionPath } from '../store';
import { nodeLabel, nodeTypeBadge } from '../canvas/node-display';
import { cn } from '../lib/cn';

/** Запись каталога для узла (по компоненту/типу). */
function catalogEntryFor(node: JsonNode) {
  if (isArrayNode(node)) return getCatalogEntry('FormArray');
  const comp = (node as { component?: unknown }).component;
  const p = parseOperator(comp);
  if (p?.op === 'component') return getCatalogEntry(p.arg);
  if (p?.op === 'html') return getCatalogEntry(`$html(${p.arg})`);
  return isFieldNode(node) ? getCatalogEntry('Input') : undefined;
}

/** Привязки узла для секции «Привязки»: `$model` + все `$dataSource` из props. */
function bindingsOf(node: JsonNode): string[] {
  const out: string[] = [];
  if (isFieldNode(node)) out.push(node.value);
  if (isArrayNode(node)) out.push(node.array);
  const props = (node as { componentProps?: Record<string, unknown> }).componentProps ?? {};
  for (const v of Object.values(props)) {
    const p = parseOperator(v);
    if (p?.op === 'dataSource') out.push(`$dataSource(${p.arg})`);
  }
  return out;
}

function toNumberValue(raw: string): number | string | undefined {
  if (raw === '') return undefined;
  return /^-?\d*\.?\d+$/.test(raw) ? Number(raw) : raw;
}

function PropRow({
  node,
  path,
  prop,
}: {
  node: JsonNode;
  path: JsonPath;
  prop: InspectorProp;
}) {
  const props = (node as { componentProps?: Record<string, unknown> }).componentProps ?? {};
  const value = props[prop.key];
  const set = (v: unknown) =>
    editorActions.apply((s) => setComponentProp(s, path, prop.key, v), {
      coalesceKey: `${prop.key}@${path.join('.')}`,
    });

  return (
    <div className="flex min-h-6 items-center gap-2.5">
      <span className="min-w-0 flex-1 text-xs" title={prop.description}>
        {prop.label}
      </span>
      {prop.widget === 'boolean' && (
        <Switch checked={value === true} onCheckedChange={(v) => set(v)} />
      )}
      {prop.widget === 'text' && (
        <Input
          value={value == null ? '' : String(value)}
          onChange={(e) => set(e.target.value)}
          className="h-[26px] w-[140px] flex-none text-xs"
        />
      )}
      {prop.widget === 'number' && (
        <Input
          type="number"
          value={value == null ? '' : String(value)}
          onChange={(e) => set(toNumberValue(e.target.value))}
          className="h-[26px] w-[140px] flex-none text-xs"
        />
      )}
      {prop.widget === 'enum' && (
        <select
          value={value == null ? '' : String(value)}
          onChange={(e) => set(e.target.value)}
          className="h-[26px] w-[140px] flex-none rounded-md border border-input bg-background px-2 text-xs outline-none focus:border-ring"
        >
          <option value="" />
          {prop.options?.map((op) => (
            <option key={String(op)} value={String(op)}>
              {String(op)}
            </option>
          ))}
        </select>
      )}
      {prop.widget === 'readonly' && (
        <span className="w-[140px] flex-none truncate rounded-md bg-muted px-2 py-1 font-mono text-[11px] text-muted-foreground">
          {value == null ? '—' : String(value)}
        </span>
      )}
    </div>
  );
}

export function Inspector() {
  const tab = useActiveTab();
  const selPath = useSelectionPath();
  const node = tab && selPath ? findByPath(tab.schema, selPath) : undefined;

  if (!node || !selPath) {
    return (
      <div className="grid flex-1 place-items-center p-6 text-center text-xs text-muted-foreground">
        Выберите узел в дереве или preview, чтобы редактировать его свойства
      </div>
    );
  }

  const entry = catalogEntryFor(node);
  const groups = entry ? inspectorGroups(entry.propsSchema) : [];
  const bindings = bindingsOf(node);

  return (
    <div className="flex-1 overflow-auto">
      <div className="border-b border-border p-3.5">
        <div className="flex items-center gap-2">
          <span className="flex-none rounded-full bg-foreground px-2 py-0.5 font-mono text-[9.5px] font-semibold text-background">
            {nodeTypeBadge(node)}
          </span>
          <span className="min-w-0 truncate text-[13px] font-semibold">{nodeLabel(node)}</span>
        </div>
        <div className="mt-1.5 font-mono text-[11px] text-muted-foreground">/{selPath.join('/')}</div>
      </div>

      {groups.map((group) => (
        <div key={group.group} className="border-b border-border p-3.5">
          <div className="mb-2.5 text-[10.5px] font-semibold uppercase tracking-wider text-muted-foreground">
            {group.group}
          </div>
          <div className="flex flex-col gap-2.5">
            {group.props.map((prop) => (
              <PropRow key={prop.key} node={node} path={selPath} prop={prop} />
            ))}
          </div>
        </div>
      ))}

      {!entry && (
        <div className="border-b border-border p-3.5 text-xs text-muted-foreground">
          Нет props-схемы для <span className="font-mono">{nodeTypeBadge(node)}</span>.
        </div>
      )}

      {bindings.length > 0 && (
        <div className="p-3.5">
          <div className="mb-2.5 text-[10.5px] font-semibold uppercase tracking-wider text-muted-foreground">
            Привязки
          </div>
          <div className={cn('flex flex-wrap gap-1.5')}>
            {bindings.map((b) => (
              <span
                key={b}
                className="rounded-full border border-border bg-muted px-2.5 py-1 font-mono text-[10.5px]"
              >
                {b}
              </span>
            ))}
          </div>
          <div className="mt-2 text-[10.5px] text-muted-foreground">
            read-only · задаются в схеме/коде проекта
          </div>
        </div>
      )}
    </div>
  );
}
