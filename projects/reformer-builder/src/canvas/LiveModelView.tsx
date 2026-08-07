/**
 * Живые значения модели формы — read-only вид вкладки «Модель».
 *
 * Отличие от {@link MockDataEditor}: тот правит ЗАСЕВ (`tab.mock.model` — чем форма
 * инициализируется), а этот показывает, что в модели СЕЙЧАС, после ввода в поля превью.
 *
 * Реактивность — через `effect` из `@preact/signals-core`: колбэк читает `.value` каждого листа,
 * тем самым подписываясь ровно на нужные сигналы. React-рендер троттлится (кадр), иначе ввод в
 * поле перерисовывал бы панель на каждый символ.
 *
 * Набор ключей берём из мок-объекта, а не обходом модели: модель — прокси сигналов, её ключи
 * перечислять ненадёжно, а мок ровно ту же форму и задаёт.
 *
 * @module reformer-builder/canvas/LiveModelView
 */

import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import { effect } from '@preact/signals-core';
import type { TabState } from '../store';
import { getActivePreviewModel, subscribeActivePreviewModel, synthMock } from '../preview-runtime';

/* eslint-disable @typescript-eslint/no-explicit-any */

/** Похоже ли значение на сигнал (лист модели). */
function isSignal(v: unknown): v is { value: unknown } {
  return typeof v === 'object' && v !== null && 'value' in (v as Record<string, unknown>);
}

/**
 * Снимок модели по форме `shape`. Чтение `.value` внутри `effect` = подписка на этот сигнал.
 * Узлы, которых в модели нет, отдаём как есть из мока — панель не должна врать пропусками.
 */
function snapshot(model: unknown, shape: unknown, path: string[]): unknown {
  const node = path.reduce<any>((acc, seg) => (acc == null ? acc : acc[seg]), model);
  if (isSignal(node)) return node.value;
  if (shape !== null && typeof shape === 'object' && !Array.isArray(shape)) {
    return Object.fromEntries(
      Object.keys(shape as Record<string, unknown>).map((k) => [
        k,
        snapshot(model, (shape as Record<string, unknown>)[k], [...path, k]),
      ])
    );
  }
  return node ?? shape;
}

/** Форма модели: правки засева, иначе синтез из схемы. */
function modelShape(raw: string | undefined, schema: TabState['schema']): Record<string, unknown> {
  if (raw) {
    try {
      return JSON.parse(raw) as Record<string, unknown>;
    } catch {
      // Невалидный черновик засева — форму берём из синтеза, чтобы вид не пропадал во время правки.
    }
  }
  return synthMock(schema).model as Record<string, unknown>;
}

export function LiveModelView({ tab }: { tab: TabState }) {
  const model = useSyncExternalStore(subscribeActivePreviewModel, getActivePreviewModel);
  const seed = tab.mock?.model;
  const schema = tab.schema;
  const shape = useMemo(() => modelShape(seed, schema), [seed, schema]);
  const [text, setText] = useState('');
  const frameRef = useRef(0);

  useEffect(() => {
    // Без модели подписываться не на что; заглушку рисует сам компонент ниже.
    if (!model) return;
    // effect читает значения → подписывается; перерисовку откладываем до кадра.
    const stop = effect(() => {
      const next = JSON.stringify(snapshot(model, shape, []), null, 2);
      cancelAnimationFrame(frameRef.current);
      frameRef.current = requestAnimationFrame(() => setText(next));
    });
    return () => {
      cancelAnimationFrame(frameRef.current);
      stop();
    };
  }, [model, shape]);

  if (!model) {
    return (
      <div className="grid h-full place-items-center px-4 text-center text-[12px] text-muted-foreground">
        Живые значения появятся, когда превью запущено: переключите режим на «Renderer».
      </div>
    );
  }

  return (
    <pre className="h-full overflow-auto px-3 py-2 font-mono text-[12px] leading-[1.5] text-foreground">
      {text}
    </pre>
  );
}
