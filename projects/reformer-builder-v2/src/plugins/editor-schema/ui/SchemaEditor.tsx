/**
 * Тело редактора схемы: сеанс документа и канвас над ним.
 *
 * Оболочка пересоздаёт тело на пару «редактор + документ» (см. `host/ui/EditorArea`), поэтому
 * компонент не следит за сменой `documentId` — он получает новый экземпляр. Сеанс при этом
 * НЕ пересоздаётся: его держит реестр, и размонтирование тела только снимает пометку
 * активного. Иначе переключение вкладок туда-обратно стирало бы историю отмены и выделение.
 *
 * ## Свод диагностик подписывается ЗДЕСЬ, а не в канвасе
 *
 * Документ знает тело редактора, а канвас — нет: он получает готовый список строк и не
 * знает даже, из какого файла они. Подписка на находки — вопрос документа, поэтому она
 * стоит здесь, рядом с сеансом, а вниз уходит уже значением.
 *
 * @module plugins/editor-schema/ui/SchemaEditor
 */

import { useCallback, useEffect, useSyncExternalStore, type ReactElement } from 'react';
import { Empty, EmptyHeader, EmptyTitle } from '@reformer/ui-kit/empty';
import type { ResourceId } from '@/sdk';
import { Canvas } from './Canvas';
import { QuickAddDialog } from './QuickAddDialog';
import { useCatalog } from './useCatalog';
import type { CommandAccess } from '../editing/commands';
import { useDiagnosticCode, useResourceDiagnostics } from './useDiagnostics';
import { useSessionOf, useSessionState } from './useSession';
import type { DragSession } from '../session/drag-session';
import type { SchemaDiagnostics, SchemaEditorHost } from '../host';
import type { SessionRegistry } from '../session/sessions';
import type { CanvasPrefs } from '../session/canvas-prefs';
import type { QuickAddStore } from '../session/quick-add-store';
import type { CollapseRegistry } from '../session/view-state';
import type { SchemaView, SchemaViewStore } from '../session/view-mode';

export interface SchemaEditorProps {
  readonly host: SchemaEditorHost;
  readonly registry: SessionRegistry;
  readonly documentId: ResourceId;
  /** Реестр команд Host: собирает его плагин, у которого реестр есть. */
  readonly commands: CommandAccess;
  /**
   * Чем показан документ: конструктором или исходником.
   *
   * `null` — режимов нет вовсе (тест конструктора, встраивание), и тогда редактор всегда
   * рисует канвас. Это законная сборка, а не отсутствие возможности.
   */
  readonly views?: SchemaViewStore | null;
  /**
   * Свод диагностик. `null` — службы в реестре нет, и меток на узлах не будет.
   *
   * Приходит вкладом редактора (плагин берёт службу из `ctx.services`), а не портом
   * композиции: служба объявлена в `@/sdk`, и второй канал к ней означал бы два ответа
   * на вопрос «где свод».
   */
  readonly diagnostics?: SchemaDiagnostics | null;
  /** Сеанс перетаскивания — тот же объект, что достался палитре. */
  readonly drag?: DragSession | null;
  /**
   * Реестр снимков вида.
   *
   * Тот же объект обязан достаться вкладу редактора (`viewState.capture`), иначе оболочка
   * будет спрашивать снимок у пустого реестра, а свёрнутые ветки — теряться при переключении
   * вкладок ровно так же, как когда их не было вовсе.
   */
  readonly viewStates?: CollapseRegistry | null;
  /**
   * Предпочтения канваса: дерево или схема и видны ли обёртки.
   *
   * Общие для всех документов, поэтому приходят от плагина, а не рождаются в теле: тело
   * пересоздаётся на пару «редактор + документ», и вид сбрасывался бы при каждом
   * переключении вкладок.
   */
  readonly prefs?: CanvasPrefs | null;
  /**
   * Быстрое добавление компонента: стор, которым команда открывает диалог.
   *
   * `null` — сборка без него, и это законно: тесту канваса диалог не нужен.
   */
  readonly quickAdd?: QuickAddStore | null;
}

/**
 * Текущий режим документа как состояние React.
 *
 * Подписка, а не чтение при отрисовке: режим переключает КОМАНДА (кнопка в полосе вкладок,
 * палитра), и без подписки тело редактора узнало бы о смене только при следующей перерисовке
 * по другому поводу.
 *
 * Подписка внешнего хранилища, а не эффект с `setState`: тот же приём, что у сеансов
 * ({@link './useSession'}). Эффект давал бы лишний каскад отрисовок и первый кадр
 * со СТАРЫМ режимом — между монтированием и эффектом успевает пройти отрисовка.
 */
