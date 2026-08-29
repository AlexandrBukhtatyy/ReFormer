/**
 * Плагин превью: точка расширения поверхностей, три реализации и панель, которая их показывает.
 *
 * **Почему это плагин, а не часть Host.** Всё содержимое каталога — предметное знание: что такое
 * схема формы, какие файлы её составляют, чем рисуется `$component(...)`, что считать точкой
 * входа. В платформе оно означало бы, что второй вид превью вносится правкой ядра. Граница
 * проверяется линтером: `src/plugins/**` не видит `@/host/*` — только `@/sdk` и `@/lib`.
 *
 * ## Точка расширения объявлена здесь, но принадлежит не нам
 *
 * `preview.surface` перечислена в сводке точек `core-contracts.md` наравне с `editor` и `panel`,
 * то есть это точка ПЛАТФОРМЫ. Объявление живёт в `./contract` структурной копией только потому,
 * что `@/sdk` её пока не отдаёт (и `defineExtensionPoint` оттуда не экспортируется вовсе).
 * Поэтому она и передаётся ПАРАМЕТРОМ: когда настоящая появится в SDK, композиция подставит
 * её сюда, и ни одна строка плагина не изменится.
 *
 * ## Панель регистрируется один раз, `when` управляет видимостью
 *
 * Не «регистрируется вместе с документом». Вклад вносится при активации и живёт до выключения
 * плагина, а `when` каждый кадр отвечает только на вопрос «показывать ли сейчас». Иначе рейл
 * мигал бы при каждом переключении вкладки — дефект v1, где видимость панели была зашита
 * в раскладку.
 *
 * @module plugins/preview/plugin
 */

import { createElement, type ReactElement } from 'react';
import { MonitorPlay } from 'lucide-react';
import {
  definePlugin,
  PanelPoint,
  SelectionServiceToken,
  type CommandContribution,
  type PanelContribution,
  type Plugin,
  type SlotId,
  type WhenContext,
} from '@/sdk';
import { createCompilingSurface } from './compiling/surface';
import type { ExtensionPointRef, PreviewSurface, SurfaceCatalog } from './contract';
import { PreviewSurfacePoint } from './contract';
import { documentRefOf } from './context';
import type { MessageSink, PreviewHost } from './host';
import { PREVIEW_MESSAGES } from './messages';
import { createRuntimeSurface } from './runtime/surface';
import { chooseSurface, nextSurfaceId } from './selection';
import { createPreviewSessions, type PreviewSessions } from './sessions';
import { createSkeletonSurface } from './skeleton/surface';
import { PreviewPanel } from './ui/PreviewPanel';

/** Идентификатор плагина: пространство имён во всех реестрах и в словаре. */
export const PREVIEW_PLUGIN_ID = 'preview';

/** Панель превью. */
export const PREVIEW_PANEL_ID = 'preview.panel';

/** Команда «следующая поверхность». */
export const CYCLE_SURFACE_COMMAND_ID = 'preview.surface.cycle';

/**
 * Слот по умолчанию — нижний док.
 *
 * Превью документное, как инспектор, но соседствовать с ним в правой панели ему тесно: форма
 * рисуется в натуральную величину, и колонка в двести пикселей превращает её в лестницу.
 * Слот переопределяется настройкой плагина — раскладка это дело композиции, а не превью.
 */
export const DEFAULT_PREVIEW_SLOT: SlotId = 'panel.bottom';

/**
 * Виды ресурса, при которых панель видима.
 *
 * `form.schema` — идентификатор провайдера модели схемы: именно его оболочка кладёт
 * в `activeResourceKind` для МОДЕЛЬНОГО документа. `application/json` — то, что там лежит,
 * пока композиция не подключила `document.model`. Вторая строка уйдёт вместе с этим «пока».
 */
const PANEL_RESOURCE_KINDS: ReadonlySet<string> = new Set(['form.schema', 'application/json']);

/** Значок панели. Обёртка ради размера: контракт объявляет значок компонентом без пропсов. */
const PreviewIcon = (): ReactElement => createElement(MonitorPlay, { className: 'size-4' });

/** Видима ли панель при таком контексте. Чистая и дешёвая — её зовут на каждый кадр. */
export function panelVisible(ctx: WhenContext): boolean {
  return ctx.activeResourceKind !== null && PANEL_RESOURCE_KINDS.has(ctx.activeResourceKind);
}

/** Три встроенные поверхности в порядке возрастания способностей. */
export function builtinSurfaces(host: PreviewHost): readonly PreviewSurface[] {
  return [createSkeletonSurface(host), createRuntimeSurface(host), createCompilingSurface(host)];
}

/** Вклад панели. Отдельно от плагина, чтобы тест звал его без реестров. */
export function previewPanel(
  host: PreviewHost,
  sessions: PreviewSessions,
  surfaces: SurfaceCatalog,
  slot: SlotId
): PanelContribution {
  return {
    id: PREVIEW_PANEL_ID,
    slot,
    titleKey: 'panel.title',
    icon: PreviewIcon,
    when: panelVisible,
    order: 10,
    Body: () => createElement(PreviewPanel, { host, sessions, surfaces }),
  };
}

