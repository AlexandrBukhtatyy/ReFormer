/**
 * Вкладка «Форма» нижней панели — что происходит с живой формой прямо сейчас.
 *
 * Четыре среза: **сводка** (валидна ли форма, сколько ошибок, стратегия, ручной прогон),
 * **поля** (значение и состояние каждого листа модели), **лог** (что менялось и какие ошибки
 * появлялись) и **сборка** (какие `.ts` подхвачены, а какие упали и почему). Последний срез
 * обязателен: без него «форма не отрабатывает» снова остаётся без объяснения.
 *
 * Реактивность — как в {@link module:reformer-builder/canvas/LiveModelView}: `effect` из
 * `@preact/signals-core` читает `.value` нужных сигналов и тем самым подписывается ровно на них,
 * а React-рендер троттлится кадром, иначе ввод в поле перерисовывал бы панель на каждый символ.
 *
 * @module reformer-builder/canvas/FormStateView
 */

import { useEffect, useMemo, useRef, useState, useSyncExternalStore, type ReactNode } from 'react';
import { effect } from '@preact/signals-core';
import { getLiveState, subscribeLiveState } from '../preview-runtime/live-state';
import { fieldSnapshot, modelLeafPaths, type FieldSnapshot } from './form-state-read';
import { useFormEventLog } from './form-event-log';
import { cn } from '../lib/cn';

type Section = 'fields' | 'log' | 'build';

export function FormStateView() {
  const live = useSyncExternalStore(subscribeLiveState, getLiveState);
  const [section, setSection] = useState<Section>('fields');

  if (live.status === 'off') {
    return (
      <Hint>
        Схемы формы не исполняются. Включите «Схемы формы» в панели Renderer — валидация, поведение
        и реестр из каталога заработают на живой форме.
      </Hint>
    );
  }
  if (live.status === 'unavailable') {
    return (
      <Hint>
        Каталог формы недоступен: исполнять нечего. Откройте форму из проекта — рядом с form.json
        должны лежать model.ts / validation.ts / form-behavior.ts.
      </Hint>
    );
  }
  if (live.status === 'loading') return <Hint>Собираем схемы формы…</Hint>;

  return (
    <div className="flex h-full min-h-0 flex-col">
      <Summary />
      <div className="flex flex-none gap-0.5 border-b border-border px-2 py-1 text-[11.5px]">
        <SectionTab active={section} value="fields" onSelect={setSection}>
          Поля
        </SectionTab>
        <SectionTab active={section} value="log" onSelect={setSection}>
          Лог
        </SectionTab>
        <SectionTab active={section} value="build" onSelect={setSection}>
          Сборка{live.errors.length > 0 ? ` · ${live.errors.length}` : ''}
        </SectionTab>
      </div>
      <div className="min-h-0 flex-1 overflow-auto">
        {section === 'fields' && <Fields />}
        {section === 'log' && <Log />}
        {section === 'build' && <Build />}
      </div>
    </div>
  );
}

function Hint({ children }: { children: ReactNode }) {
  return (
    <div className="grid h-full place-items-center px-6 text-center text-[12px] text-muted-foreground">
      <p className="max-w-md">{children}</p>
    </div>
  );
}

function SectionTab({
  active,
  value,
  onSelect,
  children,
}: {
  active: Section;
  value: Section;
  onSelect: (s: Section) => void;
  children: ReactNode;
}) {
  return (
    <button
      onClick={() => onSelect(value)}
      className={cn(
        'rounded px-2 py-0.5',
        active === value
          ? 'bg-muted font-medium text-foreground'
          : 'text-muted-foreground hover:bg-muted'
      )}
    >
      {children}
    </button>
  );
}

/** Шапка: валидность формы, число ошибок, активная стратегия, ручной прогон. */
function Summary() {
  const live = useSyncExternalStore(subscribeLiveState, getLiveState);
  const bundle = live.bundle;
  const [state, setState] = useState({ valid: true, errors: 0, validating: false });
  const frameRef = useRef(0);

  useEffect(() => {
    if (!bundle) return;
    const stop = effect(() => {
      const next = {
        valid: bundle.form.valid.value,
        errors: bundle.form.errors.value.length,
        validating: bundle.validation?.validating.value ?? false,
      };
      cancelAnimationFrame(frameRef.current);
      frameRef.current = requestAnimationFrame(() => setState(next));
    });
    return () => {
      cancelAnimationFrame(frameRef.current);
      stop();
    };
  }, [bundle]);

  if (!bundle) return null;

  return (
    <div className="flex flex-none flex-wrap items-center gap-2 border-b border-border px-2 py-1.5 text-[11.5px]">
      <span
        className={cn(
          'rounded px-1.5 py-0.5 font-medium',
          state.valid ? 'bg-emerald-500/10 text-emerald-700' : 'bg-destructive/10 text-destructive'
        )}
      >
        {state.valid ? 'форма валидна' : `ошибок: ${state.errors}`}
      </span>
      <span className="text-muted-foreground">
        стратегия:{' '}
        {bundle.strategy ?? (bundle.validateAll ? 'только ручной прогон' : 'валидации нет')}
      </span>
      {state.validating && <span className="text-muted-foreground">идёт проверка…</span>}
      <span className="flex-1" />
      {bundle.validateAll && (
        <button
          onClick={() => void bundle.validateAll?.()}
          className="rounded border border-border px-2 py-0.5 hover:bg-muted"
        >
          Прогнать валидацию
        </button>
      )}
    </div>
  );
}

