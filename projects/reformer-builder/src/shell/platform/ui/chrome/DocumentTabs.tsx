/**
 * Ряд вкладок документов. Правила живут в `./tabs`, здесь — отрисовка и ввод.
 *
 * ## Что здесь есть и чего здесь нет
 *
 * Есть: ряд, активная вкладка, признак изменённости, закрепление двойным щелчком, закрытие
 * и вопрос о несохранённом. Нет: порядка вкладок, режима предпросмотра и правила «какая
 * вкладка станет активной после закрытия» — это правила, они в `./tabs` и проверяются
 * без браузера.
 *
 * ## Пометки ресурсов — те же, что в дереве
 *
 * Вклад `ResourceDecorationPoint` помечает ресурс один раз, а видно пометку и в строке дерева, и
 * на вкладке: значок вклада стоит перед именем, счётчик — после, подсказка — у значка (подсказка
 * вкладки — её путь: по нему вкладку и находят).
 * Ради вкладки это и понадобилось: ассистент правит форму в фоне, и человек должен видеть, над
 * какой из открытых вкладок идёт ход.
 *
 * ## Вопрос о несохранённом — модальное окно кита
 *
 * `@reformer/ui-kit/alert-dialog`: он тянет только `radix-ui`, который в сборке уже есть
 * ради раскладки, вкладок и подсказок. Вопрос модальный намеренно — он про потерю данных,
 * и ответ на него не должен уезжать за край экрана вместе с прокруткой или теряться,
 * пока человек продолжает печатать в редакторе.
 *
 * Три ответа, а не два: «сохранить и закрыть», «закрыть без сохранения» и отмена. Отмена —
 * не украшение: закрытие могло быть промахом по крестику соседней вкладки. Живёт она
 * крестиком в углу окна, а не кнопкой в подвале: отказ от вопроса — не третий равноправный
 * ответ, и в подвале он спорил бы взглядом с «сохранить и закрыть».
 *
 * @module shell/platform/ui/chrome/DocumentTabs
 */

import { useCallback, useState, type ReactElement, type ReactNode } from 'react';
import { X } from 'lucide-react';
import { Badge } from '@reformer/ui-kit/badge';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@reformer/ui-kit/alert-dialog';
import { Button } from '@reformer/ui-kit/button';
import { ScrollArea, ScrollBar } from '@reformer/ui-kit/scroll-area';
import { Tabs, TabsList, TabsTrigger } from '@reformer/ui-kit/tabs';
import type { RootI18nService } from '@/shell/platform/services/i18n/i18n';
import type { ResourceId } from '@reformer/builder-plugin-api/internal';
import { findTab, type DocumentTabsStore, type Tab } from '@/shell/platform/ui/state/tabs';
import { useLocale } from '@reformer/builder-plugin-api/internal';
import {
  decorationTooltip,
  mergeDecorations,
  type DecorationEntry,
  type MergedDecoration,
} from '@/shell/platform/ui/contributions/decorations';
import {
  createLazyEditorProbe,
  createUnreadableProbe,
} from '@/shell/platform/ui/contributions/editors';
import { PluginScope } from './PluginScope';
import type { ExtensionReader } from './usePanels';
import { DECORATION_BADGE_VARIANT, useResourceDecorations } from './useResourceDecorations';
import { useDocumentTabs } from './useWorkspaceViews';

export interface DocumentTabsProps {
  readonly tabs: DocumentTabsStore;
  readonly i18n: RootI18nService;
  /** Вклады — ради пометок ресурсов на вкладках (см. шапку). */
  readonly extensions: ExtensionReader;
  /**
   * Что показать справа от ряда — сегодня это выбор редактора («открыть с помощью»).
   *
   * Узлом, а не своим содержимым: ряд вкладок не должен знать ни про редакторы, ни про точку
   * их расширения — он про открытые ресурсы. Своя полоса под кнопку стоила бы 34 пикселя
   * высоты у документа ради одного элемента управления, поэтому она делит полосу с вкладками.
   */
  readonly trailing?: ReactNode;
}

function reportTabError(error: unknown): void {
  console.error('[shell] действие над вкладкой не выполнено', error);
}

/**
 * Пометка вкладки. Проба читает открытый документ: у вкладки он всегда есть, а дерево ради той же
 * пробы ходило бы в источник.
 */
function tabDecoration(
  entries: readonly DecorationEntry[],
  tabs: DocumentTabsStore,
  tab: Tab
): MergedDecoration | null {
  if (entries.length === 0) return null;
  const document = tabs.documentOf(tab.ref.id);
  const probe =
    document === null
      ? createUnreadableProbe(tab.ref)
      : createLazyEditorProbe(() => Promise.resolve(document.getText()));
  return mergeDecorations(entries, tab.ref, probe);
}

