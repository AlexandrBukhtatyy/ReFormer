/**
 * Инспектор свойств (спека §8): секции из props-схемы каталога, виджет по `x-doc.kind`
 * (boolean→Switch, enum→select, number/text→Input, readonly→серое поле), `x-runtimeProps` скрыты
 * (§5). Значения берутся из `componentProps` узла, правка идёт через `setComponentProp` с
 * коалесингом (одна запись истории на серию правок одного пропа). Имя свойства модели (`$model`)
 * поля/массива редактируется отдельным полем сверху; секция «Привязки» — read-only чипы `$dataSource`.
 *
 * @module reformer-builder/panels/Inspector
 */

import { useState } from 'react';
import { Input, Switch } from '@reformer/ui-kit';
import {
  isArrayNode,
  isFieldNode,
  parseOperator,
  type JsonFieldNode,
  type JsonNode,
} from '@reformer/renderer-json';
import { findByPath, type JsonPath } from '../model';
import { setComponentProp, setNodeKey, switchVariant } from '../model';
import { getCatalogEntry, inspectorGroups, type InspectorProp } from '../catalog';
import { variantGroupOf } from '../catalog/variants';
import { editorActions, useActiveTab, useSelectionPath, type TabState } from '../store';
import { nodeTypeBadge } from '../canvas/node-display';
import { effectiveMock, serializeSection } from '../canvas/mock-data';
import { ClassNameField } from './ClassNameField';
import { OptionsField } from './OptionsField';
import { IconField } from './IconField';
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

/** Привязки узла для секции «Привязки»: все `$dataSource` из props ($model — редактор выше). */
function bindingsOf(node: JsonNode): string[] {
  const out: string[] = [];
  const props = (node as { componentProps?: Record<string, unknown> }).componentProps ?? {};
  for (const v of Object.values(props)) {
    const p = parseOperator(v);
    if (p?.op === 'dataSource') out.push(`$dataSource(${p.arg})`);
  }
  return out;
}

/**
 * Редактор имени свойства модели (`$model(path)`) поля/массива. Коммит на blur/Enter (не по каждой
 * клавише — чтобы не плодить промежуточные пути). При переименовании переносит значение в мок-модели
 * (только верхнеуровневый путь и если пользователь уже правил мок; иначе синтез покроет новый путь).
 */
function ModelPathField({ node, path, tab }: { node: JsonNode; path: JsonPath; tab: TabState }) {
  const bindingKey = isArrayNode(node) ? 'array' : 'value';
  const current =
    parseOperator(isArrayNode(node) ? node.array : (node as JsonFieldNode).value)?.arg ?? '';
  const [draft, setDraft] = useState(current);

  // Синхронизация с внешним `current` (смена выделения) — во время рендера (не в эффекте).
  const [synced, setSynced] = useState(current);
  if (synced !== current) {
    setSynced(current);
    setDraft(current);
  }

  const commit = () => {
    const next = draft.trim();
    if (!next || next === current) {
      setDraft(current);
      return;
    }
    if (tab.mock?.model != null && !current.includes('.') && !next.includes('.')) {
      const mock = effectiveMock(tab.schema, tab.mock);
      if (current in mock.model) {
        const model: Record<string, unknown> = { ...mock.model };
        model[next] = model[current];
        delete model[current];
        editorActions.setMockText(tab.id, 'model', serializeSection({ ...mock, model }, 'model'));
      }
    }
    editorActions.apply((s) => setNodeKey(s, path, bindingKey, `$model(${next})`));
  };

  return (
    <div className="border-b border-border p-3.5">
      <div className="mb-2.5 text-[10.5px] font-semibold uppercase tracking-wider text-muted-foreground">
        Свойство модели
      </div>
      <div className="flex min-h-6 items-center gap-2.5">
        <span className="w-24 flex-none truncate text-xs">Путь ($model)</span>
        <Input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => {
            if (e.key === 'Enter') e.currentTarget.blur();
            if (e.key === 'Escape') {
              setDraft(current);
              e.currentTarget.blur();
            }
          }}
          placeholder="имя_свойства"
          className="h-[26px] min-w-0 flex-1 bg-background font-mono text-xs"
        />
      </div>
    </div>
  );
}

/**
 * Селектор варианта компонента — первая строка секции Control. Показывается только если узел входит
 * в группу вариантов (>1 члена). Смена варианта переключает `$component(...)` и прунит несовместимые
 * `componentProps` (общие ключи сохраняются); инспектор перечитает props-схему нового варианта и
 * покажет его набор полей.
 */
