/**
 * Плагин журнала: нижняя панель со сводом проблем проекта и лентой событий.
 *
 * **Почему это плагин, а не часть Host.** Журнал — платформенная служба (`reformer.log`): писать
 * в него может оболочка и любой плагин. А вот РЕШЕНИЕ «показывать его внизу, вместе с находками,
 * вот так» — предметное, и у корневого реестра вкладов нет `contribute` вовсе: на вопрос
 * «откуда здесь эта панель» ответ — «её внёс `journal`».
 *
 * **Почему проблемы здесь, а не у плагина файлов.** Раньше панель проблем вносил `files`: он
 * владеет показом проекта, и пометка на файле в дереве — продолжение того же решения. Пометка
 * там и осталась. А список находок стал одним из двух видов журнала: «что сейчас не так» рядом
 * с «что произошло» — то, что человек ищет в одном месте, когда что-то пошло не так.
 *
 * **Команд быстрых исправлений здесь нет.** Их владелец тот, кто умеет править документ. Журнал
 * их только ПОКАЗЫВАЕТ и запускает через общий реестр, поэтому исправление, чей владелец
 * выключен, у него просто не рисуется.
 *
 * @module plugins/base/journal/plugin
 */

import { createElement, type ReactElement } from 'react';
import { ScrollText } from 'lucide-react';
import {
  definePlugin,
  DiagnosticsServiceToken,
  errorDetail,
  LogServiceToken,
  PanelPoint,
  pluginMessageKey,
  type DiagnosticsService,
  type LogService,
  type PanelContribution,
  type Plugin,
} from '@reformer/builder-plugin-api';
import { JOURNAL_PLUGIN_ID } from './contract';
import type { JournalHost } from './host';
import { journalHostFromContext } from './host-from-context';
import { JOURNAL_MESSAGES } from './messages';
import type { CommandAccess } from './problems';
import { JournalBadge } from './ui/JournalBadge';
import { JournalPanel } from './ui/JournalPanel';
import { createJournalViewState, type JournalViewState } from './view-state';

/** Идентификатор плагина: пространство имён во всех реестрах и в словаре. */
// Идентификатор живёт в `./contract` — листе, который берёт композиция: импорт значения
// отсюда втянул бы в стартовый граф весь плагин.
export { JOURNAL_PLUGIN_ID } from './contract';

/** Панель журнала в нижнем доке. */
export const JOURNAL_PANEL_ID = 'journal.panel';

/**
 * Значок панели в рейле.
 *
 * Обёртка ради размера: контракт панели объявляет значок компонентом БЕЗ пропсов, а значок
 * lucide по умолчанию 24 пикселя — в кнопке это перелив.
 */
const JournalIcon = (): ReactElement => createElement(ScrollText, { className: 'size-4' });

export interface JournalPanelDeps {
  readonly host: JournalHost;
  readonly diagnostics: DiagnosticsService | null;
  readonly log: LogService | null;
  readonly commands?: CommandAccess | null;
  readonly view: JournalViewState;
}

/**
 * Панель журнала. Слот нижний — там, где её ищут: находки и события читают ВМЕСТЕ с текстом,
 * а не вместо него, поэтому боковой док, отнимающий ширину у редактора, ей не подходит.
 *
 * `fill` — потому что у тела своя строка переключателя, которая не должна уезжать вместе
 * со списком: прокрутку панель ведёт сама.
 */
export function journalPanel(deps: JournalPanelDeps): PanelContribution {
  return {
    id: JOURNAL_PANEL_ID,
    slot: 'panel.bottom',
    titleKey: 'panel.title',
    // Значок виден и когда док свёрнут в полосу — ради этого свёрнутый вид и заведён.
    Badge: () => createElement(JournalBadge, { diagnostics: deps.diagnostics }),
    icon: JournalIcon,
    Body: () => createElement(JournalPanel, deps),
    fill: true,
    order: 10,
  };
}

export interface JournalPluginOptions {
  /**
   * Порт плагина. Необязателен и ЗАПАСНОЙ: по умолчанию плагин собирает его сам из контекста
   * (`./host-from-context`), как обязан любой плагин из каталога. Параметр — только для тестов.
   */
  readonly host?: JournalHost;
}

/**
 * Собирает плагин.
 *
 * `activate` только регистрирует — как и требует контракт. Службы спрашиваются здесь же, но
 * только `get`: их отсутствие — штатная деградация (журнал без находок, без ленты), а не повод
 * падать.
 */
export function createJournalPlugin(options: JournalPluginOptions = {}): Plugin {
  return definePlugin({
    id: JOURNAL_PLUGIN_ID,
    activate(ctx) {
      // Словарь — первым делом: им переводятся заголовок панели и подписи видов.
      for (const [locale, messages] of Object.entries(JOURNAL_MESSAGES)) {
        ctx.i18n.contribute(locale, messages);
      }

      const host = options.host ?? journalHostFromContext(ctx);
      const diagnostics = ctx.services.get(DiagnosticsServiceToken) ?? null;
      const log = ctx.services.get(LogServiceToken) ?? null;

      // Реестр команд для быстрых исправлений. Спрашивается ЛЕНИВО, на каждый вопрос:
      // между отрисовкой строки и нажатием плагин, владеющий командой, могли выключить,
      // и журнал обязан это увидеть, а не помнить ответ, данный при активации.
      const commands: CommandAccess = {
        has: (commandId) => ctx.commands.get(commandId) !== undefined,
        run: (commandId, args) => {
          void ctx.commands.execute(commandId, args).catch((error: unknown) => {
            console.error(`[journal] исправление «${commandId}» отказало`, error);
            log?.append({
              level: 'error',
              source: ctx.id,
              messageKey: pluginMessageKey(ctx.id, 'fix.failed'),
              params: { commandId },
              detail: errorDetail(error),
            });
          });
        },
      };

      ctx.subscriptions.push(
        ctx.extensions.contribute(
          PanelPoint,
          journalPanel({ host, diagnostics, log, commands, view: createJournalViewState() }),
          { id: JOURNAL_PANEL_ID }
        )
      );
    },
  });
}