/**
 * Значок вклада перед именем — в контейнере его плагина, как в строке дерева.
 *
 * Подсказка — у самого значка, а не у вкладки: подсказка вкладки — её путь, и по нему вкладку
 * находят. Значок скрыт от доступного имени: имя вкладки начинается с имени файла.
 */
function DecorationIcon({
  decoration,
  tooltip,
}: {
  decoration: MergedDecoration;
  tooltip: string | null;
}): ReactElement | null {
  const Icon = decoration.icon;
  if (Icon === undefined) return null;
  const icon = (
    <span
      aria-hidden="true"
      title={tooltip ?? undefined}
      className="flex size-3.5 flex-none items-center [&_svg]:size-3.5"
    >
      <Icon />
    </span>
  );
  return decoration.iconPluginId === undefined ? (
    icon
  ) : (
    <PluginScope pluginId={decoration.iconPluginId} as="span">
      {icon}
    </PluginScope>
  );
}

export function DocumentTabs({
  tabs,
  i18n,
  extensions,
  trailing,
}: DocumentTabsProps): ReactElement | null {
  const state = useDocumentTabs(tabs);
  const decorations = useResourceDecorations(extensions);
  /** Вкладка, о которой задан вопрос. `null` — вопроса нет. */
  const [asked, setAsked] = useState<Tab | null>(null);

  // Перевод не является React-состоянием: подписка на локаль — то, что делает `t()` реактивным.
  useLocale(i18n);
  const { t } = i18n;

  // Вкладка могла исчезнуть, пока вопрос висел (закрыли командой, ресурс пропал), — тогда
  // спрашивать не о чем. Проверка при отрисовке, а не эффектом с `setState`: вопрос обязан
  // исчезнуть в том же кадре, где исчезла вкладка, а эффект показал бы его ещё раз.
  const unsaved = asked !== null && findTab(state, asked.ref.id) !== null ? asked : null;
  const requestClose = useCallback(
    (id: ResourceId): void => {
      const decision = tabs.requestClose(id);
      if (decision.status === 'unsaved') {
        setAsked(decision.tab);
        return;
      }
      if (decision.status === 'close') void tabs.close(id).catch(reportTabError);
    },
    [tabs]
  );

  /** Закрывает вкладку, о которой задан вопрос, и убирает сам вопрос. */
  const answer = useCallback(
    (save: boolean): void => {
      if (unsaved === null) return;
      const id = unsaved.ref.id;
      setAsked(null);
      void tabs.close(id, save ? { save: true } : undefined).catch(reportTabError);
    },
    [tabs, unsaved]
  );

  if (state.tabs.length === 0) return null;

  return (
    <div className="flex flex-none flex-col border-b border-border">
      <div className="flex min-w-0 items-center">
        <Tabs
          value={state.activeId ?? ''}
          onValueChange={(value) => {
            tabs.activate(value);
          }}
          // Ряд вкладок — не блочная раскладка кита: у него `gap-2` между списком и содержимым,
          // а содержимое рисуется ниже, вне `Tabs` (редактор один, а не по одному на вкладку).
          // `min-w-0` обязателен: без него ряд не сжимается и выталкивает соседа за край.
          className="min-w-0 flex-1 gap-0"
        >
          {/* Прокрутка ряда — областью кита, а не нативным `overflow-x-auto`: нативная полоса
            в Windows занимает высоту внутри ряда (34px минус её толщина остаётся вкладкам)
            и не убирается вместе с курсором. Полоса кита — оверлей поверх нижнего края,
            `size="xs"` делает её 6px, чтобы она не спорила с подчёркиванием активной вкладки. */}
          <ScrollArea size="xs" className="w-full">
            <TabsList
              variant="line"
              aria-label={t('shell.tabs.label')}
              // `w-max`, а не `w-full`: внутри области ряд должен быть шириной по содержимому,
              // иначе он сожмётся до ширины окна и прокручивать станет нечего.
              className="h-[34px] w-max justify-start gap-0 rounded-none px-1"
            >
              {state.tabs.map((tab) => {
                const decoration = tabDecoration(decorations, tabs, tab);
                const tooltip = decoration === null ? null : decorationTooltip(i18n, decoration);
                return (
                  <div
                    key={tab.ref.id}
                    // Подчёркивание активной вкладки рисует обёртка, а не сам триггер: полоса идёт
                    // под всей вкладкой вместе с крестиком, а крестик — сосед триггера, а не его
                    // содержимое (внутри триггера это была бы кнопка в кнопке). `self-stretch`
                    // и `-bottom-[3px]` кладут полосу на нижний край ряда — на отступ `TabsList`.
                    className="group/tab relative flex flex-none items-center self-stretch after:absolute after:inset-x-0 after:-bottom-[3px] after:h-0.5 after:bg-foreground after:opacity-0 after:transition-opacity has-[[data-state=active]]:after:opacity-100"
                  >
                    <TabsTrigger
                      value={tab.ref.id}
                      title={tab.ref.path}
                      data-decorated={
                        decoration === null ? undefined : (decoration.tone ?? 'default')
                      }
                      onDoubleClick={() => {
                        tabs.pin(tab.ref.id);
                      }}
                      onAuxClick={(event) => {
                        // Средняя кнопка закрывает — привычка из редакторов кода; правая
                        // оставлена контекстному меню, которого здесь пока нет.
                        if (event.button === 1) requestClose(tab.ref.id);
                      }}
                      // `after:hidden` — своё подчёркивание кита выключено, его рисует обёртка.
                      className={
                        tab.preview
                          ? 'flex-none pr-1 text-[12px] italic after:hidden'
                          : 'flex-none pr-1 text-[12px] not-italic after:hidden'
                      }
                    >
                      {decoration !== null && (
                        <DecorationIcon decoration={decoration} tooltip={tooltip} />
                      )}
                      {tab.ref.name}
                      {decoration?.badge !== undefined && (
                        <Badge
                          variant={DECORATION_BADGE_VARIANT[decoration.tone ?? 'default']}
                          title={decoration.icon === undefined ? (tooltip ?? undefined) : undefined}
                          className="h-4 px-1.5 py-0 text-[10px]"
                        >
                          {decoration.badge}
                        </Badge>
                      )}
                      {tab.dirty && (
                        <span aria-label={t('shell.tabs.dirty')} title={t('shell.tabs.dirty')}>
                          •
                        </span>
                      )}
                    </TabsTrigger>
                    <Button
                      variant="ghost"
                      size="icon-xs"
                      aria-label={t('shell.tabs.close', { name: tab.ref.name })}
                      title={t('shell.tabs.close', { name: tab.ref.name })}
                      onClick={() => {
                        requestClose(tab.ref.id);
                      }}
                    >
                      {/* Поштучный импорт из `lucide-react`: `@reformer/ui-kit/icon` объявляет себя
                    opt-in, потому что тянет весь набор значков разом. */}
                      <X aria-hidden="true" className="size-3.5" />
                    </Button>
                  </div>
                );
              })}
            </TabsList>
            <ScrollBar orientation="horizontal" size="xs" />
          </ScrollArea>
        </Tabs>
        {trailing !== undefined && (
          <div className="flex flex-none items-center pr-1">{trailing}</div>
        )}
      </div>

      <AlertDialog
        open={unsaved !== null}
        onOpenChange={(open) => {
          // Закрытие окна крестиком, Escape или щелчком по подложке равно отмене: потерять
          // правки можно только явным ответом.
          if (!open) setAsked(null);
        }}
      >
        {/* Размер по умолчанию, а не `sm`: в вопросе есть имя файла, и в узком окне длинное
        имя переносится на несколько строк, а подвал схлопывается в две колонки. */}
        <AlertDialogContent>
          <AlertDialogCancel
            variant="ghost"
            size="icon-sm"
            aria-label={t('shell.tabs.unsaved.cancel')}
            title={t('shell.tabs.unsaved.cancel')}
            className="absolute top-3 right-3"
          >
            <X aria-hidden="true" className="size-4" />
          </AlertDialogCancel>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('shell.tabs.unsaved.title')}</AlertDialogTitle>
            <AlertDialogDescription>
              {t('shell.tabs.unsaved.message', { name: unsaved?.ref.name ?? '' })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          {/* Ответы прижаты влево, к тексту вопроса: читать их начинают оттуда же, откуда
          заголовок и имя файла, и глазу не надо возвращаться через всё окно. */}
          <AlertDialogFooter className="sm:justify-start">
            <AlertDialogAction
              variant="destructive"
              onClick={() => {
                answer(false);
              }}
            >
              {t('shell.tabs.unsaved.discard')}
            </AlertDialogAction>
            <AlertDialogAction
              onClick={() => {
                answer(true);
              }}
            >
              {t('shell.tabs.unsaved.save')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
