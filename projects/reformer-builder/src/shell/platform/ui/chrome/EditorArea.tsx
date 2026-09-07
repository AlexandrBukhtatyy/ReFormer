/**
 * Центр оболочки: ряд вкладок, тело активного редактора и пустые состояния.
 *
 * ## Чего здесь нет: самого редактора
 *
 * Ни одного. Тело рисует вклад точки {@link EditorPoint}, а этот файл только выбирает
 * кандидата и даёт ему место. Пока вкладов нет — а на Э5 их нет по определению, — центр
 * показывает пустое состояние, и это нормальная работа, а не заглушка.
 *
 * ## Три разных «пусто», и путать их нельзя
 *
 * - **рабочей области нет** — открывать нечего, вкладок не бывает;
 * - **вкладок нет** — область есть, документ не открыт;
 * - **редактора нет** — документ открыт, но за него никто не взялся.
 *
 * Третье — самое важное: оно означает «плагин не установлен», а не «файл сломан», и человек
 * обязан различать эти случаи, не открывая консоль.
 *
 * ## Тело пересоздаётся на пару «редактор + документ»
 *
 * `key` включает и то и другое, поэтому редактор не обязан следить за сменой `documentId`
 * на лету — он получает новый экземпляр. Плата за это — потерянная прокрутка, и ровно её
 * возвращает `viewState`: снимок берётся при уходе с пары, возвращается при заходе.
 *
 * ## Кандидаты считаются здесь, а не в двух местах
 *
 * Отбор `canOpen` даёт СРАЗУ и того, кто рисует, и список для «открыть с помощью». Считать
 * его дважды (один раз ради тела, другой ради меню) означало бы два ответа на один вопрос,
 * и первое же расхождение выглядело бы как «в меню отмечен не тот, кто на экране».
 *
 * @module shell/platform/ui/chrome/EditorArea
 */

import { useEffect, useLayoutEffect, useMemo, type ReactElement } from 'react';
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from '@reformer/ui-kit/empty';
import type { ResourceId } from '@/shell/platform/primitives/resource';
import type { CommandRegistry } from '@/shell/platform/primitives/command';
import type { WhenContext } from '@/shell/platform/primitives/when-context';
import type { RootI18nService } from '@/shell/platform/services/i18n/i18n';
import { DocumentTabs } from './DocumentTabs';
import { EditorActions, type EditorActionsCommands } from './EditorActions';
import {
  createEditorChoiceStore,
  pickEditor,
  type EditorChoiceStore,
} from '@/shell/platform/ui/contributions/editor-choice';
import {
  EditorPoint,
  createViewStateStore,
  rankEditorsForDocument,
  type EditorCandidate,
  type EditorEntry,
  type ViewStateStore,
} from '@/shell/platform/ui/contributions/editors';
import type { Document } from '@/shell/platform/workspace/document';
import { hostMenuEntry, type MenuEntry } from '@/shell/platform/ui/menu/menu';
import { EDITOR_TITLE_MENU } from '@/shell/platform/ui/menu/editor-menu';
import type { PanelEntry } from './panels';
import type { DocumentTabsStore } from '@/shell/platform/ui/state/tabs';
import { useContributions, type ExtensionReader } from './usePanels';
import { useDocumentTabs, useEditorChoices } from './useWorkspaceViews';

export interface EditorAreaProps {
  readonly extensions: ExtensionReader;
  readonly i18n: RootI18nService;
  /**
   * Реестр команд — для ряда действий над документом (`editor/title`).
   *
   * Необязателен: без него ряд не рисуется, а вкладки и редакторы работают как работали.
   * Это та же деградация, что у контекстного меню дерева, и по той же причине — пункт
   * есть ссылка на команду.
   */
  readonly commands?: EditorAreaCommands;
  /** Контекст применимости для ряда действий; читается в момент отрисовки. */
  readonly whenContext?: () => WhenContext;
  /** Вкладки документов; `null` — рабочая область ещё не открыта. */
  readonly documents: DocumentTabsStore | null;
  /**
   * Вклады слота `editor.main`.
   *
   * Слот остаётся: он для того, что занимает центр, не будучи документом, — приветственный
   * экран, отчёт о запуске. Показывается, только когда открытых вкладок нет: документ важнее.
   */
  readonly panels: readonly PanelEntry[];
}

/** Пустое состояние в единственном виде — чтобы три разных «пусто» отличались только текстом. */
function EmptyState({ title, description }: { title: string; description?: string }): ReactElement {
  return (
    <Empty className="flex-1 border-0">
      <EmptyHeader>
        <EmptyTitle className="text-sm font-medium">{title}</EmptyTitle>
        {description !== undefined && (
          <EmptyDescription className="text-xs">{description}</EmptyDescription>
        )}
      </EmptyHeader>
    </Empty>
  );
}