/** Дерево листьев модели: значение и состояние каждого поля. */
function Fields() {
  const live = useSyncExternalStore(subscribeLiveState, getLiveState);
  const bundle = live.bundle;
  const paths = useMemo(() => (bundle ? modelLeafPaths(bundle.model.get()) : []), [bundle]);
  const [rows, setRows] = useState<FieldSnapshot[]>([]);
  const frameRef = useRef(0);

  useEffect(() => {
    if (!bundle) return;
    const stop = effect(() => {
      const next = paths.map((path) => fieldSnapshot(bundle.model, path));
      cancelAnimationFrame(frameRef.current);
      frameRef.current = requestAnimationFrame(() => setRows(next));
    });
    return () => {
      cancelAnimationFrame(frameRef.current);
      stop();
    };
  }, [bundle, paths]);

  if (!bundle) return null;
  if (rows.length === 0) {
    return <Hint>В модели нет полей — проверьте `$model`-пути схемы и model.ts.</Hint>;
  }

  return (
    <table className="w-full border-collapse text-[11.5px]">
      <thead className="sticky top-0 bg-sidebar text-muted-foreground">
        <tr>
          <th className="px-2 py-1 text-left font-normal">Поле</th>
          <th className="px-2 py-1 text-left font-normal">Значение</th>
          <th className="px-2 py-1 text-left font-normal">Состояние</th>
          <th className="px-2 py-1 text-left font-normal">Ошибки</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((row) => (
          <tr key={row.path} className="border-t border-border/60 align-top">
            <td className="px-2 py-1 font-mono text-foreground">{row.path}</td>
            <td className="max-w-[16rem] truncate px-2 py-1 font-mono text-muted-foreground">
              {row.display}
            </td>
            <td className="px-2 py-1">
              <div className="flex flex-wrap gap-1">
                {row.flags.map((flag) => (
                  <span key={flag} className="rounded bg-muted px-1 text-[10.5px]">
                    {flag}
                  </span>
                ))}
              </div>
            </td>
            <td className="px-2 py-1 text-destructive">
              {row.errors.map((e) => (
                <div key={`${e.code}:${e.message}`}>
                  {e.message} <span className="opacity-60">({e.code})</span>
                </div>
              ))}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

/** Лента событий: изменения значений и появление/снятие ошибок. */
function Log() {
  const { entries, clear } = useFormEventLog();

  if (entries.length === 0) {
    return <Hint>Пока тихо. Введите что-нибудь в форму — здесь появятся изменения и ошибки.</Hint>;
  }

  return (
    <div className="text-[11.5px]">
      <div className="sticky top-0 flex items-center gap-2 bg-sidebar px-2 py-1 text-muted-foreground">
        <span className="flex-1">{entries.length} событий</span>
        <button onClick={clear} className="rounded px-1.5 hover:bg-muted hover:text-foreground">
          Очистить
        </button>
      </div>
      <ul>
        {entries.map((e) => (
          <li key={e.id} className="flex gap-2 border-t border-border/60 px-2 py-1">
            <span className="w-14 flex-none font-mono text-muted-foreground">{e.at}</span>
            <span
              className={cn(
                'w-24 flex-none',
                e.kind === 'error' && 'text-destructive',
                e.kind === 'resolved' && 'text-emerald-700',
                e.kind === 'derived' && 'text-sky-700',
                e.kind === 'input' && 'text-muted-foreground'
              )}
            >
              {LOG_KIND[e.kind]}
            </span>
            <span className="font-mono text-foreground">{e.path}</span>
            <span className="text-muted-foreground">{e.detail}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

const LOG_KIND = {
  input: 'ввод',
  derived: 'пересчёт',
  error: 'ошибка',
  resolved: 'исправлено',
  validation: 'валидация',
} as const;

/** Статус сборки: какие файлы каталога исполнены, какие упали. */
function Build() {
  const live = useSyncExternalStore(subscribeLiveState, getLiveState);
  const failed = new Set(live.errors.map((e) => e.file));

  return (
    <div className="space-y-2 px-2 py-1.5 text-[11.5px]">
      <div>
        <div className="text-muted-foreground">Файлы каталога</div>
        <div className="mt-1 flex flex-wrap gap-1">
          {live.files.length === 0 && <span className="text-muted-foreground">не найдены</span>}
          {live.files.map((file) => (
            <span
              key={file}
              title={
                live.fromEditor.includes(file)
                  ? 'Взят из открытой вкладки (несохранённые правки)'
                  : 'Прочитан с диска'
              }
              className={cn(
                'rounded px-1.5 py-0.5 font-mono',
                failed.has(file)
                  ? 'bg-destructive/10 text-destructive'
                  : 'bg-muted text-muted-foreground'
              )}
            >
              {file}
              {live.fromEditor.includes(file) ? ' •' : ''}
            </span>
          ))}
        </div>
      </div>

      {live.errors.length > 0 && (
        <div>
          <div className="text-muted-foreground">Ошибки</div>
          <ul className="mt-1 space-y-1">
            {live.errors.map((e, i) => (
              <li key={`${e.file}:${i}`} className="rounded border border-destructive/40 p-1.5">
                <div className="font-mono text-destructive">
                  {e.file || 'сборка'} · {e.phase === 'transpile' ? 'компиляция' : 'исполнение'}
                </div>
                <div className="mt-0.5 whitespace-pre-wrap text-foreground">{e.message}</div>
              </li>
            ))}
          </ul>
        </div>
      )}

      {live.applied.length > 0 && (
        <div>
          <div className="text-muted-foreground">Подключено</div>
          <div className="mt-1 flex flex-wrap gap-1">
            {live.applied.map((a) => (
              <span key={a} className="rounded bg-emerald-500/10 px-1.5 py-0.5 text-emerald-700">
                {a}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
