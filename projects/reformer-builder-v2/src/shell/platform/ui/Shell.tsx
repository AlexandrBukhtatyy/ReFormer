/**
 * Оболочка: рейл, доки, центр, тулбар и строка состояния.
 *
 * ## Оболочка не знает ни одной предметной сущности
 *
 * В этом файле нет ни «палитры», ни «инспектора», ни «схемы» — только слоты и вклады.
 * Правило проверяется линтером (host не импортирует `@/lib` и `@/plugins`), но смысл его
 * не в проверке: как только оболочка узнает про палитру, «показывать ли палитру сейчас»
 * станет её решением, и мы получим ровно дефект v1 — палитра компонентов на вкладке
 * с markdown и пустой инспектор рядом. Здесь на этот вопрос отвечает предикат `when`
 * у того, кто панель внёс.
 *
 * ## Что здесь есть и чего здесь нет
 *
 * Есть: раскладка, отбор панелей по слоту и `when`, вкладки левого дока, сохранение размеров,
 * подключение диспетчера сочетаний, палитры и строки состояния. Нет: выбора редактора
 * по ресурсу (`editor.main` пока показывает панели этого слота).
 *
 * Подключение — именно подключение: диспетчер живёт в `./keybindings`, палитра
 * в `./CommandPalette`, строка состояния в `./StatusBar`, и ни одна из трёх вещей не знает
 * про оболочку больше, чем про свои реестры. Здесь только то, что связывает их с раскладкой.
 *
 * ## Что рисуется компонентами кита, а что остаётся разметкой
 *
 * Всё, что является **элементом управления или типовой поверхностью**, — компонент
 * `@reformer/ui-kit`: раскладка (`/resizable`), вкладки рейла (`/toggle`), подсказки к ним
 * (`/tooltip`), линии между панелями стопки (`/separator`), прокрутка тела панелей
 * (`/scroll-area`). Прокрутка стоит в этом ряду не за компанию: у неё есть и состояние,
 * и вид — полоса кита выглядит одинаково во всех доках и не зависит от того, какой скроллбар
 * подставит система. Голыми остаются каркасные узлы, у которых нет ни состояния,
 * ни поведения: `header`/`nav`/`aside`/`footer` с флексом. Заменять их было бы
 * не «перейти на кит», а завернуть `div` в `div` с чужим именем.
 *
 * ## Почему логика вынесена из компонента
 *
 * Окружение тестов — `node`, и всё, что осталось бы в JSX, проверить нечем. Поэтому отбор
 * панелей живёт в `./panels`, раскладка в настройках — в `./layout-settings`, классификация
 * фокуса — в `./focus`, а здесь только их сборка. Это не уступка тестам: правило «панели
 * слота отбираются так-то» полезно уметь спросить, не рисуя интерфейс.
 *
 * @module host/ui/Shell
 */

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type ReactElement,
} from 'react';
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from '@reformer/ui-kit/resizable';
import { usePanelRef } from 'react-resizable-panels';
import { Toggle } from '@reformer/ui-kit/toggle';
import { Button } from '@reformer/ui-kit/button';
import { ScrollArea } from '@reformer/ui-kit/scroll-area';
import { ChevronDown, ChevronUp, X } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@reformer/ui-kit/tooltip';
import type { CommandRegistry } from '../primitives/command';
import type { WhenContext } from '../primitives/when-context';
import type { ContextKeyReader } from '../services/context-keys';
import type { RootI18nService } from '../services/i18n/i18n';
import type { NotificationsService } from '../services/notifications';
import type { PromptService } from '../services/prompt';
import type { SettingsService } from '../services/settings';
import { CommandPalette } from './CommandPalette';
import { EditorArea, EDITOR_NEXT_COMMAND_ID } from './EditorArea';
import { HelpDialogs, HELP_ABOUT_COMMAND_ID } from './HelpDialogs';
import { KeybindingsDialog, KEYBINDINGS_OPEN_COMMAND_ID } from './KeybindingsDialog';
import { SettingsDialog, SETTINGS_OPEN_COMMAND_ID } from './SettingsDialog';
import type { SettingsSection } from './settings-ui';
import { MenuBar } from './MenuBar';
import {
  storagePurgeCommand,
  STORAGE_PURGE_COMMAND_ID,
  type StorageMaintenance,
} from './storage-purge';
import { hostMenuEntry, type MenuEntry } from './menu';
import { NotificationCenter } from './NotificationCenter';
import { PromptHost } from './PromptHost';
import { useKeybindings } from './keybindings';
import { createChordState, type ChordState } from './chords';
import { createKeymapService, type KeymapService } from './keymap';
import type { ScopeStack } from './scope';
import type { DocumentTabsStore } from './tabs';
import { StatusBar } from './StatusBar';
import type { WorkspaceStatusSource } from './status';
import {
  dockSettingsKey,
  normalizeDockState,
  type DockMode,
  readPanelSizes,
  toggleDock,
  writeDockState,
  writePanelSizes,
  type PanelSizes,
} from './layout-settings';
import {
  findPanel,
  panelInitial,
  panelTitle,
  resolveActivePanelId,
  type PanelEntry,
} from './panels';
import type { SlotId } from './slots';
import { useFocusTracking, type WhenContextStore } from './when-context-store';
import { useLocale, usePanels, useSetting, type ExtensionReader } from './usePanels';

