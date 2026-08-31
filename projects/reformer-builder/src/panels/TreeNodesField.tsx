/**
 * Редактор проп-дерева (`nodes` у `Tree`, `ComboboxTree`, `ComboboxTreeMulti`) — тот же выбор
 * источника, что и у плоских опций ({@link DataSourceBinding}), но инлайн-значение правится как
 * JSON, а не строками таблицы.
 *
 * Почему не таблица: у иерархии нет «строк». Узел держит собственных детей, глубина не ограничена,
 * и редактор с кнопками «вложить/поднять» — это отдельный компонент размером с саму панель. JSON
 * же показывает форму узла целиком (`id`, `label`, `children`) и переживает копипаст из настоящего
 * источника — а именно так дерево в форму обычно и попадает.
 *
 * Своё поле, а не редактор опций: тот пишет `{ value, label }`, и наведи его на `nodes` — у узлов
 * пропадёт `id`, по которому дерево их адресует, то есть значение поля перестанет с чем-либо
 * совпадать. Молча: JSON останется валидным, дерево просто нарисует пустоту.
 *
 * @module reformer-builder/panels/TreeNodesField
 */

import { useState } from 'react';
import { type JsonNode } from '@reformer/renderer-json';
import type { JsonPath } from '../model';
import type { InspectorProp } from '../catalog';
import { mockTreeNodes } from '../preview-runtime';
import { cn } from '../lib/cn';
import { DataSourceBinding } from './DataSourceBinding';

export function TreeNodesField({
  node,
  path,
  prop,
}: {
  node: JsonNode;
  path: JsonPath;
  prop: InspectorProp;
}) {
  return (
    <DataSourceBinding
      node={node}
      path={path}
      prop={prop}
      inlineLabel="Инлайн-дерево"
      seed={mockTreeNodes}
      renderInline={(value, onChange) => <InlineTree value={value} onChange={onChange} />}
    />
  );
}

/**
 * Разбор и проверка инлайн-дерева. Возвращает разобранное значение либо человеческую причину
 * отказа: «невалидный JSON» пользователю ничего не говорит, когда ошибка в том, что у узла нет
 * `id` — а это самая частая ошибка при копипасте из чужого источника опций.
 */
function parseTree(text: string): { nodes: unknown[] } | { error: string } {
  const trimmed = text.trim();
  if (!trimmed) return { nodes: [] };
  let parsed: unknown;
  try {
    parsed = JSON.parse(trimmed);
  } catch (e) {
    return { error: e instanceof Error ? e.message : 'не разбирается как JSON' };
  }
  if (!Array.isArray(parsed)) return { error: 'ожидается массив узлов верхнего уровня' };
  const problem = firstShapeProblem(parsed, '');
  return problem ? { error: problem } : { nodes: parsed };
}

/** Первая проблема формы узла с адресом места (`[0].children[1]`); `null` — всё в порядке. */
function firstShapeProblem(nodes: unknown[], at: string): string | null {
  for (let i = 0; i < nodes.length; i++) {
    const where = `${at}[${i}]`;
    const raw = nodes[i];
    if (typeof raw !== 'object' || raw === null || Array.isArray(raw))
      return `${where}: узел должен быть объектом`;
    const o = raw as Record<string, unknown>;
    if (typeof o.id !== 'string' || !o.id) return `${where}: нужен непустой строковый "id"`;
    if (typeof o.label !== 'string') return `${where}: нужен строковый "label"`;
    if (o.children !== undefined) {
      if (!Array.isArray(o.children)) return `${where}.children: ожидается массив`;
      const nested = firstShapeProblem(o.children, `${where}.children`);
      if (nested) return nested;
    }
  }
  return null;
}

/**
 * JSON-редактор дерева. Пока правка не разбирается, значение в схему НЕ уходит: иначе каждый
 * промежуточный символ делал бы схему невалидной, а гейт экспорта — красным.
 */
function InlineTree({ value, onChange }: { value: unknown; onChange: (next: unknown) => void }) {
  // `null` — правки нет, показываем значение схемы; строка — текущий черновик (в т.ч. неразбираемый).
  const [draft, setDraft] = useState<string | null>(null);
  const text = draft ?? format(value);
  const parsed = draft === null ? null : parseTree(draft);
  const error = parsed && 'error' in parsed ? parsed.error : null;

  const edit = (next: string) => {
    setDraft(next);
    const result = parseTree(next);
    if ('nodes' in result) onChange(result.nodes);
  };

  return (
    <div className="flex flex-col gap-1.5">
      <textarea
        value={text}
        spellCheck={false}
        rows={8}
        onChange={(e) => edit(e.target.value)}
        // Черновик сбрасывается по уходу фокуса: значение в схеме уже лежит, а канонический
        // отступ вернуть можно только перечитав его.
        onBlur={() => !error && setDraft(null)}
        placeholder='[{ "id": "src", "label": "src", "children": [{ "id": "src/app.ts", "label": "app.ts" }] }]'
        className={cn(
          'min-w-0 flex-1 resize-y rounded-md border bg-background px-2 py-1.5 font-mono text-[11px] leading-relaxed outline-none',
          error ? 'border-destructive' : 'border-input focus:border-ring'
        )}
      />
      {error ? (
        <span className="text-[11px] text-destructive">{error}</span>
      ) : (
        <button
          onClick={() => {
            setDraft(null);
            onChange(mockTreeNodes('nodes'));
          }}
          className="self-start text-[11px] text-muted-foreground hover:text-foreground"
        >
          Заполнить примером
        </button>
      )}
    </div>
  );
}

/** Значение схемы в текст редактора: массив — с отступом, всё прочее (в т.ч. пропуск) — пусто. */
function format(value: unknown): string {
  return Array.isArray(value) && value.length ? JSON.stringify(value, null, 2) : '';
}
