/**
 * Плагин ассистента: канал к модели, лента разговора и мост к рабочей области — общий для стеков
 * форм.
 *
 * **Почему ассистент общий.** Канал к модели, лента, вопросы человеку, отмена хода и
 * «Восстановить» одинаковы для любого формата формы. Что такое форма, какие у модели инструменты
 * и как правка ложится в документ, знает стек форм: он вносит себя в точку
 * `FormAssistantStackPoint`, и ассистент спрашивает её на каждый ход — как превью спрашивает
 * поверхности. Стек ReFormer — плагин `reformer.ai-schema` (`plugins/reformer/ai`). Граница
 * проверяется линтером: ассистент не видит ни оболочки, ни ядра чужого домена — только
 * `@reformer/builder-plugin-api` и `@reformer/builder-toolkit`.
 *
 * ## Из чего плагин собран
 *
 * - **каналы** (`providers/`) — провайдеры моделей и настройки канала;
 * - **мост** (`session/bridge.ts`) — единственное место, где ход встречается с рабочей областью:
 *   активная вкладка и стек, который за неё берётся, история диалога, применение и отмена;
 * - **цикл попытки** (`loop/`) — поток модели и очередь вызовов, общие для всех стеков;
 * - **инструменты ассистента** (`tools/`) — вопрос человеку, генерация кода, новая форма,
 *   ресурсы, вклады плагинов и команды;
 * - **панель** (`ui/`) — вклад в `PanelPoint`.
 *
 * Платформа приходит ПОРТОМ (`./host`), а не импортом: рабочей области и локализации в `@reformer/builder-plugin-api`
 * нет, а дотягиваться до `@/shell` плагину нельзя.
 *
 * ## Почему сервис, а не набор экспортов
 *
 * Канал к модели — состояние, и владеть им должен кто-то, кого можно выключить. Модульные
 * синглтоны v1 (`Map` каналов) переживали бы и деактивацию плагина, и второй экземпляр Host в том
 * же процессе. Здесь всё это живёт в замыкании `activate` и снимается вместе с ним.
 *
 * @module plugins/forms/ai/plugin
 */

import { createElement, type ReactElement } from 'react';
import { Sparkles } from 'lucide-react';
import {
  ASSISTANT_ATTACH_COMMAND_ID,
  AssistantResourcePoint,
  AssistantToolPoint,
  definePlugin,
  FormAssistantStackPoint,
  FormCreatorCapability,
  ModuleGeneratorCapability,
  NotificationsServiceToken,
  PanelPoint,
  pluginMessageKey,
  type AssistantAttachArgs,
  type CommandContribution,
  type PanelContribution,
  type Plugin,
  type PluginContext,
} from '@reformer/builder-plugin-api';
import { aiUndoTurnCommand, createAgentBridge, type AgentBridge } from './session/bridge';
import {
  clearProviderConfig,
  loadProviderConfig,
  saveProviderConfig,
  type ProviderConfig,
  type SaveOptions,
} from './session/config';
import type { AgentCommand } from './tools/command-tools';
import type { AiHost } from './host';
import { aiWorkspace } from './workspace';
import { AI_MESSAGES } from './messages';
import { activateProvider, fetchModels, restoreProvider } from './providers/load';
import { createProviderRegistry, type ProviderRegistry } from './providers/registry';
import type { AiProvider } from './providers/types';
import { ATTACHMENT_LIMIT, createAiSession, type AiSession } from './session/session';
import { ChatActions } from './ui/ChatActions';
import { ChatPanel } from './ui/ChatPanel';

// Реэкспорт, а не объявление: идентификатор живёт в contract.ts, чтобы композиция могла
// взять его, не втягивая плагин в стартовый граф.
import { AI_PLUGIN_ID } from './contract';
export { AI_PLUGIN_ID };

/** Панель чата: правый док, рядом с инспектором. */
export const AI_PANEL_ID = 'ai.chat';

/** Команда «остановить ход». */
export const AI_STOP_COMMAND_ID = 'ai.stop';

/** Команда «новый разговор». */
export const AI_RESET_COMMAND_ID = 'ai.reset';