/** Платформа в объёме, который нужен оболочке. Больше она ни до чего не дотягивается. */
export interface ShellHost {
  readonly extensions: ExtensionReader;
  readonly whenContext: WhenContextStore;
  /**
   * Читатель условий `when` для диспетчера сочетаний.
   *
   * Необязателен: без него условия читают пять полей {@link whenContext}, и этого хватает
   * всем правилам самой оболочки. Композиция передаёт сюда службу контекстных ключей —
   * с ней становятся видны ключи, объявленные плагинами.
   */
  readonly contextKeys?: ContextKeyReader;
  /**
   * Действующая раскладка. Необязательна: без неё оболочка собирает свою поверх реестра
   * команд — тогда работают правила самих команд, но не правила из манифестов и не
   * переназначения человека, потому что их источники живут в композиции.
   */
  readonly keymap?: KeymapService;
  /**
   * Стек областей. Без него окна работают как раньше: их клавиши неотличимы от прочих,
   * и правило `scope == …` не совпадает ни с чем.
   */
  readonly scopes?: ScopeStack;
  /**
   * Ожидание второй ступени аккорда. Без него аккорды не работают: правило из двух нажатий
   * просто не совпадает, и его первая ступень остаётся свободной.
   */
  readonly chords?: ChordState;
  readonly settings: SettingsService;
  /**
   * Реестр команд. Нужен двоим: диспетчеру сочетаний и палитре — и обоим целиком, потому что
   * обоих интересует весь набор, а не отдельная команда.
   */
  readonly commands: CommandRegistry;
  /**
   * Итог по рабочей области для строки состояния.
   *
   * Обязателен, а не необязателен: «источник ещё не открыт» — это значение
   * (`createStaticWorkspaceStatusSource()`), а не отсутствие источника. Иначе строка
   * состояния молча исчезала бы до восстановления рабочей области, то есть ровно тогда,
   * когда состояние интереснее всего.
   */
  readonly status: WorkspaceStatusSource;
  /**
   * Корневой сервис локализации, а не вид Host: заголовки панелей разрешаются
   * в пространстве имён внёсшего плагина (см. `panelTitle` в `./panels`), для чего нужен
   * `forPlugin`. Свои строки оболочка берёт из `t()`.
   */
  readonly i18n: RootI18nService;
  /**
   * Разделы окна настроек.
   *
   * Составляет их композиция: ЧТО настраивается, знает она (тему применяет служба темы,
   * язык — служба локализации), а оболочка знает лишь, как это нарисовать. Без них пункт
   * меню и команда просто отсутствуют — окно, в котором нечего менять, не нужно.
   */
  readonly settingsSections?: readonly SettingsSection[];
  /**
   * Служба уведомлений. Отсутствие означает ровно одно: тосты не показываются — и это
   * законная сборка (тест оболочки, встраивание в чужой интерфейс), а не поломка.
   *
   * Необязательное поле, а не обязательное, потому что оболочка обязана рисоваться и без
   * него: уведомление — сообщение О работе, а не часть работы. Композиция службу передаёт
   * всегда, и без этого отказ открытия проекта виден только в консоли.
   */
  readonly notifications?: NotificationsService;
  /**
   * Служба запросов к человеку: имя новой папки, согласие на удаление.
   *
   * Необязательна ровно как уведомления: без неё оболочка рисуется, а команды, которым
   * нужен ответ, честно объявляют себя недоступными — это лучше диалога, который некому
   * показать.
   */
  readonly prompt?: PromptService;
  /**
   * Обслуживание хранилища: очистка кэша и перезапуск.
   *
   * Необязателен ровно как уведомления и запросы: состав хранилищ и способ перезапуска —
   * знание композиции, а оболочка обязана рисоваться и без него. Без порта команда
   * «Очистить кэш» не регистрируется, и пункт меню, ссылающийся на неё, не рисуется вовсе
   * (пункт без команды не показывается; см. `./menu`) — то же правило, по которому сборка
   * без справки остаётся законной сборкой.
   */
  readonly storage?: StorageMaintenance;
  /**
   * Вкладки документов. Отсутствие — «рабочая область ещё не открыта»: она восстанавливается
   * ПОСЛЕ отрисовки (шаг 7 запуска), и до этого момента открытых ресурсов не бывает вовсе.
   *
   * Необязательное поле, а не отдельный вид оболочки: центр обязан рисоваться в обоих случаях,
   * и различие между ними — одно пустое состояние, а не другая раскладка.
   */
  readonly documents?: DocumentTabsStore | null;
}

/**
 * Идентификаторы панелей горизонтальной группы. Перечислены целиком, включая те, что сейчас
 * скрыты: размеры восстанавливаются по этому списку, и скрытая панель обязана вернуться
 * той же ширины, какой её оставили.
 */
const MAIN_GROUP = 'main';

/** Пустой список дополнений рейла: одна замороженная ссылка вместо нового массива. */
const NO_EXTRAS: readonly PanelEntry[] = Object.freeze([]);
const MAIN_PANEL_IDS: readonly string[] = ['left', 'center', 'right'];

const CENTER_GROUP = 'center';
const CENTER_PANEL_IDS: readonly string[] = ['editor', 'bottom'];

/**
 * Команда «панель»: с адресом переключает конкретную панель, без адреса — боковую целиком.
 *
 * Экспортируется, потому что это общая дверь, а не внутренность оболочки: её зовут сочетание
 * `mod+b`, палитра и ассистент. Пункта меню у неё больше нет — «Вид» убран из шапки, — но
 * сама команда осталась: рейл переключает панели мышью, а это её клавиатурный и программный
 * путь.
 */
export const PANEL_TOGGLE_COMMAND_ID = 'shell.panel.toggle';

/**
 * Читает адрес панели из аргументов команды.
 *
 * Аргументы приходят от кого угодно — из меню, из палитры, от ассистента, — поэтому
 * проверяются, а не приводятся типом: `as { panelId: string }` здесь означало бы доверие
 * к тому, что модель прислала строку.
 */
function readPanelId(args: unknown): string | null {
  if (typeof args !== 'object' || args === null) return null;
  const value = (args as Record<string, unknown>).panelId;
  return typeof value === 'string' && value !== '' ? value : null;
}

/**
 * Сообщает о неудачной записи раскладки и не более того.
 *
 * Ронять оболочку из-за того, что не сохранилась ширина сайдбара, нельзя, а глотать отказ
 * молча — значит получить «ширина не запоминается» без единого следа. Служба уведомлений
 * сюда не заводится намеренно: тост на каждое движение разделителя — худшее из зол.
 */
