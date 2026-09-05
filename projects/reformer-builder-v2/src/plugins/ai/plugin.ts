/**
 * Плагин ассистента: ядро правок формы моделью плюс мост к рабочей области.
 *
 * **Почему это плагин, а не часть Host.** Ассистент — предметное знание целиком: что такое узел
 * формы, чем шаг отличается от вкладки, какие имена компонентов законны, каким оператором
 * выражается валидация. В платформе это означало бы, что второй продукт поверх той же платформы
 * несёт ассистента чужой предметной области. Граница проверяется линтером: `src/plugins/**` не
 * видит `@/shell/*` — только `@/sdk` и `@/lib`.
 *
 * ## Из чего плагин собран
 *
 * - **ядро** (`core/`) — реестр инструментов с проверкой аргументов по схеме, цикл хода, гейт
 *   качества, бюджеты. Чистое: получает схему входом и возвращает набор изменений;
 * - **каналы** (`providers/`) и **корпус знаний** (`knowledge/`);
 * - **мост** (`bridge.ts`) — единственное место, где ход встречается с рабочей областью:
 *   активная вкладка, история диалога, применение результата одной записью;
 * - **панель** (`ui/`) — вклад в `PanelPoint`.
 *
 * Платформа приходит ПОРТОМ (`./host`), а не импортом: рабочей области и локализации в `@/sdk`
 * нет, а дотягиваться до `@/shell` плагину нельзя.
 *
 * ## Почему сервис, а не набор экспортов
 *
 * Каталог кита, корпус знаний и канал к модели — состояние, и владеть им должен кто-то, кого
 * можно выключить. Модульные синглтоны v1 (`getCatalog()`, `loadKnowledge()`, `Map` каналов)
 * переживали бы и деактивацию плагина, и второй экземпляр Host в том же процессе. Здесь всё это
 * живёт в замыкании `activate` и снимается вместе с ним.
 *
 * @module plugins/ai/plugin
 */

import { createElement, type ReactElement } from 'react';
import { Sparkles } from 'lucide-react';
import type { CatalogEntry } from '@/lib/catalog/types';
import {
  definePlugin,
  PanelPoint,
  type CommandContribution,
  type PanelContribution,
  type Plugin,
  type PluginContext,
} from '@/sdk';
import { aiUndoTurnCommand, createAgentBridge, type AgentBridge } from './session/bridge';
import {
  clearProviderConfig,
  loadProviderConfig,
  saveProviderConfig,
  type ProviderConfig,
  type SaveOptions,
} from './session/config';
import { createEditorToolRegistry, type ToolRegistry } from './tools';
import type { AgentCommand } from './tools/command-tools';
import type { LoadValidateForm, ValidateFormSchema } from './model/validate';
import type { AiHost, MessageSink } from './host';
import { createKnowledgeLoader, type KnowledgeLoader } from './knowledge';
import { AI_MESSAGES } from './messages';
import { activateProvider, fetchModels, restoreProvider } from './providers/load';
import { createProviderRegistry, type ProviderRegistry } from './providers/registry';
import type { AiProvider } from './providers/types';
import { createAiSession, type AiSession } from './session/session';
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
 * `@/sdk` не экспортирует ни `ServiceToken`, ни `defineService`, а дотягиваться до `@/shell`
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
  /** Порт платформы: рабочая область, каталог, переводы. */
  readonly host: AiHost;
  /**
   * Приёмник словаря. Без него строки показываются маркерами промаха — так задумано в i18n.
   *
   * Регистрирует словарь композиция, а не `activate`: `PluginContext` сервиса локализации не
   * содержит, и это не упущение — вклад в словарь не снимается вместе с плагином, а значит
   * и не может быть частью его подписок.
   */
  readonly i18n?: MessageSink;
}

/**
 * Ассистент как сервис: всё, что мост и панель могут у него попросить.
 *
 * Обратите внимание, чего здесь НЕТ: метода «правь форму». Ход агента (`runAgentTurn`) принимает
 * схему и возвращает набор изменений, а решение «какая форма считается текущей» и «куда применить
 * результат» — знание рабочей области, и живёт оно в мосте, а не здесь.
 */