/**
 * Токен сервиса — тип извлечён из `PluginContext`, а не импортирован.
 *
 * `@reformer/builder-plugin-api` не экспортирует ни `ServiceToken`, ни `defineService`, а дотягиваться до `@/shell`
 * плагину нельзя. Извлечение даёт ТОТ ЖЕ тип, а не его копию (тот же приём, что у плагина файлов
 * с типом команды), поэтому реестр и плагин разойтись не могут. `__type` в рантайме не существует
 * — он только связывает токен с типом реализации, чтобы `register` не принял чужую.
 */
type ServiceTokenOf<T> = Parameters<PluginContext['services']['register']>[0] & {
  readonly __type?: T;
};

/** Токен сервиса ассистента — по нему его находит панель и внешний потребитель. */
export const AI_SERVICE_TOKEN: ServiceTokenOf<AiAssistant> = Object.freeze({ id: 'ai.assistant' });

/** Что плагину приходится получить снаружи. */
export interface AiPluginOptions {
  /**
   * Рабочая область ЦЕЛИКОМ — только для теста, зовущего плагин без реестра служб.
   *
   * В приложении её собирает сам плагин из возможностей контекста (`./workspace`), и порта
   * у него больше нет ни одного члена.
   */
  readonly host?: AiHost;
}

/**
 * Ассистент как сервис: всё, что мост и панель могут у него попросить.
 *
 * Обратите внимание, чего здесь НЕТ: метода «правь форму» — и инструментов, каталога, корпуса
 * знаний. Что видит модель и как правка ложится в форму, знает стек форм (`./stack`), а решение
 * «какая форма считается текущей» и «когда писать результат» — мост. Сервис — это канал к модели.
 */
export interface AiAssistant {
  /** Каналы к модели: пуст, пока пользователь не настроил ключ. */
  readonly providers: ProviderRegistry;

  /** Настройки канала вместе с ключом; `null` — канал не настроен. */
  loadConfig(): Promise<ProviderConfig | null>;
  /** Сохранить настройки. Ключ уходит в секреты — по умолчанию на сессию, см. `config`. */
  saveConfig(config: ProviderConfig, opts?: SaveOptions): Promise<void>;
  /** Забыть ключ и настройки, сняв активный канал. */
  clearConfig(): Promise<void>;
  /** Список моделей канала — запрашивается у провайдера, а не берётся из зашитого списка. */
  models(config: ProviderConfig): Promise<string[]>;
  /** Сделать канал активным. Одновременно активен ровно один. */
  activate(config: ProviderConfig): Promise<AiProvider>;
  /** Поднять канал из сохранённых настроек; `null` — поднимать нечего. */
  restore(): Promise<AiProvider | null>;
}

/** Собрать сервис ассистента — отдельно от плагина, чтобы тест звал его без реестров. */
export function createAiAssistant(store: Parameters<typeof loadProviderConfig>[0]): AiAssistant {
  const providers = createProviderRegistry();
  return {
    providers,
    loadConfig: () => loadProviderConfig(store),
    saveConfig: (config, opts) => saveProviderConfig(store, config, opts),
    async clearConfig() {
      await clearProviderConfig(store);
      providers.reset();
    },
    models: (config) => fetchModels(config),
    activate: (config) => activateProvider(providers, config),
    restore: () => restoreProvider(providers, store),
  };
}

/**
 * Значок панели.
 *
 * Обёртка ради размера: контракт панели объявляет значок компонентом БЕЗ пропсов, а значок
 * lucide по умолчанию 24 пикселя — в кнопке рейла это перелив.
 */
const ChatIcon = (): ReactElement => createElement(Sparkles, { className: 'size-4' });