function reportLayoutError(error: unknown): void {
  console.error('[shell] не удалось сохранить раскладку', error);
}

/** Состояние дока с вкладками: что активно, раскрыт ли он и что делает нажатие на вкладку. */
interface DockController {
  readonly activeId: string | null;
  /** Раскрыт ли док полностью: тело видно. */
  readonly open: boolean;
  /** Во что раскрыт док сейчас. */
  readonly mode: DockMode;
  /** Щелчок по вкладке: раскрыть её либо свернуть, если она уже открыта. */
  toggle(panelId: string): void;
  /** Поставить режим прямо. Активная вкладка не меняется. */
  setMode(mode: DockMode): void;
}

/**
 * Связывает вкладки дока с настройками.
 *
 * Активная вкладка и свёрнутость живут в настройках, а не в состоянии компонента: они обязаны
 * пережить перезагрузку страницы, а состояние React — нет. Плата за это — две подписки
 * на настройки вместо одного `useState`, и она окупается тем, что сброс настроек сбрасывает
 * и раскладку, одним действием.
 */
/**
 * Состояние дока: активная вкладка и режим.
 *
 * `closed` — во что сворачивается ИМЕННО этот док по щелчку в уже открытую вкладку.
 * У боковых это «скрыт»: их рейл снаружи и остаётся виден. У нижнего — «полоса»:
 * его вкладки живут внутри, и, спрятав их, док стало бы нечем вернуть.
 */
function useDock(
  settings: SettingsService,
  slot: SlotId,
  panels: readonly PanelEntry[],
  closed: DockMode = 'hidden'
): DockController {
  const activeRaw = useSetting(settings, dockSettingsKey(slot, 'active'));
  const modeRaw = useSetting(settings, dockSettingsKey(slot, 'open'));
  const stored = useMemo(
    () => normalizeDockState(activeRaw, modeRaw, closed),
    [activeRaw, modeRaw, closed]
  );
  const activeId = resolveActivePanelId(panels, stored.activeId);

  const toggle = useCallback(
    (panelId: string): void => {
      const next = toggleDock({ activeId, mode: stored.mode }, panelId, closed);
      void writeDockState(settings, slot, next).catch(reportLayoutError);
    },
    [settings, slot, activeId, stored.mode, closed]
  );

  const setMode = useCallback(
    (mode: DockMode): void => {
      void writeDockState(settings, slot, { activeId, mode }).catch(reportLayoutError);
    },
    [settings, slot, activeId]
  );

  return {
    activeId,
    open: stored.mode === 'full' && panels.length > 0,
    mode: panels.length === 0 ? 'hidden' : stored.mode,
    toggle,
    setMode,
  };
}

/** Содержимое одной панели. Отдельным компонентом — чтобы `Body` не перерисовывался соседями. */
function PanelBody({ entry }: { entry: PanelEntry }): ReactElement {
  const { Body, id } = entry.value;
  return <Body panelId={id} />;
}

/**
 * Шапка панели: один вид у левого дока и у стопок, поэтому один компонент.
 *
 * Заголовок остаётся `<h2>`, а не компонентом кита, намеренно. Ближайшее, что кит предлагает,
 * — `typography` (`TypographyH4` — это `text-xl`) и `Section` (DSL-контейнер RenderSchema для
 * группировки полей формы). Первое задаёт шкалу текста статьи и в полосу высотой 34px
 * не помещается, второе — про формы, а не про оболочку. Заимствовать компонент ради того,
 * чтобы затем переопределить у него всё, — это не «на ките», это чужое имя над своим стилем.
 */
function PanelHeading({ title, entry }: { title: string; entry: PanelEntry }): ReactElement {
  const Actions = entry.value.Actions;
  return (
    <div className="flex h-[34px] flex-none items-center justify-between gap-2 pr-1.5 pl-3">
      <h2 className="text-muted-foreground min-w-0 truncate text-[11.5px] font-semibold">
        {title}
      </h2>
      {/* Провайдер подсказок здесь, а не вокруг всей оболочки: действия — единственное
          место шапки, где они бывают, и вклад не обязан заводить свой. */}
      {Actions === undefined ? null : (
        <TooltipProvider>
          <div className="flex flex-none items-center gap-0.5">
            <Actions panelId={entry.value.id} />
          </div>
        </TooltipProvider>
      )}
    </div>
  );
}

/**
 * Левый рейл: вкладки левого дока сверху, вклады слота `rail.left` снизу.
 *
 * Кнопка вкладки — `Toggle` кита, а не своя. Совпадение здесь не стилистическое: у вкладки
 * рейла ровно два состояния, и второе нажатие по включённой сворачивает док — это и есть
 * переключатель, а не кнопка действия. Поэтому `aria-pressed`, которое раньше проставлялось
 * руками, теперь следствие компонента, а не договорённости с собой.
 *
 * Группу переключателей (`ToggleGroup`) кит тоже даёт, но она в одиночном режиме превращает
 * элементы в радиокнопки, а вкладка панели радиокнопкой не является: «ни одна не выбрана» —
 * законное состояние рейла, а у радиогруппы его нет.
 *
 * Подсказка — `Tooltip` кита вместо атрибута `title`. Атрибут остался бы вторым, нативным
 * всплытием поверх первого; доступное имя даёт `aria-label`, а `Tooltip` привязывается
 * к кнопке через `aria-describedby` сам.
 */
/**
 * Одна вкладка рейла.
 *
 * Вынесена в компонент, потому что групп на рейле две — основная и прижатая к низу.
 * Рисуй их разными выражениями, и они разъедутся видом на первой же правке одной из них.
 */