export interface AiAssistant {
  /** Реестр инструментов: собран один раз, схемы аргументов статичны в пределах сессии. */
  readonly tools: ToolRegistry;
  /** Каталог, действующий сейчас, — его же ход кладёт в `ToolContext`. */
  catalog(): readonly CatalogEntry[];
  /** Каналы к модели: пуст, пока пользователь не настроил ключ. */
  readonly providers: ProviderRegistry;
  /** Корпус знаний — тот же, что видит `ask_reformer`. */
  readonly knowledge: KnowledgeLoader;

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
export function createAiAssistant(
  host: Pick<AiHost, 'catalog' | 'projectFiles'>,
  store: Parameters<typeof loadProviderConfig>[0]
): AiAssistant {
  const providers = createProviderRegistry();
  const knowledge = createKnowledgeLoader(host.projectFiles?.bind(host));
  // Реестр строится один раз: каталог приходит контекстом ВЫЗОВА, а схемы аргументов статичны,
  // поэтому пересобирать его при смене кита не нужно.
  const tools = createEditorToolRegistry({ knowledge });

  return {
    tools,
    catalog: () => host.catalog(),
    providers,
    knowledge,
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
 * Загрузка проверки по мета-схеме form-DSL — одна на плагин, память в ЗАМЫКАНИИ.
 *
 * Не модульный синглтон, и это то же решение, что у отложенной проверки валидатора схемы:
 * общая на модуль ячейка означала бы, что два плагина (тест и приложение, два окна) делят
 * одну загрузку, и порядок тестов начинает влиять на их результат. Здесь ячейка живёт
 * столько же, сколько активация.
 *
 * Промис запоминается ЦЕЛИКОМ, а не его результат: параллельные заказы (активация и первый
 * ход, случившийся раньше её завершения) обязаны дождаться одной и той же загрузки, а не
 * завести вторую.
 *
 * Отказ НЕ гасится, в отличие от валидатора схемы: там пустая ячейка — состояние с
 * определённым поведением (находок мета-схемы нет), а здесь на этой функции стоит барьер
 * перед записью, и «загрузка не удалась» обязана дойти до вызывающего отказом. Ход при этом
 * упадёт строкой ошибки в панели, а не молча применит непроверенное.
 *
 * Неудача при этом НЕ запоминается: ячейка освобождается, и следующий ход пробует снова.
 * Запомнить её значило бы, что одна сорвавшаяся загрузка выключает ассистента до перезагрузки
 * страницы, — а поводов у сети сорваться ровно один раз предостаточно. Стучаться без конца
 * это не даёт: повтор случается на действие пользователя, а не по таймеру.
 *
 * @param loader - чем грузить; подменяется в тестах, чтобы не тянуть настоящий модуль.
 */
export function createValidateFormLoader(
  loader: () => Promise<{ validateFormSchema: ValidateFormSchema }> = () =>
    import('@reformer/renderer-json/validate')
): LoadValidateForm {
  let started: Promise<ValidateFormSchema> | undefined;
  return () => {
    started ??= loader().then(
      (module) => module.validateFormSchema,
      (error: unknown) => {
        started = undefined;
        throw error;
      }
    );
    return started;
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
 */
export function aiCommands(
  bridge: AgentBridge,
  session: AiSession
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
        session.reset();
      },
    },
    aiUndoTurnCommand(bridge),
  ];
}

/**
 * Плагин ассистента.
 *
 * `activate` только регистрирует — как и требует контракт. Восстановление канала из сохранённых
 * настроек запускается, но НЕ ожидается: `activate` синхронный, а канал сам доложит о себе через
 * сервис, когда поднимется. Отказ восстановления не должен ронять активацию — канала просто не
 * будет, и панель скажет об этом словами.
 */
export function createAiPlugin(options: AiPluginOptions): Plugin {
  const { host } = options;

  return definePlugin({
    id: AI_PLUGIN_ID,
    activate(ctx: PluginContext) {
      for (const [locale, messages] of Object.entries(AI_MESSAGES)) {
        options.i18n?.contribute(locale, messages);
      }

      const assistant = createAiAssistant(host, ctx);
      const session = createAiSession();
      const validateForm = createValidateFormLoader();
      const bridge = createAgentBridge({
        assistant,
        host,
        session,
        validateForm,
        // Читается ЛЕНИВО, на каждый ход: команды приходят и уходят вместе с плагинами,
        // а захваченный на активации список описывал бы набор, которого уже нет.
        agentCommands: () => ctx.commands.agentCommands() as readonly AgentCommand[],
        executeCommand: (id, args) => ctx.commands.execute(id, args),
      });

      ctx.subscriptions.push(ctx.services.register(AI_SERVICE_TOKEN, assistant));
      for (const command of aiCommands(bridge, session)) {
        ctx.subscriptions.push(ctx.commands.register(command));
      }
      ctx.subscriptions.push(
        ctx.extensions.contribute(PanelPoint, aiChatPanel(host, session, bridge, assistant), {
          id: AI_PANEL_ID,
        })
      );

      // Заказ, а не ожидание: `activate` только регистрирует, и держать на себе сеть ей нельзя.
      // Модуль едет параллельно оболочке и успевает задолго до первого вопроса пользователя —
      // между активацией и первым ходом лежит как минимум набранная им строка.
      //
      // Отказ здесь гасится ТОЛЬКО как необработанный промис: ячейка загрузки его не запомнила,
      // и следующий ход попробует снова, а если снова не выйдет — скажет об этом в панели.
      void validateForm().catch((error: unknown) => {
        console.warn('[plugins/ai] проверка по мета-схеме не загрузилась', error);
      });

      // Тот же заказ и по той же причине — для движка проверки АРГУМЕНТОВ инструмента
      // (`core/registry`). Он тоже уехал из главного чанка, и владелец у него тот же:
      // реестр не решает, когда его грузить, а `invoke` остаётся вызовом инструмента,
      // а не местом, где впервые встречается сеть.
      //
      // Отказ гасит сам `prepare` — он не отвергается, поэтому `catch` здесь не нужен:
      // не загрузившийся движок скажет о себе первым же вызовом инструмента, а следующий
      // вызов закажет загрузку заново.
      void assistant.tools.prepare();

      // Не ждём: см. заметку выше. Отказ гасится здесь, чтобы необработанный промис не всплыл
      // как ошибка запуска приложения.
      void assistant.restore().catch((error: unknown) => {
        console.warn('[plugins/ai] канал не восстановлен', error);
      });
    },
  });
}