/** Панель чата. Отдельно от `activate`, чтобы тест звал её без реестров. */
export function aiChatPanel(
  host: AiHost,
  session: AiSession,
  bridge: AgentBridge,
  assistant: AiAssistant
): PanelContribution {
  return {
    id: AI_PANEL_ID,
    slot: 'panel.right',
    titleKey: 'panel.title',
    icon: ChatIcon,
    // `when` нет намеренно: ассистент осмыслен и без открытой формы — там настраивают канал,
    // а на вопрос без формы он отвечает словами. Прятать панель значило бы прятать настройки.
    order: 20,
    // Вкладка прижата к низу рейла: ассистента ЗОВУТ, а не просматривают. Инспектор
    // и экспорт перебирают глазами по ходу работы, к ассистенту приходят намеренно —
    // и приходят тем чаще, чем надёжнее он на одном и том же месте. Большим `order`
    // это не выражается: «последняя в списке» и «у нижнего края» совпадают только пока
    // рейл заполнен целиком.
    railPlacement: 'bottom',
    // Вся высота дока, колонкой: прокручивается лента, а поле ввода стоит внизу. Без признака
    // оболочка кладёт тело в свою прокрутку, высота колонки растёт по содержимому — и лента, и
    // развёрнутое рассуждение вылезали за свои рамки, а поле ввода уезжало за край панели.
    fill: true,
    Body: () => createElement(ChatPanel, { host, session, bridge, assistant }),
    // Действия — в шапке дока, а не первой строкой ленты: заголовок панели и ряд кнопок
    // над её содержимым — один ярус интерфейса, и разложенный на два он отнимал у разговора
    // высоту строки на каждом кадре.
    Actions: () => createElement(ChatActions, { host, session, bridge }),
  };
}

/**
 * Команды плагина. Отдельно от `activate`, чтобы тест звал их без реестров.
 *
 * Блока `agent` у них нет, и это осознанно: «остановить ход», «новый разговор» и «отменить
 * последний ход» — команды ПРО ассистента, а не про форму, и давать их модели значило бы
 * позволить ей прервать саму себя или переиграть собственный ход. Поверхность инструментов
 * растёт только тогда, когда кто-то написал `agent` руками.
 *
 * «Отменить последний ход» объявлена не здесь, а рядом с состоянием, которым распоряжается
 * (`./bridge`): она единственная из трёх правит форму, и ей нужно знать, что именно ход
 * оставил в буфере. Регистрируется она вместе с остальными — этой же строкой списка.
 *
 * «Прикрепить ресурс» — адрес для других плагинов (`ASSISTANT_ATTACH_COMMAND_ID`): им, например,
 * пункт меню дерева файлов прикрепляет файл к следующей реплике. Модели не отдаётся по той же
 * причине: что показать модели, решает человек.
 *
 * @param notify - Сказать человеку, чем кончилось прикрепление: панель может быть закрыта, и
 *   без тоста щелчок по пункту меню выглядел бы ничем.
 */
export function aiCommands(
  bridge: AgentBridge,
  notify: AttachNotify = () => {}
): readonly CommandContribution[] {
  return [
    {
      id: AI_STOP_COMMAND_ID,
      titleKey: 'command.stop',
      enabled: () => bridge.isRunning(),
      run: () => {
        bridge.abort();
      },
    },
    {
      id: AI_RESET_COMMAND_ID,
      titleKey: 'command.reset',
      enabled: () => !bridge.isRunning(),
      run: () => {
        bridge.reset();
      },
    },
    aiUndoTurnCommand(bridge),
    aiAttachCommand(bridge, notify),
  ];
}

/** Сообщение человеку о прикреплении: ключ словаря плагина, параметры и уровень тоста. */
export type AttachNotify = (
  key: string,
  params: Record<string, unknown>,
  level: 'info' | 'warning'
) => void;

/** Аргументы `ai.attach`, если они годны: адрес — непустая строка, имя — строка или ничего. */
function attachArgsOf(args: unknown): AssistantAttachArgs | null {
  if (typeof args !== 'object' || args === null) return null;
  const { uri, name } = args as { uri?: unknown; name?: unknown };
  if (typeof uri !== 'string' || uri === '') return null;
  return typeof name === 'string' && name !== '' ? { uri, name } : { uri };
}

/** Команда «прикрепить ресурс к следующей реплике». */
export function aiAttachCommand(bridge: AgentBridge, notify: AttachNotify): CommandContribution {
  return {
    id: ASSISTANT_ATTACH_COMMAND_ID,
    titleKey: 'command.attach',
    run: (args) => {
      const ref = attachArgsOf(args);
      // Из палитры команду зовут без адреса — это не ошибка, а вопрос «как прикрепить».
      if (ref === null) {
        notify('chat.attach.howTo', {}, 'info');
        return 'invalid';
      }
      const outcome = bridge.attach(ref);
      const name = ref.name ?? ref.uri;
      switch (outcome) {
        case 'attached':
          notify('chat.attach.attached', { name }, 'info');
          break;
        case 'duplicate':
          notify('chat.attach.duplicate', { name }, 'info');
          break;
        case 'limit':
          notify('chat.attach.limit', { limit: ATTACHMENT_LIMIT }, 'warning');
          break;
        case 'invalid':
        case 'unknown-scheme':
          notify('chat.attach.unknownScheme', { uri: ref.uri }, 'warning');
          break;
      }
      return outcome;
    },
  };
}