function VariantRow({ node, path }: { node: JsonNode; path: JsonPath }) {
  const name = parseOperator((node as { component?: unknown }).component)?.arg;
  const grp = name ? variantGroupOf(name) : null;
  if (!grp || !name) return null;

  const switchTo = (targetName: string) => {
    const target = grp.members.find((m) => m.name === targetName);
    if (!target || target.name === name) return;
    const keys = new Set(Object.keys(target.propsSchema.properties ?? {}));
    editorActions.apply((s) => switchVariant(s, path, target.name, keys));
  };

  return (
    <div className="flex min-h-6 items-center gap-2.5">
      <span className="w-24 flex-none truncate text-xs">Вариант</span>
      <select
        value={name}
        onChange={(e) => switchTo(e.target.value)}
        className="h-[26px] min-w-0 flex-1 rounded-md border border-input bg-background px-2 text-xs outline-none focus:border-ring"
      >
        {grp.members.map((m) => (
          <option key={m.name} value={m.name}>
            {m.variant ?? m.name}
          </option>
        ))}
      </select>
    </div>
  );
}

function toNumberValue(raw: string): number | string | undefined {
  if (raw === '') return undefined;
  return /^-?\d*\.?\d+$/.test(raw) ? Number(raw) : raw;
}

function PropRow({ node, path, prop }: { node: JsonNode; path: JsonPath; prop: InspectorProp }) {
  if (prop.widget === 'className') return <ClassNameField node={node} path={path} prop={prop} />;
  if (prop.widget === 'dataSource') return <OptionsField node={node} path={path} prop={prop} />;
  if (prop.widget === 'icon') return <IconField node={node} path={path} prop={prop} />;

  const props = (node as { componentProps?: Record<string, unknown> }).componentProps ?? {};
  const value = props[prop.key];
  const set = (v: unknown) =>
    editorActions.apply((s) => setComponentProp(s, path, prop.key, v), {
      coalesceKey: `${prop.key}@${path.join('.')}`,
    });

  return (
    <div className="flex min-h-6 items-center gap-2.5">
      <span className="w-24 flex-none truncate text-xs" title={prop.description}>
        {prop.label}
      </span>
      {prop.widget === 'boolean' && (
        <Switch className="ml-auto" checked={value === true} onCheckedChange={(v) => set(v)} />
      )}
      {prop.widget === 'text' && (
        <Input
          value={value == null ? '' : String(value)}
          onChange={(e) => set(e.target.value)}
          className="h-[26px] min-w-0 flex-1 bg-background text-xs"
        />
      )}
      {prop.widget === 'number' && (
        <Input
          type="number"
          value={value == null ? '' : String(value)}
          onChange={(e) => set(toNumberValue(e.target.value))}
          className="h-[26px] min-w-0 flex-1 bg-background text-xs"
        />
      )}
      {prop.widget === 'enum' && (
        <select
          value={value == null ? '' : String(value)}
          onChange={(e) => set(e.target.value)}
          className="h-[26px] min-w-0 flex-1 rounded-md border border-input bg-background px-2 text-xs outline-none focus:border-ring"
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
        <span className="min-w-0 flex-1 truncate rounded-md bg-muted px-2 py-1 font-mono text-[11px] text-muted-foreground">
          {value == null ? '—' : String(value)}
        </span>
      )}
    </div>
  );
}

/**
 * Бейдж типа выбранного узла — для шапки сайдбара свойств (рядом со словом «Свойства»).
 * Возвращает `null`, когда ничего не выбрано.
 */
export function SelectedTypeBadge() {
  const tab = useActiveTab();
  const selPath = useSelectionPath();
  const node = tab && selPath ? findByPath(tab.schema, selPath) : undefined;
  if (!node) return null;
  return (
    <span className="flex-none rounded-full bg-foreground px-2 py-0.5 font-mono text-[9.5px] font-semibold text-background">
      {nodeTypeBadge(node)}
    </span>
  );
}

export function Inspector() {
  const tab = useActiveTab();
  const selPath = useSelectionPath();
  const node = tab && selPath ? findByPath(tab.schema, selPath) : undefined;

  if (tab?.kind === 'code') {
    return (
      <div
        id="rb-properties"
        className="grid flex-1 place-items-center p-6 text-center text-xs text-muted-foreground"
      >
        Свойства недоступны для файла кода — правьте текст в редакторе (Monaco).
      </div>
    );
  }

  if (!node || !selPath) {
    return (
      <div
        id="rb-properties"
        className="grid flex-1 place-items-center p-6 text-center text-xs text-muted-foreground"
      >
        Выберите узел в дереве или preview, чтобы редактировать его свойства
      </div>
    );
  }

  const entry = catalogEntryFor(node);
  const groups = entry ? inspectorGroups(entry.propsSchema) : [];
  const bindings = bindingsOf(node);

  return (
    <div id="rb-properties" className="flex-1 overflow-auto">
      {tab && (isFieldNode(node) || isArrayNode(node)) && (
        <ModelPathField node={node} path={selPath} tab={tab} />
      )}
      {groups.map((group) => (
        <div key={group.group} className="border-b border-border p-3.5">
          <div className="mb-2.5 text-[10.5px] font-semibold uppercase tracking-wider text-muted-foreground">
            {group.group}
          </div>
          <div className="flex flex-col gap-2.5">
            {group.group === 'Control' && <VariantRow node={node} path={selPath} />}
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
        </div>
      )}
    </div>
  );
}