/**
 * Команды плагина.
 *
 * Одна, и она про ПЕРЕКЛЮЧЕНИЕ, а не про выбор конкретной поверхности: команда с аргументом
 * «какую» дублировала бы переключатель и разошлась бы с ним, когда состав поверхностей
 * изменится. Заголовок разрешается словарём плагина — владельца команды проставляет реестр.
 */
export function previewCommands(
  host: PreviewHost,
  sessions: PreviewSessions,
  surfaces: SurfaceCatalog
): readonly CommandContribution[] {
  return [
    {
      id: CYCLE_SURFACE_COMMAND_ID,
      titleKey: 'command.cycle',
      enabled: panelVisible,
      run() {
        const id = sessions.active();
        if (id === null) return;
        const document = host.documentOf(id);
        if (document === null) return;
        const store = sessions.storeFor(id);
        const choice = chooseSurface({
          surfaces: surfaces.list(),
          doc: documentRefOf(document),
          source: host.sourceOf(id),
          preferred: store.get().surfaceId,
        });
        const next = nextSurfaceId(choice.options, choice.surface?.id ?? null);
        if (next !== null) store.chooseSurface(next);
      },
    },
  ];
}

export interface PreviewPluginOptions {
  readonly host: PreviewHost;
  /**
   * Точка расширения поверхностей.
   *
   * Параметром, а не импортом из `./contract` прямо в `activate`: вклад обязан уходить в ТОТ
   * объект, который дала композиция, — иначе, когда точка переедет в `@/sdk`, чужие поверхности
   * окажутся в одной точке, а наши в другой. Умолчание — наша же копия, чтобы плагин работал
   * и до переезда.
   */
  readonly surfacePoint?: ExtensionPointRef<PreviewSurface>;
  /** Слот панели; по умолчанию {@link DEFAULT_PREVIEW_SLOT}. */
  readonly slot?: SlotId;
  /** Приёмник словаря. Без него строки показываются маркерами промаха — см. `./messages`. */
  readonly i18n?: MessageSink;
  /**
   * Реестр состояний. Обычно создаётся плагином; параметр — ради тестов.
   *
   * Тот же приём и по той же причине, что `viewStates` у плагина Monaco: реестр — внутреннее
   * владение плагина, но проверить публикацию выделения можно только на ТОМ ЖЕ объекте,
   * который получила панель. Второй `createPreviewSessions()` прошёл бы и на неработающем
   * подключении канала.
   */
  readonly sessions?: PreviewSessions;
}

/**
 * Собирает плагин.
 *
 * `activate` только регистрирует: реестр состояний создаётся пустым, состояние документа
 * рождается при первом показе панели. Словарь регистрируется здесь же, если приёмник дан, —
 * он не является подпиской и в `subscriptions` не кладётся.
 */
export function createPreviewPlugin(options: PreviewPluginOptions): Plugin {
  const { host } = options;
  const point = options.surfacePoint ?? PreviewSurfacePoint;
  const slot = options.slot ?? DEFAULT_PREVIEW_SLOT;
  const sessions = options.sessions ?? createPreviewSessions();

  return definePlugin({
    id: PREVIEW_PLUGIN_ID,
    activate(ctx) {
      for (const [locale, messages] of Object.entries(PREVIEW_MESSAGES)) {
        options.i18n?.contribute(locale, messages);
      }

      // Список читается ЛЕНИВО, через реестр: поверхности вносят и снимают, в том числе чужие
      // плагины, и захваченный массив показывал бы состав на момент активации.
      const surfaces: SurfaceCatalog = {
        list: () => ctx.extensions.get(point).map((contribution) => contribution.value),
        observe: (cb: () => void) => ctx.extensions.observe(point, cb),
      };

      for (const surface of builtinSurfaces(host)) {
        ctx.subscriptions.push(ctx.extensions.contribute(point, surface, { id: surface.id }));
      }

      for (const command of previewCommands(host, sessions, surfaces)) {
        ctx.subscriptions.push(ctx.commands.register(command));
      }

      const panel = previewPanel(host, sessions, surfaces, slot);
      ctx.subscriptions.push(ctx.extensions.contribute(PanelPoint, panel, { id: panel.id }));

      // Клик по превью уходит в общий канал выделения. `get`, а не `require`: плагину
      // доступен только он, и отсутствие службы — штатная деградация, а не отказ. Так
      // собирается и тест плагина, где реестра сервисов нет вовсе: превью работает,
      // просто выбранный узел никуда не сообщается.
      const selection = ctx.services.get(SelectionServiceToken);
      if (selection !== undefined) ctx.subscriptions.push(sessions.connectSelection(selection));
    },
    deactivate() {
      // Состояния не выражаются подпиской: они переживают перерисовку и переключение вкладки,
      // и снять их может только тот, кто их держит.
      sessions.dispose();
    },
  });
}