/**
 * Плагин ассистента.
 *
 * `activate` только регистрирует — как и требует контракт. Восстановление канала из сохранённых
 * настроек запускается, но НЕ ожидается: `activate` синхронный, а канал сам доложит о себе через
 * сервис, когда поднимется. Отказ восстановления не должен ронять активацию — канала просто не
 * будет, и панель скажет об этом словами.
 */
export function createAiPlugin(options: AiPluginOptions = {}): Plugin {
  return definePlugin({
    id: AI_PLUGIN_ID,
    activate(ctx: PluginContext) {
      // Рабочая область собирается ЗДЕСЬ: службы живут в контексте активации, и раньше него
      // их нет. Названных дыр у ассистента не осталось — порт закрыт целиком.
      const host = options.host ?? aiWorkspace(ctx);
      for (const [locale, messages] of Object.entries(AI_MESSAGES)) {
        ctx.i18n.contribute(locale, messages);
      }

      const assistant = createAiAssistant(ctx);
      const session = createAiSession();
      const bridge = createAgentBridge({
        assistant,
        host,
        session,
        // Стеки форм — вклады точки, на каждый ход: стек приходит и уходит вместе со своим
        // плагином, а документ берёт тот, кто за него берётся (по провайдеру модели).
        stacks: () => ctx.extensions.get(FormAssistantStackPoint).map((entry) => entry.value),
        // Читается ЛЕНИВО, на каждый ход: команды приходят и уходят вместе с плагинами,
        // а захваченный на активации список описывал бы набор, которого уже нет.
        agentCommands: () => ctx.commands.agentCommands() as readonly AgentCommand[],
        executeCommand: (id, args) => ctx.commands.execute(id, args),
        // Вклады других плагинов — тоже на каждый ход и по той же причине. Присваивание без
        // приведения: так компилятор сверяет структурные копии моста с контрактом SDK.
        assistantTools: () => ctx.extensions.get(AssistantToolPoint),
        resourceProviders: () => ctx.extensions.get(AssistantResourcePoint),
        // Генерация кода — возможность чужого плагина: спрашивается на каждый ход, его могут
        // поднять позже ассистента или не поднять вовсе.
        generator: () => ctx.services.get(ModuleGeneratorCapability),
        formCreator: () => ctx.services.get(FormCreatorCapability),
      });

      ctx.subscriptions.push(ctx.services.register(AI_SERVICE_TOKEN, assistant));
      // Служба уведомлений спрашивается в момент сообщения: она — оболочки, но приложение на той
      // же оболочке вправе её не дать, и тогда прикрепление просто молчит.
      const notify: AttachNotify = (key, params, level) => {
        ctx.services
          .get(NotificationsServiceToken)
          ?.[level](pluginMessageKey(ctx.id, key), { params });
      };
      for (const command of aiCommands(bridge, notify)) {
        ctx.subscriptions.push(ctx.commands.register(command));
      }
      ctx.subscriptions.push(
        ctx.extensions.contribute(PanelPoint, aiChatPanel(host, session, bridge, assistant), {
          id: AI_PANEL_ID,
        })
      );

      // Заказ, а не ожидание: `activate` только регистрирует, и держать на себе сеть ей нельзя.
      // Движок проверки АРГУМЕНТОВ инструмента (реестр инструментов в toolkit) уехал из главного
      // чанка, и грузить его решает владелец: реестр не решает, когда его грузить, а `invoke`
      // остаётся вызовом инструмента, а не местом, где впервые встречается сеть.
      //
      // Отказ гасит сам `prepare` — он не отвергается, поэтому `catch` здесь не нужен:
      // не загрузившийся движок скажет о себе первым же вызовом инструмента, а следующий
      // вызов закажет загрузку заново.
      void bridge.prepare();

      // Не ждём: см. заметку выше. Отказ гасится здесь, чтобы необработанный промис не всплыл
      // как ошибка запуска приложения.
      void assistant.restore().catch((error: unknown) => {
        console.warn('[plugins/forms/ai] канал не восстановлен', error);
      });
    },
  });
}
