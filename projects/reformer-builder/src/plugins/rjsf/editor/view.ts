/**
 * Чем показана форма RJSF: структурой или отрисованной формой — двумя кнопками в полосе вкладок.
 *
 * ## Положение вкладки, а не сплит
 *
 * Раньше вкладка держала всё сразу: список полей, свойства выбранного и живую форму рядом.
 * Теперь тело вкладки показывает одно из двух, а свойства поля уехали в правую панель оболочки —
 * та же раскладка, что у редактора схемы ReFormer, и переключатель стоит там же: в ряду действий
 * над документом, где отвечают на вопрос «чем показан этот файл».
 *
 * ## Состояние живёт в плагине, а не в теле редактора
 *
 * Кнопка в полосе вкладок — пункт меню, то есть команда; команда про смонтированные компоненты
 * не знает, а тело редактора оболочка пересоздаёт на каждую пару «редактор + документ».
 *
 * ## Предпочтение одно на все формы и липкое
 *
 * Способ смотреть принадлежит человеку, а не документу: привык к структуре — хочет структуру
 * и в следующей форме. Область настройки — `user`.
 *
 * ## Форма существует, только когда её есть чем нарисовать
 *
 * Рисует её поверхность превью — чужой плагин, выключаемый на ходу. Без поверхности кнопок нет
 * вовсе, а запомненное «форма» читается как «структура»: иначе вкладка осталась бы с пустым
 * телом и без кнопки, которой из него выходят.
 *
 * @module plugins/rjsf/editor/view
 */

import { createElement, type ReactElement } from 'react';
import { List, SquareMousePointer } from 'lucide-react';
import {
  EDITOR_TITLE_MENU,
  whenEditor,
  type CommandContribution,
  type Disposable,
  type MenuContribution,
} from '@reformer/builder-plugin-api';
import {
  RJSF_EDITOR_ID,
  RJSF_FORM_ITEM_ID,
  RJSF_SHOW_FORM_COMMAND_ID,
  RJSF_SHOW_STRUCTURE_COMMAND_ID,
  RJSF_STRUCTURE_ITEM_ID,
} from './contract';

/** Чем показана форма во вкладке. */
export type RjsfView = 'structure' | 'form';

/** Ключ настройки. Область — `user`: способ смотреть принадлежит человеку. */
export const RJSF_VIEW_SETTING = 'rjsf.editor.view';

/**
 * Вид по умолчанию — структура: форму открывают, чтобы править поля, а отрисованная форма
 * зависит от того, дал ли состав поверхность. Умолчание, которого на части запусков нет, — не
 * умолчание.
 */
export const DEFAULT_RJSF_VIEW: RjsfView = 'structure';

/** Значение настройки → вид. Мусор трактуется как умолчание, а не как повод падать. */
export function readRjsfView(value: unknown): RjsfView {
  return value === 'structure' || value === 'form' ? value : DEFAULT_RJSF_VIEW;
}

/** Настройки в объёме, нужном виду. */
export interface RjsfViewSettings {
  get<T>(key: string): T | undefined;
  set(key: string, value: unknown): Promise<void> | void;
}

export interface RjsfViewStore extends Disposable {
  /** Действующий вид: запомненная «форма» без поверхности читается как «структура». */
  view(): RjsfView;
  setView(next: RjsfView): void;
  subscribe(listener: () => void): Disposable;
}

export interface RjsfViewStoreOptions {
  /** Настройки; `null` — предпочтение живёт только до перезагрузки. */
  readonly settings?: RjsfViewSettings | null;
  /** Есть ли чем нарисовать форму. Спрашивается на каждый вопрос: превью выключаемо на ходу. */
  readonly hasLive: () => boolean;
}