/**
 * Тело активной вкладки.
 *
 * Отдельным компонентом, потому что здесь живёт эффект состояния вида: держать его выше
 * значило бы снимать прокрутку у вкладки, которой на экране уже нет.
 */
function ActiveEditor({
  document,
  entry,
  i18n,
  viewState,
  activeId,
}: {
  document: Document | null;
  entry: EditorEntry | null;
  i18n: RootI18nService;
  viewState: ViewStateStore;
  activeId: ResourceId;
}): ReactElement {
  useLayoutEffect(() => {
    if (entry === null) return;
    viewState.restore(entry, activeId);
    return () => {
      // Снимок берётся при уходе с пары. Момент — «эффект раскладки», то есть до отрисовки
      // следующего кадра; редактор, которому нужен более ранний момент, скажет об этом сам,
      // и тогда `viewState` придётся дополнить — контракт про это молчит.
      viewState.capture(entry, activeId);
    };
  }, [entry, activeId, viewState]);

  const { t } = i18n;

  if (document === null) {
    return <EmptyState title={t('shell.editor.opening')} />;
  }
  if (entry === null) {
    return (
      <EmptyState
        title={t('shell.editor.noEditor.title')}
        description={t('shell.editor.noEditor.description', { media: document.ref.mediaType })}
      />
    );
  }

  const { Body } = entry.value;
  return <Body key={`${entry.value.id} ${activeId}`} documentId={activeId} />;
}

/**
 * Реестр команд в объёме, нужном центру: ряд действий читает и выполняет, а сам центр
 * ещё и регистрирует свою команду смены редактора.
 */
export type EditorAreaCommands = EditorActionsCommands & Pick<CommandRegistry, 'register'>;

/** Команда «открыть другим редактором». Экспортируется: на неё ссылается пункт меню «Файл». */
export const EDITOR_NEXT_COMMAND_ID = 'shell.editor.next';

/**
 * Встроенные пункты «…» — то, что относится к ЛЮБОМУ открытому документу.
 *
 * Значка нет намеренно: по правилу ряда пункт без значка уходит под «…», и именно это
 * делает кнопку постоянной. Дальше её наполняет тот, кто знает, что открыто: редактор схемы
 * кладёт туда обёртки, markdown — своё. Без этой записи «…» появлялась бы и исчезала вместе
 * с чужими вкладами, а место у постоянной кнопки должно быть постоянным.
 *
 * Смена редактора здесь, а не только в меню «Файл», по той же причине, по какой она вообще
 * есть: «покажи этот файл иначе» спрашивают О ДОКУМЕНТЕ, и спрашивать это удобнее там, где
 * документ и открыт. Пункт остаётся ссылкой на ту же команду — второго пути к ней не заведено.
 */
const EDITOR_TITLE_BUILTIN: readonly MenuEntry[] = Object.freeze([
  hostMenuEntry('shell.editor.title.next', {
    kind: 'item',
    menu: EDITOR_TITLE_MENU,
    command: EDITOR_NEXT_COMMAND_ID,
    group: '9_editor',
  }),
]);

/** Ни одного кандидата: одна ссылка — её сравнивает `useMemo` ниже по дереву. */
const NO_CANDIDATES: readonly EditorCandidate[] = Object.freeze([]);

/** Центр с вкладками. Отдельный компонент, потому что хуки вкладок нужны только здесь. */
function DocumentSurface({
  documents,
  extensions,
  i18n,
  panels,
  choices,
  commands,
  whenContext,
}: {
  documents: DocumentTabsStore;
  extensions: ExtensionReader;
  i18n: RootI18nService;
  panels: readonly PanelEntry[];
  choices: EditorChoiceStore;
  commands?: EditorAreaCommands;
  whenContext?: () => WhenContext;
}): ReactElement {
  const state = useDocumentTabs(documents);
  const entries = useContributions(extensions, EditorPoint);
  const chosen = useEditorChoices(choices);
  // Одно хранилище на всё время жизни центра: состояние вида переживает переключение вкладок,
  // ради чего оно и существует.
  const viewState = useMemo(() => createViewStateStore(), []);
  const { t } = i18n;

  const activeId = state.activeId;
  const document = activeId === null ? null : documents.documentOf(activeId);
  // Отбор считается один раз на пару: содержимое берётся из буфера открытого документа,
  // поэтому переключение вкладок не стоит ни одного чтения (см. `./editors`).
  const candidates = useMemo(
    () => (document === null ? NO_CANDIDATES : rankEditorsForDocument(entries, document)),
    [entries, document]
  );
  const chosenId = activeId === null ? null : (chosen.get(activeId) ?? null);
  const entry = useMemo(() => pickEditor(candidates, chosenId), [candidates, chosenId]);

  return (
    <>
      <DocumentTabs
        tabs={documents}
        i18n={i18n}
        trailing={
          <EditorActions
            extensions={extensions}
            i18n={i18n}
            ref={document?.ref ?? null}
            editorId={entry?.value.id ?? null}
            commands={commands}
            whenContext={whenContext}
            builtin={EDITOR_TITLE_BUILTIN}
          />
        }
      />
      <div className="flex min-h-0 flex-1 flex-col">
        {activeId !== null ? (
          <ActiveEditor
            document={document}
            entry={entry}
            i18n={i18n}
            viewState={viewState}
            activeId={activeId}
          />
        ) : panels.length > 0 ? (
          panels.map((panel) => <panel.value.Body key={panel.id} panelId={panel.value.id} />)
        ) : (
          <EmptyState title={t('shell.editor.empty')} />
        )}
      </div>
    </>
  );
}

