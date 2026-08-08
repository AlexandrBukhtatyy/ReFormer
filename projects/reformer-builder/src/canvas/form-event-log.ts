/**
 * Лента событий живой формы: что менялось и какие ошибки появлялись.
 *
 * Диагностика, а не аудит: core не отдаёт хука «сработало правило `computeFrom`», поэтому лог
 * показывает СЛЕДСТВИЯ — какое поле изменилось, какая ошибка возникла или снялась, чем кончился
 * прогон валидации. Для формы это ровно то, что нужно увидеть: «ввёл имя → пересчиталось
 * приветствие → ушла ошибка required».
 *
 * Ввод отличается от пересчёта по фокусу: у сфокусированного поля берётся класс-токен `rbnode-*`,
 * по нему — узел схемы и его `$model`-путь. Совпал с изменившимся путём — это ввод, остальные
 * изменения того же тика — производные. Не определился — помечаем как пересчёт (консервативно).
 *
 * @module reformer-builder/canvas/form-event-log
 */

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { effect } from '@preact/signals-core';
import { getNodeForSignal, type FormModel } from '@reformer/core';
import { isFieldNode, parseOperator, type JsonFormSchema } from '@reformer/renderer-json';
import { editorStore } from '../store';
import { activeTab } from '../store';
import { getLiveState, subscribeLiveState } from '../preview-runtime/live-state';
import { modelLeafPaths } from './form-state-read';
import { nodeAtElement } from './preview-hit-test';

/* eslint-disable @typescript-eslint/no-explicit-any */

/** Тип записи в ленте. */
export type LogKind = 'input' | 'derived' | 'error' | 'resolved' | 'validation';

/** Одна запись ленты. */
export interface LogEntry {
  id: number;
  /** Время `чч:мм:сс`. */
  at: string;
  kind: LogKind;
  /** Путь поля либо `''` для событий уровня формы. */
  path: string;
  detail: string;
}

/** Сколько записей держим — лента диагностическая, история целиком не нужна. */
const MAX_ENTRIES = 200;

/** Снимок для сравнения между тиками. */
interface Snapshot {
  values: Map<string, unknown>;
  errors: Map<string, string>;
}

const clock = (): string => new Date().toTimeString().slice(0, 8);

/** Значение листа по дот-пути (чтение `.value` = подписка, вызывать внутри `effect`). */
function readValue(model: FormModel<Record<string, unknown>>, path: string): unknown {
  const signal = path.split('.').reduce<any>((acc, seg) => (acc == null ? acc : acc[seg]), model);
  return signal && typeof signal === 'object' && 'value' in signal ? signal.value : undefined;
}

/** Ошибки листа, свёрнутые в строку — сравнивать наборы проще, чем массивы объектов. */
function readErrors(model: FormModel<Record<string, unknown>>, path: string): string {
  const signal = path.split('.').reduce<any>((acc, seg) => (acc == null ? acc : acc[seg]), model);
  const node =
    signal && typeof signal === 'object' && 'value' in signal
      ? getNodeForSignal(signal)
      : undefined;
  if (!node) return '';
  return node.errors.value
    .map(
      (e) =>
        `${String((e as { code?: unknown }).code ?? '')}: ${String((e as { message?: unknown }).message ?? '')}`
    )
    .join(' | ');
}

/** `$model`-путь поля, в котором сейчас фокус, либо `null`. */
function focusedModelPath(schema: JsonFormSchema | undefined): string | null {
  if (!schema) return null;
  const el = document.activeElement;
  if (!(el instanceof Element) || !el.closest('[data-rb-preview]')) return null;
  const hit = nodeAtElement(el, schema);
  if (!hit || !isFieldNode(hit.node)) return null;
  const parsed = parseOperator(hit.node.value);
  return parsed?.op === 'model' ? parsed.arg : null;
}

/** Лента событий текущей живой формы. */
export function useFormEventLog(): { entries: LogEntry[]; clear: () => void } {
  const live = useSyncExternalStore(subscribeLiveState, getLiveState);
  const bundle = live.bundle;
  const [entries, setEntries] = useState<LogEntry[]>([]);
  const idRef = useRef(0);

  const push = useCallback((items: Omit<LogEntry, 'id' | 'at'>[]) => {
    if (items.length === 0) return;
    const at = clock();
    setEntries((prev) => {
      const next = [...items.map((i) => ({ ...i, id: ++idRef.current, at })), ...prev];
      return next.length > MAX_ENTRIES ? next.slice(0, MAX_ENTRIES) : next;
    });
  }, []);

  // Значения и ошибки полей.
  useEffect(() => {
    if (!bundle) return;
    setEntries([]);
    const paths = modelLeafPaths(bundle.model.get());
    const prev: Snapshot = { values: new Map(), errors: new Map() };
    let primed = false;

    const stop = effect(() => {
      const values = new Map<string, unknown>();
      const errors = new Map<string, string>();
      for (const path of paths) {
        values.set(path, readValue(bundle.model, path));
        errors.set(path, readErrors(bundle.model, path));
      }

      // Первый прогон только фиксирует базу: стартовые значения событиями не считаем.
      if (!primed) {
        primed = true;
        prev.values = values;
        prev.errors = errors;
        return;
      }

      const focused = focusedModelPath(activeTab(editorStore.getState())?.schema);
      const items: Omit<LogEntry, 'id' | 'at'>[] = [];

      for (const path of paths) {
        const before = prev.values.get(path);
        const after = values.get(path);
        if (!Object.is(before, after)) {
          items.push({
            kind: path === focused ? 'input' : 'derived',
            path,
            detail: `${format(before)} → ${format(after)}`,
          });
        }
        const errBefore = prev.errors.get(path) ?? '';
        const errAfter = errors.get(path) ?? '';
        if (errBefore !== errAfter) {
          items.push(
            errAfter
              ? { kind: 'error', path, detail: errAfter }
              : { kind: 'resolved', path, detail: errBefore }
          );
        }
      }

      prev.values = values;
      prev.errors = errors;
      push(items);
    });

    return stop;
  }, [bundle, push]);

  // Прогоны валидации: пишем итог, когда прогон закончился.
  useEffect(() => {
    const validation = bundle?.validation;
    if (!bundle || !validation) return;
    let wasValidating = false;
    const stop = effect(() => {
      const now = validation.validating.value;
      const errors = bundle.form.errors.value.length;
      if (wasValidating && !now) {
        push([
          {
            kind: 'validation',
            path: '',
            detail: errors > 0 ? `завершена, ошибок: ${errors}` : 'завершена, форма валидна',
          },
        ]);
      }
      wasValidating = now;
    });
    return stop;
  }, [bundle, push]);

  const clear = useCallback(() => setEntries([]), []);
  return { entries, clear };
}

/** Значение в коротком виде для строки лога. */
function format(v: unknown): string {
  if (v === '' || v === null || v === undefined) return '∅';
  if (typeof v === 'string') return v.length > 24 ? `"${v.slice(0, 21)}…"` : `"${v}"`;
  if (Array.isArray(v)) return `[${v.length}]`;
  if (typeof v === 'object') return '{…}';
  return String(v);
}