export function createRjsfViewStore(options: RjsfViewStoreOptions): RjsfViewStore {
  const settings = options.settings ?? null;
  const listeners = new Set<() => void>();
  // Своя копия рядом с настройками: кнопка обязана ответить в том же кадре, а запись в
  // хранилище асинхронна.
  let chosen: RjsfView | null = null;

  const stored = (): RjsfView => chosen ?? readRjsfView(settings?.get(RJSF_VIEW_SETTING));

  const notify = (): void => {
    for (const listener of [...listeners]) {
      try {
        listener();
      } catch (error) {
        // Упавший подписчик — чужая поломка: она не должна мешать остальным узнать о смене.
        console.error('[rjsf] подписчик вида отказал', error);
      }
    }
  };

  return {
    view() {
      const view = stored();
      return view === 'form' && !options.hasLive() ? 'structure' : view;
    },

    setView(next) {
      // Сравнение с запомненным, а не с действующим: «структура» поверх запомненной «формы»
      // без поверхности — это выбор, и поверхность, вернувшись, не должна его отменить.
      if (stored() === next) return;
      chosen = next;
      void Promise.resolve(settings?.set(RJSF_VIEW_SETTING, next)).catch((error: unknown) => {
        // Отказ хранилища не мешает переключению: предпочтение просто не переживёт перезагрузку.
        console.error('[rjsf] предпочтение вида не сохранено', error);
      });
      notify();
    },

    subscribe(listener) {
      listeners.add(listener);
      return {
        dispose: () => {
          listeners.delete(listener);
        },
      };
    },

    dispose() {
      listeners.clear();
      chosen = null;
    },
  };
}

export interface RjsfViewDeps {
  readonly view: RjsfViewStore;
  /** Форма ли домена на активной вкладке: команды вида чужие вкладки не трогают. */
  readonly activeIsRjsf: () => boolean;
  /** Тот же ответ, что у стора: кнопка и команда обязаны считать доступность одинаково. */
  readonly hasLive: () => boolean;
}

/** Есть ли это положение вообще: форма — только с поверхностью. */
function available(deps: RjsfViewDeps, mode: RjsfView): boolean {
  return mode !== 'form' || deps.hasLive();
}

/**
 * Команды переключателя — по одной на положение, как у видов редактора схемы: в палитре
 * «показать структуру» и «показать форму» — два разных ответа, а не «задать вид» с параметром.
 *
 * Команда положения, в котором уже находишься, доступна и ничего не меняет — как и кнопка,
 * по которой нажали второй раз.
 */
export function rjsfViewCommands(deps: RjsfViewDeps): readonly CommandContribution[] {
  const command = (id: string, titleKey: string, mode: RjsfView): CommandContribution => ({
    id,
    titleKey,
    enabled: () => deps.activeIsRjsf() && available(deps, mode),
    run: () => {
      // Отказ, а не молчаливая структура: человек просил форму, и подмена вида была бы ответом
      // на другой вопрос.
      if (!deps.activeIsRjsf() || !available(deps, mode)) return false;
      deps.view.setView(mode);
      return true;
    },
  });

  return [
    command(RJSF_SHOW_STRUCTURE_COMMAND_ID, 'command.showStructure', 'structure'),
    command(RJSF_SHOW_FORM_COMMAND_ID, 'command.showForm', 'form'),
  ];
}

/** Значки положений. Обёртки ради размера: контракт объявляет значок компонентом без пропсов. */
const StructureIcon = (): ReactElement => createElement(List, { className: 'size-4' });
const FormIcon = (): ReactElement => createElement(SquareMousePointer, { className: 'size-4' });

/**
 * Кнопки переключателя в полосе вкладок: видны обе, нажата ровно одна.
 *
 * Свою вкладку узнают по редактору, который её рисует: форму можно открыть и текстом, и над
 * Monaco переключать нечего. Без поверхности пропадают ОБЕ: одна кнопка из двух переключателем
 * не является.
 */
export function rjsfViewMenuItems(
  deps: RjsfViewDeps
): readonly { readonly id: string; readonly value: MenuContribution }[] {
  const onRjsfTab = whenEditor((target) => target.editorId === RJSF_EDITOR_ID);

  const position = (
    command: string,
    mode: RjsfView,
    titleKey: string,
    icon: () => ReactElement,
    order: number
  ): MenuContribution => ({
    kind: 'item',
    menu: EDITOR_TITLE_MENU,
    command,
    group: '1_view',
    order,
    titleKey,
    icon,
    when: (ctx, target) => onRjsfTab(ctx, target) && deps.hasLive(),
    toggled: () => deps.view.view() === mode,
    // Вид живёт в плагине, и ряд кнопок о его смене иначе не узнает.
    onDidChange: (cb) => deps.view.subscribe(cb),
  });

  return [
    {
      id: RJSF_STRUCTURE_ITEM_ID,
      value: position(
        RJSF_SHOW_STRUCTURE_COMMAND_ID,
        'structure',
        'action.view.structure',
        StructureIcon,
        0
      ),
    },
    {
      id: RJSF_FORM_ITEM_ID,
      value: position(RJSF_SHOW_FORM_COMMAND_ID, 'form', 'action.view.form', FormIcon, 10),
    },
  ];
}
