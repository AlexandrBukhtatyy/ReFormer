/**
 * Runtime-preview: реальный рендер формы через `@reformer/renderer-json` (спека §9).
 * `buildPreview` (registry ui-kit + модель + форма) → `<JsonRendererProvider>` +
 * `<JsonFormRenderer>`. Сборка в try/catch (битая схема → fallback), рендер — под error boundary.
 *
 * В режиме `edit` превью — второй холст: схема аннотируется класс-токенами ({@link annotateSchema}),
 * клик по форме выделяет узел, работают hover-подсветка и drag-drop (Ф4/Ф5). Интерактив самой формы
 * при этом гасится CSS (`pointer-events` в `index.css`), поэтому фокус не уходит в поля и хоткеи
 * холста работают. В режиме `test` — обычная живая форма без единого слушателя.
 *
 * @module reformer-builder/canvas/RuntimePreview
 */

import {
  createElement,
  memo,
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  type DragEvent,
  type MouseEvent,
} from 'react';
import {
  JsonFormRenderer,
  JsonRendererProvider,
  type ComponentRegistry,
  type JsonFormSchema,
} from '@reformer/renderer-json';
import type { FormModel, FormProxy } from '@reformer/core';
import {
  annotateSchema,
  buildPreview,
  encodeNodeToken,
  EMPTY_CLASS,
  kitProviderComponent,
  setActivePreviewModel,
  WizardFormProvider,
  type MockData,
  type PreviewBundle,
} from '../preview-runtime';
import { editorActions, type RuntimeMode } from '../store';
import { walkNodes, type JsonPath } from '../model';
import { lineOfPath } from '../io/error-path';
import { clearDrag, getDrag, setDrag } from '../dnd/drag-state';
import { commitDrop } from '../dnd/commit-drop';
import { PreviewErrorBoundary } from './ErrorBoundary';
import { PreviewHighlight } from './PreviewHighlight';
import { useHoverStyle } from './preview-highlight-style';
import { PreviewOverlay } from './PreviewOverlay';
import { paintDrop } from './preview-drop-paint';
import { elementForPath, nodeAtElement, NODE_SELECTOR } from './preview-hit-test';
import { resolveDropTarget } from './preview-dnd';
import { nodeLabel, nodeTypeBadge } from './node-display';

/** Класс-токен корневого узла: он один не перетаскивается (паритет со схематикой). */
const ROOT_TOKEN = encodeNodeToken(['root']);

/**
 * Дерево формы — отдельный `memo`-компонент: выделение, hover и drag-индикация меняют только
 * обвязку хоста, поэтому форма не перерисовывается и не теряет введённые значения.
 */
const FormTree = memo(function FormTree({
  schema,
  registry,
  model,
  form,
}: {
  schema: JsonFormSchema;
  registry: ComponentRegistry;
  model: FormModel<Record<string, unknown>>;
  form: unknown;
}) {
  // Кит может потребовать собственный контекст вокруг поддерева превью (тема styled-components,
  // i18n, конфиг портала) — он объявляет его в `descriptor.adapters.provider`. Киту на
  // Tailwind-токенах (`@reformer/ui-kit`) обёртка не нужна, и тогда дерево остаётся как было.
  // `createElement`, а не JSX с заглавной переменной: обёртка — это ГОТОВЫЙ компонент из namespace
  // кита (стабильная ссылка), а не создаваемый в рендере, и правило react-hooks/static-components
  // иначе справедливо ругается — оно не может отличить поиск по namespace от создания компонента.
  const provider = kitProviderComponent();
  const tree = (
    <JsonRendererProvider settings={{ registry }}>
      <WizardFormProvider form={form as FormProxy<Record<string, unknown>>}>
        <JsonFormRenderer schema={schema} model={model} validateSchema={false} />
      </WizardFormProvider>
    </JsonRendererProvider>
  );

  return (
    <PreviewErrorBoundary resetKey={schema}>
      {provider ? createElement(provider, null, tree) : tree}
    </PreviewErrorBoundary>
  );
});