export function EditorArea({
  extensions,
  i18n,
  documents,
  panels,
  commands,
  whenContext,
}: EditorAreaProps): ReactElement {
  const { t } = i18n;
  // Одно хранилище на всё время жизни центра — как и состояние вида, и по той же причине:
  // выбор редактора обязан пережить и переключение вкладок, и пересоздание тела редактора,
  // которое сам же и вызывает. Создаётся ВЫШЕ ветки «рабочей области нет», иначе хук
  // оказался бы условным.
  const choices = useMemo(() => createEditorChoiceStore(), []);

  /**
   * Команда «открыть другим редактором»: следующий кандидат по кругу.
   *
   * Пришла на место выпадающего списка в полосе вкладок. Список занимал место у имён файлов
   * и стоял вплотную к переключателю вида markdown — два элемента управления на один вопрос.
   * Команда доступна из палитры и из меню «Файл», а места не занимает вовсе.
   *
   * Круг, а не выбор из списка: кандидатов почти всегда двое (предметный редактор и текст),
   * и «следующий» отвечает на «покажи иначе» тем же одним нажатием.
   *
   * Регистрируется ЗДЕСЬ, а не в поверхности документов: та живёт только при открытой
   * рабочей области, и пункт меню, ссылающийся на команду, исчезал бы до открытия проекта
   * вместо того, чтобы быть серым. Состояние читается лениво — в момент вопроса и в момент
   * вызова, — поэтому реактивность ему не нужна.
   */
  useEffect(() => {
    if (commands === undefined) return;

    /** Кандидаты для активного документа прямо сейчас; пустой список — переключать нечего. */
    const candidatesNow = (): readonly EditorCandidate[] => {
      const activeId = documents?.get().activeId ?? null;
      if (activeId === null) return NO_CANDIDATES;
      const document = documents?.documentOf(activeId) ?? null;
      if (document === null) return NO_CANDIDATES;
      return rankEditorsForDocument(
        extensions.get(EditorPoint).map((contribution) => contribution),
        document
      );
    };

    const subscription = commands.register({
      id: EDITOR_NEXT_COMMAND_ID,
      titleKey: 'shell.editor.next',
      // Меньше двух кандидатов — переключать не на что, и пункт обязан быть недоступен,
      // а не молча ничего не делать.
      enabled: () => candidatesNow().length > 1,
      run: () => {
        const activeId = documents?.get().activeId ?? null;
        const candidates = candidatesNow();
        if (activeId === null || candidates.length < 2) return;
        const current = pickEditor(candidates, choices.get().get(activeId) ?? null);
        const at = candidates.findIndex((candidate) => candidate.entry.id === current?.id);
        const next = candidates[(at + 1) % candidates.length];
        if (next !== undefined) choices.choose(activeId, next.entry.value.id);
      },
    });
    return () => {
      subscription.dispose();
    };
  }, [commands, documents, extensions, choices]);

  if (documents === null) {
    return (
      <div className="flex min-h-0 flex-1 flex-col">
        {panels.length > 0 ? (
          panels.map((entry) => <entry.value.Body key={entry.id} panelId={entry.value.id} />)
        ) : (
          <EmptyState
            title={t('shell.editor.empty')}
            description={t('shell.status.workspace.none')}
          />
        )}
      </div>
    );
  }

  return (
    <DocumentSurface
      documents={documents}
      extensions={extensions}
      i18n={i18n}
      panels={panels}
      choices={choices}
      commands={commands}
      whenContext={whenContext}
    />
  );
}