function RailTab({
  entry,
  i18n,
  dock,
}: {
  entry: PanelEntry;
  i18n: RootI18nService;
  dock: DockController;
}): ReactElement {
  const title = panelTitle(i18n, entry);
  const Icon = entry.value.icon;
  const active = dock.open && dock.activeId === entry.value.id;
  return (
    <Tooltip key={entry.id}>
      <TooltipTrigger asChild>
        <Toggle
          size="sm"
          pressed={active}
          aria-label={title}
          // Значение перехода не читается: свернуть открытую вкладку и раскрыть
          // другую — одно и то же действие дока, и решает про него `toggleDock`.
          onPressedChange={() => {
            dock.toggle(entry.value.id);
          }}
          className="text-muted-foreground data-[state=on]:text-accent-foreground size-8 cursor-pointer text-[12px] font-medium"
        >
          {Icon === undefined ? <span aria-hidden="true">{panelInitial(title)}</span> : <Icon />}
        </Toggle>
      </TooltipTrigger>
      <TooltipContent side="right">{title}</TooltipContent>
    </Tooltip>
  );
}
/**
 * Высота полосы вкладок по режиму.
 *
 * Числами, а не только классами: то же значение нужно раскладке как размер панели,
 * и разойдись они — свёрнутый док либо обрежет полосу, либо оставит под ней пустоту.
 * Одно объявление на оба потребителя.
 */
/** Высота нижней панели, когда своей ещё не было. */
const DEFAULT_BOTTOM_SIZE = 200;

/**
 * Панель раскладки не прокручивает себя сама.
 *
 * `react-resizable-panels` кладёт содержимому панели `overflow: auto` ИНЛАЙНОМ, и классом
 * это не снять — инлайн сильнее. Полоса появлялась там, где прокручивать нечего: размеры
 * панелей считаются долями группы, поэтому свёрнутый нижний док высотой ровно в полосу
 * вкладок выходит то 22.01 пикселя, то 21.6, и на второй доле пикселя Chromium ставит
 * рядом с крестиком НАСТОЯЩУЮ полосу шириной 15 пикселей — во всю высоту полосы вкладок,
 * ради содержимого, которого нет.
 *
 * Прокрутку внутри панелей ведёт `ScrollArea`, а не сама панель: своя полоса у панели
 * была бы второй поверх первой. Поэтому `hidden` здесь не заплатка на округление,
 * а правило раскладки, записанное явно.
 */
const PANEL_CONTENT_STYLE: CSSProperties = Object.freeze({ overflow: 'hidden' });

/** Разделов нет: одна ссылка, чтобы окно настроек не пересобиралось на каждый кадр. */
const NO_SETTINGS: readonly SettingsSection[] = Object.freeze([]);

const STRIP_HEIGHT: Readonly<Record<DockMode, number>> = Object.freeze({
  full: 34,
  minimal: 22,
  hidden: 0,
});

/**
 * Полоса вкладок нижнего дока — тот же принцип, что у рейла, в горизонтальной форме.
 *
 * Рейлом низ не сделать: вертикальная полоса у горизонтального дока отнимала бы ширину
 * у всего, что под ней, и заголовки в ней не помещались бы. Отсюда вкладки со СЛОВАМИ,
 * а не значками, — места по горизонтали хватает, а слово читается без наведения.
 *
 * Полоса остаётся видимой и когда док свёрнут: иначе развернуть его было бы нечем.
 * Это и отличает её от рейла, который живёт снаружи дока и потому виден всегда сам собой.
 */
function BottomTabs({
  i18n,
  tabs,
  dock,
}: {
  i18n: RootI18nService;
  tabs: readonly PanelEntry[];
  dock: DockController;
}): ReactElement {
  const { t } = i18n;
  const compact = dock.mode === 'minimal';
  return (
    <div
      className={`border-border flex flex-none items-center border-b ${
        compact ? 'gap-0.5 px-1' : 'gap-1 px-2'
      }`}
      style={{ height: STRIP_HEIGHT[dock.mode] }}
    >
      {tabs.map((entry) => {
        const title = panelTitle(i18n, entry);
        const active = dock.open && dock.activeId === entry.value.id;
        const Badge = entry.value.Badge;
        return (
          <Toggle
            key={entry.id}
            size="sm"
            pressed={active}
            onPressedChange={() => {
              dock.toggle(entry.value.id);
            }}
            className={`text-muted-foreground data-[state=on]:text-accent-foreground cursor-pointer font-medium ${
              compact ? 'h-4 gap-1 px-1.5 text-[10px]' : 'h-6 gap-1.5 px-2 text-[11.5px]'
            }`}
          >
            {title}
            {Badge !== undefined && <Badge panelId={entry.value.id} />}
          </Toggle>
        );
      })}

      {/* Кнопки справа, как в привычных инструментах: сворачивание рядом с закрытием,
          потому что это соседние по силе действия, и рука ищет их в одном месте.

          Кнопка сворачивания остаётся и в свёрнутом виде, меняя только направление
          стрелки. Исчезни она — её место занял бы крестик, и повторное нажатие вслепую
          закрывало бы панель вместо разворота. Место действия не должно зависеть
          от состояния, поэтому здесь один переключатель на оба направления. */}
      <div className="ml-auto flex items-center gap-0.5">
        <Button
          variant="ghost"
          size="icon"
          className={compact ? 'size-4' : 'size-6'}
          aria-label={t(compact ? 'shell.dock.bottom.expand' : 'shell.dock.bottom.minimize')}
          onClick={() => {
            dock.setMode(compact ? 'full' : 'minimal');
          }}
        >
          {compact ? <ChevronUp className="size-3" /> : <ChevronDown className="size-3.5" />}
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className={compact ? 'size-4' : 'size-6'}
          aria-label={t('shell.dock.bottom.close')}
          onClick={() => {
            dock.setMode('hidden');
          }}
        >
          <X className={compact ? 'size-3' : 'size-3.5'} />
        </Button>
      </div>
    </div>
  );
}