function useSchemaView(views: SchemaViewStore | null, documentId: ResourceId): SchemaView {
  const subscribe = useCallback(
    (listener: () => void) => {
      if (views === null) return () => undefined;
      const subscription = views.subscribe(listener);
      return () => {
        subscription.dispose();
      };
    },
    [views]
  );

  // Снимок — строка, поэтому кэшировать его не нужно: React сравнивает ссылкой,
  // а у равных строк она общая.
  const snapshot = useCallback(
    (): SchemaView => views?.get(documentId) ?? 'design',
    [views, documentId]
  );

  return useSyncExternalStore(subscribe, snapshot, snapshot);
}

/** Открыт ли диалог быстрого добавления. Подписка на стор — тем же приёмом, что режим. */
function useQuickAddOpen(store: QuickAddStore | null): boolean {
  const subscribe = useCallback(
    (listener: () => void) => {
      if (store === null) return () => undefined;
      const subscription = store.subscribe(listener);
      return () => {
        subscription.dispose();
      };
    },
    [store]
  );
  const snapshot = useCallback(() => store?.isOpen() ?? false, [store]);
  return useSyncExternalStore(subscribe, snapshot, snapshot);
}

export function SchemaEditor({
  host,
  registry,
  documentId,
  commands,
  diagnostics = null,
  drag = null,
  viewStates = null,
  prefs = null,
  quickAdd = null,
  views = null,
}: SchemaEditorProps): ReactElement {
  const view = useSchemaView(views, documentId);
  const quickAddOpen = useQuickAddOpen(quickAdd);
  const catalog = useCatalog(host);
  const TextEditor = host.TextEditor;

  // Исходник рисуется ДО всех хуков конструктора? Нет: хук по условию звать нельзя.
  // Поэтому режим выбирается ниже, когда все хуки уже вызваны, — а сюда вынесено
  // только чтение состояния, которое само является хуком.
  const t = host.useTranslate();
  // Выбор реализации, а не условный вызов: хук по условию звать нельзя, а подстановка
  // запасного — единственный способ этого избежать. Порт композиции за время жизни
  // редактора не меняется, поэтому выбор стабилен.
  const useMessage = host.useDiagnosticMessage ?? useDiagnosticCode;
  const message = useMessage();
  // Тот же приём для подписей исправлений: их ключи лежат в словаре Host целиком
  // (`quickfix.*`), приставки им не нужно, и потому это отдельный от `message` перевод.
  const useFixTitle = host.useQuickFixTitle ?? useDiagnosticCode;
  const fixTitle = useFixTitle();
  const problems = useResourceDiagnostics(diagnostics, documentId);

  useEffect(() => {
    registry.open(documentId);
    return () => {
      registry.close(documentId);
    };
  }, [registry, documentId]);

  const session = useSessionOf(registry, documentId);
  const state = useSessionState(registry, session);

  if (session === null || state === null) {
    return (
      <Empty className="flex-1 border-0">
        <EmptyHeader>
          <EmptyTitle className="text-sm font-medium">{t('canvas.loading')}</EmptyTitle>
        </EmptyHeader>
      </Empty>
    );
  }

  // Исходник — тот же документ, показанный иначе: сеанс, выделение и история остаются
  // на месте, потому что меняется только тело. Именно поэтому это режим редактора,
  // а не второй редактор.
  if (view === 'code' && TextEditor !== undefined) {
    return (
      <div className="flex min-h-0 flex-1 flex-col">
        <TextEditor documentId={documentId} />
      </div>
    );
  }

  return (
    <>
      <Canvas
        session={session}
        state={state}
        t={t}
        commands={commands}
        problems={problems}
        message={message}
        fixTitle={fixTitle}
        drag={drag}
        viewStates={viewStates}
        prefs={prefs}
        // Поверхность, рисующая форму: её даёт композиция, потому что плагины друг друга
        // не видят. Отсутствие означает, что вида «форма» нет вовсе.
        live={host.live ?? null}
      />
      {/* Диалог рисуется телом редактора, а открывается КОМАНДОЙ через стор: команда живёт
          у плагина и про смонтированные компоненты не знает. Без стора — сборка без быстрого
          добавления; это законно (тест канваса), а не поломка. */}
      {quickAdd !== null && (
        <QuickAddDialog
          open={quickAddOpen}
          onClose={quickAdd.close}
          session={session}
          state={state}
          t={t}
          catalog={catalog}
          order={host.categoryOrder?.()}
        />
      )}
    </>
  );
}