export function RuntimePreview({
  schema,
  mock,
  mode,
  selectionPath,
  selectionPaths = [],
}: {
  schema: JsonFormSchema;
  mock?: MockData;
  mode: RuntimeMode;
  selectionPath: JsonPath | null;
  selectionPaths?: JsonPath[];
}) {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const overlayRef = useRef<HTMLDivElement | null>(null);
  // Уникальный id хоста → область действия генерируемых CSS-правил подсветки.
  const scopeId = useId().replace(/[^a-zA-Z0-9_-]/g, '');
  const scope = `[data-rb-scope="${scopeId}"]`;
  const { hoverRef, setHoverPath } = useHoverStyle(scope);

  // Схема для рендера: копия с класс-токенами узлов. Мемо обязательно — новая ссылка пересобрала бы
  // модель и форму, а вместе с ними потерялись бы введённые значения.
  const annotated = useMemo(() => annotateSchema(schema), [schema]);

  // Пересобираем registry+model+form при смене схемы ИЛИ мока (иммутабельность → новая ссылка).
  // Ввод в поля меняет только сигналы модели (identity schema/mock стабильна) — фокус не теряется.
  const built = useMemo(():
    | { bundle: PreviewBundle; error: null }
    | { bundle: null; error: string } => {
    try {
      return { bundle: buildPreview(annotated, mock), error: null };
    } catch (e) {
      return { bundle: null, error: e instanceof Error ? e.message : String(e) };
    }
  }, [annotated, mock]);

  // Публикуем модель живого превью: нижняя панель показывает по ней текущие значения формы.
  // Только чтение — обратной записи в `mock` быть не должно, иначе форма пересоздастся (см. выше).
  useEffect(() => {
    setActivePreviewModel(built.bundle?.model ?? null);
    return () => setActivePreviewModel(null);
  }, [built.bundle]);

  const editing = mode === 'edit';

  // Сброс hover при выходе из режима редактирования (иначе подсветка «залипнет»).
  useEffect(() => {
    if (!editing) setHoverPath(null);
  }, [editing, setHoverPath]);

  // Навигация стрелками выделяет узлы вне экрана — подтягиваем их в видимую область.
  useEffect(() => {
    if (!editing || !selectionPath || !hostRef.current) return;
    elementForPath(hostRef.current, selectionPath)?.scrollIntoView({
      block: 'nearest',
      inline: 'nearest',
    });
  }, [editing, selectionPath]);

  // DEV-сторож дрейфа ui-kit: компонент, не пробрасывающий `className` на свой корневой DOM,
  // теряет класс-токен — такой узел не выделить кликом. Сообщаем сразу, с путями и именами.
  useEffect(() => {
    if (!import.meta.env.DEV || !editing || !hostRef.current) return;
    const missingNow = (): string[] => {
      const host = hostRef.current;
      if (!host) return [];
      const out: string[] = [];
      walkNodes(schema, (node, path) => {
        if (!elementForPath(host, path)) out.push(`${path.join('.')} (${nodeLabel(node)})`);
      });
      return out;
    };
    // Двойной кадр: первый ловит промежуточный DOM сразу после правки схемы, второй — устоявшийся,
    // поэтому предупреждаем только о реально «немых» компонентах, а не о гонке рендера.
    let inner = 0;
    const outer = requestAnimationFrame(() => {
      if (missingNow().length === 0) return;
      inner = requestAnimationFrame(() => {
        const missing = missingNow();
        if (missing.length === 0) return;
        console.warn(
          '[reformer-builder] узлы без якоря в DOM (компонент не пробросил className) — ' +
            'их нельзя выделить кликом в Renderer:\n' +
            missing.join('\n')
        );
      });
    });
    return () => {
      cancelAnimationFrame(outer);
      cancelAnimationFrame(inner);
    };
  }, [schema, editing, built]);

  const onClick = useCallback(
    (e: MouseEvent<HTMLDivElement>) => {
      if (!editing) return;
      const hit = nodeAtElement(e.target as Element, schema);
      if (!hit) return;
      if (e.shiftKey) editorActions.extendSelectionTo(hit.path);
      else if (e.metaKey || e.ctrlKey) editorActions.toggleSelectionAt(hit.path);
      else editorActions.select(hit.path);
      hostRef.current?.focus({ preventScroll: true });
    },
    [editing, schema]
  );

  const onDoubleClick = useCallback(
    (e: MouseEvent<HTMLDivElement>) => {
      if (!editing) return;
      const hit = nodeAtElement(e.target as Element, schema);
      if (hit) editorActions.revealRawLine(lineOfPath(schema, [...hit.path]) ?? 1);
    },
    [editing, schema]
  );

  const onMouseMove = useCallback(
    (e: MouseEvent<HTMLDivElement>) => {
      if (!editing) return;
      setHoverPath(nodeAtElement(e.target as Element, schema)?.path ?? null);
    },
    [editing, schema, setHoverPath]
  );

  // ── drag&drop: приёмник (палитра + перемещение) и источник (узлы превью) ──

  const clearIndicator = useCallback(() => {
    paintDrop(overlayRef.current, hostRef.current, null);
  }, []);

  const onDragStart = useCallback(
    (e: DragEvent<HTMLDivElement>) => {
      if (!editing) return;
      const hit = nodeAtElement(e.target as Element, schema);
      // Корень не таскается — как и в схематике (`draggable={!isRoot}`).
      if (!hit || (hit.path.length === 1 && hit.path[0] === 'root')) {
        e.preventDefault();
        return;
      }
      setDrag({ kind: 'move', path: hit.path });
      e.dataTransfer.effectAllowed = 'move';
      setHoverPath(null);
    },
    [editing, schema, setHoverPath]
  );

  const onDragOver = useCallback(
    (e: DragEvent<HTMLDivElement>) => {
      const payload = editing ? getDrag() : null;
      // Чужой drag (файл, текст извне) — не перехватываем: пусть его обрабатывает сама форма.
      if (!payload) return;
      const target = resolveDropTarget(schema, e.target as Element, e.clientX, e.clientY);
      if (!target) return;
      e.preventDefault();
      e.dataTransfer.dropEffect = payload.kind === 'move' ? 'move' : 'copy';
      paintDrop(overlayRef.current, hostRef.current, target);
    },
    [editing, schema]
  );

  const onDrop = useCallback(
    (e: DragEvent<HTMLDivElement>) => {
      if (!editing || !getDrag()) return;
      const target = resolveDropTarget(schema, e.target as Element, e.clientX, e.clientY);
      clearIndicator();
      if (!target) return;
      e.preventDefault();
      e.stopPropagation();
      commitDrop(schema, target.path, target.zone);
    },
    [editing, schema, clearIndicator]
  );

  const onDragLeave = useCallback(
    (e: DragEvent<HTMLDivElement>) => {
      // Уход за пределы хоста (а не переход между его потомками).
      const to = e.relatedTarget;
      if (to instanceof Node && hostRef.current?.contains(to)) return;
      clearIndicator();
    },
    [clearIndicator]
  );

  // Перетаскивание существующих узлов: HTML5 требует атрибут `draggable` на элементе, а DOM формы
  // рисует рендерер — проставляем императивно (и переставляем, когда React пересоздал узлы).
  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    if (!editing) {
      host.querySelectorAll<HTMLElement>(NODE_SELECTOR).forEach((el) => (el.draggable = false));
      return;
    }
    let frame = 0;
    const apply = () => {
      frame = 0;
      host.querySelectorAll<HTMLElement>(NODE_SELECTOR).forEach((el) => {
        // Корневой узел не перетаскиваем; остальные — да.
        el.draggable = !el.classList.contains(ROOT_TOKEN);
        // Подпись для узлов, которые ничего не рисуют (контейнер без детей, компонент, чьи пропсы
        // ему не подошли): иначе они схлопываются в невидимую полоску — «компонент пропал».
        if (el.classList.contains(EMPTY_CLASS) && !el.dataset.rbLabel) {
          const hit = nodeAtElement(el, schema);
          if (hit) el.dataset.rbLabel = nodeTypeBadge(hit.node);
        }
      });
    };
    apply();
    const observer = new MutationObserver(() => {
      if (frame === 0) frame = requestAnimationFrame(apply);
    });
    observer.observe(host, { childList: true, subtree: true });
    return () => {
      observer.disconnect();
      if (frame !== 0) cancelAnimationFrame(frame);
    };
  }, [editing, built]);

  if (built.error !== null) {
    return (
      <div className="rounded-lg border border-destructive/40 bg-destructive/5 p-4 text-sm text-destructive">
        <div className="font-medium">Схема не сконвертировалась</div>
        <div className="mt-1 font-mono text-xs opacity-80">{built.error}</div>
      </div>
    );
  }

  return (
    <div
      ref={hostRef}
      data-rb-preview={mode}
      data-rb-scope={scopeId}
      tabIndex={-1}
      className="relative outline-none"
      onClick={onClick}
      onDoubleClick={onDoubleClick}
      onMouseMove={onMouseMove}
      onMouseLeave={() => setHoverPath(null)}
      onDragStart={onDragStart}
      onDragEnd={() => {
        clearDrag();
        clearIndicator();
      }}
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
    >
      {editing && (
        <>
          <PreviewHighlight
            scope={scope}
            selectionPath={selectionPath}
            selectionPaths={selectionPaths}
            hoverRef={hoverRef}
          />
          <PreviewOverlay overlayRef={overlayRef} />
        </>
      )}
      <FormTree
        schema={annotated}
        registry={built.bundle.registry}
        model={built.bundle.model}
        form={built.bundle.form}
      />
    </div>
  );
}