/**
 * Рейл дока: по кнопке на панель, открыта одна.
 *
 * Стопка панелей в доке была бы честнее ровно до второй панели: инспектор, переписка
 * с ассистентом и экспорт в одной колонке делят её высоту на три, и каждая перестаёт
 * помещаться. Одна активная плюс рейл — это тот же выбор, что сделан в v1, и сделан он
 * по той же причине.
 *
 * Сторона меняет только рамку и порядок: рамка рисуется со стороны центра, потому что
 * рейл отделяет себя от него, а не от края окна.
 */
function PanelRail({
  i18n,
  tabs,
  extras,
  dock,
  label,
  side = 'left',
}: {
  i18n: RootI18nService;
  tabs: readonly PanelEntry[];
  extras: readonly PanelEntry[];
  dock: DockController;
  label: string;
  side?: 'left' | 'right';
}): ReactElement {
  // Деление на группы, а не сортировка: «последняя в списке» и «у нижнего края» совпадают
  // только пока рейл заполнен целиком.
  const top = tabs.filter((e) => e.value.railPlacement !== 'bottom');
  const bottomTabs = tabs.filter((e) => e.value.railPlacement === 'bottom');

  return (
    <TooltipProvider>
      <nav
        aria-label={label}
        data-focus-zone="panel"
        className={`bg-sidebar flex w-[38px] flex-none flex-col items-center gap-1 border-border py-2 ${
          side === 'left' ? 'border-r' : 'border-l'
        }`}
      >
        {top.map((entry) => (
          <RailTab key={entry.id} entry={entry} i18n={i18n} dock={dock} />
        ))}
        {bottomTabs.length > 0 && (
          <div className="mt-auto flex flex-col items-center gap-1">
            {bottomTabs.map((entry) => (
              <RailTab key={entry.id} entry={entry} i18n={i18n} dock={dock} />
            ))}
          </div>
        )}
        {extras.length > 0 && (
          <div className="mt-auto flex flex-col items-center gap-1">
            {extras.map((entry) => (
              <PanelBody key={entry.id} entry={entry} />
            ))}
          </div>
        )}
      </nav>
    </TooltipProvider>
  );
}

