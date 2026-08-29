/**
 * Тело markdown-вкладки: исходник, предпросмотр или обе половины рядом.
 *
 * Три режима — не три редактора: вкладка одна, документ один, меняется только показ.
 * Разделение на вкладки означало бы, что «показать текст» открывает второй документ поверх
 * первого, а закрытие любой половины закрывает файл.
 *
 * Редактор кода приходит портом ({@link MarkdownHost.TextEditor}) — плагины не импортируют
 * друг друга. Его отсутствие — законная сборка: режима «рядом» тогда нет вовсе, а «код»
 * показывает текст без подсветки и без правки.
 *
 * @module plugins/editor-markdown/ui/MarkdownEditor
 */

import {
  lazy,
  Suspense,
  useCallback,
  useRef,
  useSyncExternalStore,
  type ReactElement,
} from 'react';
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from '@reformer/ui-kit/resizable';
import { Empty, EmptyHeader, EmptyTitle } from '@reformer/ui-kit/empty';
import type { ResourceId } from '@/sdk';
import type { MarkdownHost } from '../host';
import type { MarkdownViewStore } from '../sessions';
/**
 * Рендер грузится ЛЕНИВО, и это не оптимизация «на всякий случай».
 *
 * `react-markdown` вместе с micromark весит под мегабайт до сжатия — больше, чем вся
 * остальная оболочка. В главном чанке он означал бы, что за предпросмотр платит каждый
 * запуск приложения, включая тот, где ни одного `.md` не открывали. Ровно так же он
 * грузился в v1 и по той же причине.
 */
const MarkdownPreview = lazy(async () => {
  const module = await import('./MarkdownPreview');
  return { default: module.MarkdownPreview };
});

export interface MarkdownEditorProps {
  readonly host: MarkdownHost;
  readonly views: MarkdownViewStore;
  readonly documentId: ResourceId;
}

/**
 * Текст документа как состояние React.
 *
 * Подписка, а не чтение при отрисовке: буфер меняется набором в левой половине, и без неё
 * правый рендер обновлялся бы только при переключении вкладок.
 *
 * Подписка внешнего хранилища, а не эффект с `setState`: эффект давал бы лишний каскад
 * отрисовок и первый кадр со СТАРЫМ текстом — между монтированием и эффектом успевает
 * пройти отрисовка. Снимок здесь строка, поэтому сравнение ссылкой работает само.
 */
function useDocumentText(host: MarkdownHost, documentId: ResourceId): string | null {
  const subscribe = useCallback(
    (listener: () => void) => {
      const current = host.documentOf(documentId);
      if (current === null) return () => undefined;
      const subscription = current.onDidChangeContent(() => {
        listener();
      });
      return () => {
        subscription.dispose();
      };
    },
    [host, documentId]
  );

  const snapshot = useCallback(
    (): string | null => host.documentOf(documentId)?.getText() ?? null,
    [host, documentId]
  );

  return useSyncExternalStore(subscribe, snapshot, snapshot);
}

/** Текущий режим документа как состояние React. Та же подписка, что у текста. */
function useView(views: MarkdownViewStore, documentId: ResourceId): string {
  const subscribe = useCallback(
    (listener: () => void) => {
      const subscription = views.subscribe(listener);
      return () => {
        subscription.dispose();
      };
    },
    [views]
  );

  const snapshot = useCallback(() => views.get(documentId), [views, documentId]);

  return useSyncExternalStore(subscribe, snapshot, snapshot);
}

/**
 * Размеры половин режима «рядом», в пикселях: библиотека раскладки в этом ките считает
 * в них же (см. `Shell`), а не в процентах. Поровну — то, чего ждут от слова «рядом».
 */
const SPLIT_SIZES = { source: 480, preview: 480 } as const;

export function MarkdownEditor({ host, views, documentId }: MarkdownEditorProps): ReactElement {
  const translate = host.useTranslate();
  const document = host.documentOf(documentId);
  const text = useDocumentText(host, documentId);
  const view = useView(views, documentId);
  const containerRef = useRef<HTMLDivElement>(null);

  // Документ открывается асинхронно: до его появления показывать нечего, но и «файл пуст»
  // писать нельзя — это разные состояния.
  if (document === null || text === null) {
    return (
      <Empty className="flex-1 border-0">
        <EmptyHeader>
          <EmptyTitle className="text-sm font-medium">{translate('editor.opening')}</EmptyTitle>
        </EmptyHeader>
      </Empty>
    );
  }

  const TextEditor = host.TextEditor;

  const preview = (
    // Заглушка — пустой блок, а не надпись: рендер приезжает за десятки миллисекунд,
    // и текст «загружается» успел бы только мигнуть.
    <Suspense fallback={<div className="bg-background h-full" />}>
      <MarkdownPreview host={host} document={document} text={text} containerRef={containerRef} />
    </Suspense>
  );

  if (view === 'preview' || TextEditor === undefined) {
    return <div className="flex min-h-0 flex-1 flex-col">{preview}</div>;
  }

  if (view === 'code') {
    return (
      <div className="flex min-h-0 flex-1 flex-col">
        <TextEditor documentId={documentId} />
      </div>
    );
  }

  return (
    <ResizablePanelGroup id="markdown.split" orientation="horizontal" className="min-h-0 flex-1">
      <ResizablePanel id="markdown.source" defaultSize={SPLIT_SIZES.source} minSize={200}>
        <div className="flex h-full min-h-0 flex-col">
          <TextEditor documentId={documentId} />
        </div>
      </ResizablePanel>
      <ResizableHandle withHandle />
      <ResizablePanel id="markdown.preview" defaultSize={SPLIT_SIZES.preview} minSize={200}>
        {preview}
      </ResizablePanel>
    </ResizablePanelGroup>
  );
}