export function Shell({ host }: { host: ShellHost }): ReactElement {
  const { extensions, whenContext, settings, commands, status, i18n, documents, notifications } =
    host;
  const contextKeys = host.contextKeys;

  // Своя раскладка, когда композиция её не дала. Создаётся один раз и освобождается при
  // размонтировании: она подписана на реестр команд, и брошенная подписка пережила бы
  // оболочку.
  const ownKeymap = useMemo(
    () => (host.keymap === undefined ? createKeymapService({ commands }) : null),
    [host.keymap, commands]
  );
  useEffect(() => () => ownKeymap?.dispose(), [ownKeymap]);
  const keymap = host.keymap ?? ownKeymap;

  // Своё состояние аккордов, когда композиция его не дала: держит таймер, поэтому
  // освобождается вместе с оболочкой.
  const ownChords = useMemo(
    () => (host.chords === undefined ? createChordState() : null),
    [host.chords]
  );
  useEffect(() => () => ownChords?.dispose(), [ownChords]);
  const chords = host.chords ?? ownChords ?? undefined;

  // Перевод не является React-состоянием: подписка на локаль — это и есть то, что делает
  // `t()` реактивным. Значение не нужно, нужен факт перерисовки.
  useLocale(i18n);
  useFocusTracking(whenContext);

  // Один обработчик на всё приложение, в фазе всплытия. `useMemo` здесь обязателен, а не
  // аккуратен: новый объект настроек на каждый кадр переустанавливал бы обработчик,
  // и порядок подписок относительно редакторов терялся бы вместе с ним.
  useKeybindings(
    useMemo(
      () => ({
        commands,
        keymap: keymap as KeymapService,
        ...(chords === undefined ? {} : { chords }),
        getContext: (): WhenContext => whenContext.get(),
        // Снимок берётся один раз на нажатие: условие и предикат обязаны видеть одно
        // состояние, а не два соседних во времени. Без службы поле не появляется вовсе —
        // тогда условия читают пять полей контекста, и этого хватает правилам оболочки.
        ...(contextKeys === undefined
          ? {}
          : { getReader: (): ((key: string) => unknown) => contextKeys.snapshot().read }),
      }),
      [commands, keymap, chords, whenContext, contextKeys]
    )
  );

  const rail = usePanels(extensions, whenContext, 'rail.left');
  const left = usePanels(extensions, whenContext, 'panel.left');
  const right = usePanels(extensions, whenContext, 'panel.right');
  const bottom = usePanels(extensions, whenContext, 'panel.bottom');
  const toolbar = usePanels(extensions, whenContext, 'toolbar');
  const editors = usePanels(extensions, whenContext, 'editor.main');

  // Свой контроллер на каждый док: активная панель и признак «свёрнут» у них разные,
  // и хранятся раздельно — свернув инспектор, человек не ожидает, что закроется дерево.
  const leftDock = useDock(settings, 'panel.left', left);
  const rightDock = useDock(settings, 'panel.right', right);
  const bottomDock = useDock(settings, 'panel.bottom', bottom, 'minimal');

  /**
   * Ручка нижней панели раскладки.
   *
   * Нужна потому, что `defaultSize` читается ОДИН РАЗ при монтировании: смена режима
   * после этого скрывает содержимое, но места не отдаёт — под полосой вкладок остаётся
   * пустая площадь прежней высоты. Схлопывание бывает только императивным.
   */
  const bottomPanel = usePanelRef();
  /** Рабочая высота нижней панели до сворачивания: в неё же и разворачиваем. */
  const lastFullSize = useRef<number | null>(null);
  const activeLeft = leftDock.open ? findPanel(left, leftDock.activeId) : null;
  const activeRight = rightDock.open ? findPanel(right, rightDock.activeId) : null;
  const activeBottom = bottomDock.open ? findPanel(bottom, bottomDock.activeId) : null;

  // Размеры читаются один раз: `defaultLayout` библиотека раскладки берёт при монтировании,
  // и перечитывать его смысла нет — после монтирования истина живёт в самой группе, а сюда
  // возвращается через `onLayoutChanged`.
  const [mainSizes] = useState<PanelSizes | undefined>(() =>
    readPanelSizes(settings, MAIN_GROUP, MAIN_PANEL_IDS)
  );
  const [centerSizes] = useState<PanelSizes | undefined>(() =>
    readPanelSizes(settings, CENTER_GROUP, CENTER_PANEL_IDS)
  );

  const saveSizes = useCallback(
    (groupId: string) =>
      (layout: Record<string, number>, meta: { isUserInteraction: boolean }): void => {
        // Только движение разделителя человеком. Библиотека зовёт этот же обработчик при
        // монтировании и при пересчёте ограничений, и без проверки запись затирала бы
        // сохранённые размеры автоматическими — в том числе теми, что получились, пока
        // панель была скрыта.
        if (!meta.isUserInteraction) return;
        void writePanelSizes(settings, groupId, layout).catch(reportLayoutError);
      },
    [settings]
  );
  const saveMain = useMemo(() => saveSizes(MAIN_GROUP), [saveSizes]);
  const saveCenter = useMemo(() => saveSizes(CENTER_GROUP), [saveSizes]);

  /**
   * Команда «нижняя панель»: переключает её между полным видом и полосой.
   *
   * Три состояния в одну клавишу не уложить, и я не пытался: сочетание водит между
   * `full` и `minimal`, потому что это состояния РАБОТЫ — свернул, чтобы освободить место,
   * развернул, чтобы прочитать. Закрытие — это «убрать с глаз», действие другой силы,
   * и у него своя кнопка. Но из закрытого сочетание разворачивает: иначе крестик был бы
   * ловушкой, а панель — потерянной.
   *
   * `allowInEditable`: место под панелью нужно ровно тогда, когда человек печатает.
   */
  // Раскладка приводится к режиму, а не наоборот: истина о том, свёрнут ли док, живёт
  // в настройках и переживает перезагрузку, а размер панели — состояние библиотеки.
  // Обе стороны идемпотентны: `collapse` у свёрнутой и `expand` у раскрытой не делают ничего.
  useEffect(() => {
    const panel = bottomPanel.current;
    if (panel === null) return;

    if (bottomDock.mode === 'hidden') {
      panel.collapse();
      return;
    }

    if (bottomDock.mode === 'minimal') {
      // Высота запоминается ПЕРЕД сворачиванием: разворачивать надо в ту, что человек
      // выставил разделителем, а не в общее умолчание. Записывается только настоящая
      // рабочая высота — иначе повторное сворачивание запомнило бы высоту полосы
      // и «развернуть» перестало бы разворачивать.
      const size = panel.getSize().inPixels;
      if (size > STRIP_HEIGHT.full) lastFullSize.current = size;
      panel.resize(STRIP_HEIGHT.minimal);
      return;
    }

    // Полный вид. `expand` здесь НЕДОСТАТОЧЕН: из свёрнутого состояния панель не схлопнута,
    // а уменьшена прямым размером, и по правилу библиотеки «развернуть» у не-схлопнутой
    // не делает ничего — панель осталась бы высотой в полосу. Поэтому размер ставится прямо.
    if (panel.isCollapsed()) panel.expand();
    if (panel.getSize().inPixels <= STRIP_HEIGHT.full) {
      panel.resize(lastFullSize.current ?? DEFAULT_BOTTOM_SIZE);
    }
  }, [bottomDock.mode, bottomPanel]);

  useEffect(() => {
    const subscription = commands.register({
      id: 'shell.dock.bottom.toggle',
      titleKey: 'shell.dock.bottom.toggle',
      keybinding: 'mod+j',
      allowInEditable: true,
      run: () => {
        bottomDock.setMode(bottomDock.mode === 'full' ? 'minimal' : 'full');
      },
    });
    return () => {
      subscription.dispose();
    };
  }, [commands, bottomDock]);

  /**
   * Очистка хранилища.
   *
   * Команда существует, только пока композиция дала порт, — а пункт меню, ссылающийся
   * на неё, без команды не рисуется вовсе (см. `./menu`). Поэтому «сборки без очистки»
   * не приходится описывать отдельно: она получается сама.
   *
   * Служба запросов здесь необязательна, но и не подменяется: без неё команда объявит
   * себя недоступной — снести рабочую копию по щелчку, ничего не спросив, нельзя.
   */
  const storage = host.storage;
  const promptService = host.prompt;
  useEffect(() => {
    if (storage === undefined) return undefined;
    const subscription = commands.register(
      storagePurgeCommand({
        storage,
        prompt: promptService ?? null,
        notifications: notifications ?? null,
      })
    );
    return () => {
      subscription.dispose();
    };
  }, [commands, storage, promptService, notifications]);

  /** Доки, между которыми ищется панель по идентификатору: у каждого свой контроллер. */
  const docks = useMemo(
    () => [
      { panels: left, dock: leftDock },
      { panels: right, dock: rightDock },
      { panels: bottom, dock: bottomDock },
    ],
    [left, right, bottom, leftDock, rightDock, bottomDock]
  );

  /**
   * Команда «панель»: с адресом панели переключает её, без адреса — боковую панель целиком.
   *
   * Одна команда с аргументом, а не команда на каждую панель. Вторая форма читалась бы
   * в палитре лучше («Файлы», «Проблемы»), но заголовком такой команды было бы имя панели,
   * то есть ключ из словаря ПЛАГИНА, — а команду регистрирует оболочка, и её ключи
   * разрешаются словарём Host. Получился бы маркер промаха на каждой строке.
   *
   * Вызов без аргумента поэтому не «ничего не делает»: он и есть `mod+b` из v1 — показать
   * или убрать боковую панель. Команда, которая в палитре доступна, но без аргумента
   * бесполезна, обещала бы то, чего не сделает.
   */
  useEffect(() => {
    const subscription = commands.register({
      id: PANEL_TOGGLE_COMMAND_ID,
      titleKey: 'shell.panel.toggle',
      keybinding: 'mod+b',
      run: (args) => {
        const panelId = readPanelId(args);
        if (panelId === null) {
          leftDock.setMode(leftDock.open ? 'hidden' : 'full');
          return true;
        }
        const owner = docks.find((entry) =>
          entry.panels.some((panel) => panel.value.id === panelId)
        );
        // Панели с таким адресом нет: плагин выключили между построением меню и щелчком.
        // Отказ, а не молчание, — иначе неотличимо от «переключил и ничего не изменилось».
        if (owner === undefined) return false;
        owner.dock.toggle(panelId);
        return true;
      },
    });
    return () => {
      subscription.dispose();
    };
  }, [commands, leftDock, docks]);

  /**
   * Встроенное содержимое меню — проекции того, чем владеет сама оболочка.
   *
   * Вкладами это быть не может: у корневого реестра `contribute` нет вовсе. Сейчас здесь
   * только справка — «Вид» с палитрой и списком панелей убран из шапки вместе с «Правкой»:
   * панели переключаются рейлом, палитра открывается сочетанием, и меню повторяло то, что
   * и так на экране. Команды при этом остались все до одной.
   */
  // Список постоянный, поэтому и ссылка постоянная: пересобирать его не на что —
  // ни панели, ни локаль на него не влияют, заголовки берутся из команд при построении.
  const builtinMenu = useMemo<readonly MenuEntry[]>(
    () => [
      // Смена редактора документа. Была выпадающим списком в полосе вкладок и уехала
      // оттуда: список занимал место у имён файлов и дублировал переключатель вида
      // markdown, стоявший рядом. Здесь она пункт меню и команда палитры — то есть
      // доступна, но ничего не занимает.
      hostMenuEntry('shell.file.editor.next', {
        kind: 'item',
        menu: 'file',
        command: EDITOR_NEXT_COMMAND_ID,
        group: '3_view',
      }),
      // Очистка кэша — своей группой, а не рядом с настройками: между «поменять цвет темы»
      // и «снести рабочую копию» обязана быть линия. Группа стоит перед настройками
      // (`8_` < `9_`), потому что это всё же обслуживание, а не первое, что ищут в меню.
      hostMenuEntry('shell.file.storage.purge', {
        kind: 'item',
        menu: 'file',
        command: STORAGE_PURGE_COMMAND_ID,
        group: '8_maintenance',
      }),
      // Настройки — в «Файле», рядом с открытием проекта: это первое место, где их ищут,
      // и там же они стоят в редакторах, на которые человек насмотрелся до нас.
      hostMenuEntry('shell.file.settings', {
        kind: 'item',
        menu: 'file',
        command: SETTINGS_OPEN_COMMAND_ID,
        group: '9_settings',
      }),
      hostMenuEntry('shell.help.shortcuts', {
        kind: 'item',
        menu: 'help',
        command: KEYBINDINGS_OPEN_COMMAND_ID,
      }),
      hostMenuEntry('shell.help.about', {
        kind: 'item',
        menu: 'help',
        command: HELP_ABOUT_COMMAND_ID,
        group: '2_about',
      }),
    ],
    []
  );

  const { t } = i18n;

  return (
    <div className="bg-background text-foreground flex h-screen min-h-0 w-full flex-col overflow-hidden">
      <header
        aria-label={t('shell.toolbar.label')}
        data-focus-zone="panel"
        className="bg-sidebar flex h-[38px] flex-none items-center gap-2 border-b border-border px-3"
      >
        <span className="text-[12px] font-semibold">{t('app.title')}</span>
        {/* Меню сразу за названием: слева направо — кто мы и что можно сделать. Правый
            край шапки остаётся слотом `toolbar`, то есть местом плагинов. */}
        <MenuBar
          commands={commands}
          extensions={extensions}
          whenContext={whenContext}
          i18n={i18n}
          builtin={builtinMenu}
          keymap={keymap ?? undefined}
        />
        <div className="flex flex-1 items-center justify-end gap-1">
          {toolbar.map((entry) => (
            <PanelBody key={entry.id} entry={entry} />
          ))}
        </div>
      </header>

      <div className="flex min-h-0 flex-1">
        <PanelRail
          i18n={i18n}
          tabs={left}
          extras={rail}
          dock={leftDock}
          label={t('shell.rail.label')}
        />

        <ResizablePanelGroup
          id="shell.main"
          orientation="horizontal"
          className="min-w-0 flex-1"
          defaultLayout={mainSizes}
          onLayoutChanged={saveMain}
        >
          {activeLeft !== null && (
            <>
              <ResizablePanel
                id="left"
                style={PANEL_CONTENT_STYLE}
                defaultSize={260}
                minSize={180}
                maxSize={560}
                className="bg-sidebar flex min-w-0 flex-col"
              >
                <aside
                  aria-label={t('shell.dock.left.label')}
                  data-focus-zone="panel"
                  className="flex min-h-0 flex-1 flex-col"
                >
                  <PanelHeading title={panelTitle(i18n, activeLeft)} entry={activeLeft} />
                  <ScrollArea className="min-h-0 flex-1">
                    <PanelBody entry={activeLeft} />
                  </ScrollArea>
                </aside>
              </ResizablePanel>
              <ResizableHandle withHandle />
            </>
          )}

          <ResizablePanel
            id="center"
            minSize={320}
            className="flex min-w-0 flex-col"
            style={PANEL_CONTENT_STYLE}
          >
            <ResizablePanelGroup
              id="shell.center"
              orientation="vertical"
              className="min-h-0 flex-1"
              defaultLayout={centerSizes}
              onLayoutChanged={saveCenter}
            >
              <ResizablePanel
                id="editor"
                minSize={120}
                className="flex min-h-0 flex-col"
                style={PANEL_CONTENT_STYLE}
              >
                <main
                  aria-label={t('shell.editor.label')}
                  data-focus-zone="panel"
                  className="flex min-h-0 flex-1 flex-col overflow-hidden"
                >
                  {/* Вкладки, выбор редактора и пустые состояния — в `./EditorArea`:
                      оболочка про документы знает ровно столько, сколько нужно, чтобы
                      отдать им центр. */}
                  <EditorArea
                    extensions={extensions}
                    i18n={i18n}
                    documents={documents ?? null}
                    panels={editors}
                    commands={commands}
                    whenContext={() => whenContext.get()}
                  />
                </main>
              </ResizablePanel>

              {bottom.length > 0 && (
                <>
                  <ResizableHandle withHandle />
                  {/* Свёрнутый док ужимается до полосы вкладок, а не исчезает: исчезни он
                      целиком — развернуть его было бы нечем. Полоса и есть его след. */}
                  <ResizablePanel
                    id="bottom"
                    style={PANEL_CONTENT_STYLE}
                    panelRef={bottomPanel}
                    defaultSize={
                      bottomDock.mode === 'minimal' ? STRIP_HEIGHT.minimal : DEFAULT_BOTTOM_SIZE
                    }
                    // Схлопывание объявлено ВСЕГДА, а не по режиму: включи его вместе
                    // с режимом — и в момент разворачивания панель уже не схлопываемая,
                    // а значит `expand` по правилу библиотеки не делает ничего.
                    collapsible
                    // Схлопнутый размер НОЛЬ, а не высота полосы: «скрыт» и «свёрнут» —
                    // разные состояния, и второе выражается прямым размером, а не
                    // схлопыванием. Двух схлопнутых размеров у панели не бывает.
                    collapsedSize={0}
                    minSize={STRIP_HEIGHT.minimal}
                    className="bg-sidebar flex min-h-0 flex-col"
                  >
                    <section
                      aria-label={t('shell.dock.bottom.label')}
                      data-focus-zone="panel"
                      className="flex min-h-0 flex-1 flex-col"
                    >
                      {bottomDock.mode !== 'hidden' && (
                        <BottomTabs i18n={i18n} tabs={bottom} dock={bottomDock} />
                      )}
                      {activeBottom !== null && (
                        <ScrollArea className="min-h-0 flex-1">
                          <PanelBody entry={activeBottom} />
                        </ScrollArea>
                      )}
                    </section>
                  </ResizablePanel>
                </>
              )}
            </ResizablePanelGroup>
          </ResizablePanel>

          {activeRight !== null && (
            <>
              <ResizableHandle withHandle />
              <ResizablePanel
                id="right"
                style={PANEL_CONTENT_STYLE}
                defaultSize={320}
                minSize={200}
                maxSize={640}
                className="bg-sidebar flex min-w-0 flex-col"
              >
                <aside
                  aria-label={t('shell.dock.right.label')}
                  data-focus-zone="panel"
                  className="flex min-h-0 flex-1 flex-col"
                >
                  <PanelHeading title={panelTitle(i18n, activeRight)} entry={activeRight} />
                  <ScrollArea className="min-h-0 flex-1">
                    <PanelBody entry={activeRight} />
                  </ScrollArea>
                </aside>
              </ResizablePanel>
            </>
          )}
        </ResizablePanelGroup>

        {/* Правый рейл: то же, что слева, зеркально. Рисуется, только если правому доку
            есть что предложить — пустая полоса 38px у края отнимала бы место у центра
            и ничего не обещала. */}
        {right.length > 0 && (
          <PanelRail
            i18n={i18n}
            tabs={right}
            extras={NO_EXTRAS}
            dock={rightDock}
            label={t('shell.rail.right.label')}
            side="right"
          />
        )}
      </div>

      <footer
        aria-label={t('shell.statusbar.label')}
        data-focus-zone="panel"
        className="bg-sidebar text-muted-foreground flex h-[24px] flex-none items-center gap-3 border-t border-border px-3 text-[11px]"
      >
        <StatusBar
          extensions={extensions}
          whenContext={whenContext}
          i18n={i18n}
          status={status}
          chords={chords}
        />
      </footer>

      <CommandPalette
        commands={commands}
        extensions={extensions}
        whenContext={whenContext}
        i18n={i18n}
        scopes={host.scopes}
      />

      {/* Команды справки живут вместе с её окнами: нет окон — нет и пунктов в меню. */}
      <HelpDialogs commands={commands} scopes={host.scopes} i18n={i18n} />

      <SettingsDialog
        commands={commands}
        i18n={i18n}
        sections={host.settingsSections ?? NO_SETTINGS}
        scopes={host.scopes}
      />

      {/* Экран клавиш заменяет прежнюю таблицу справки: список сочетаний в приложении
          обязан быть один, иначе второй расходится с первым молча. */}
      {keymap !== null && (
        <KeybindingsDialog commands={commands} keymap={keymap} scopes={host.scopes} i18n={i18n} />
      )}

      {/* Запросы к человеку — тоже вне раскладки, и по той же причине, что тосты: их зовёт
          КОМАНДА, а команду вызывают откуда угодно, в том числе из палитры, когда панели,
          затеявшей действие, на экране нет вовсе. */}
      <PromptHost prompt={promptService} scopes={host.scopes} i18n={i18n} />

      {/* Вне раскладки: тосты живут в своём слое поверх всего и места в сетке не занимают. */}
      {notifications !== undefined && (
        <NotificationCenter
          notifications={notifications}
          i18n={i18n}
          label={t('shell.notifications.label')}
        />
      )}
    </div>
  );
}
