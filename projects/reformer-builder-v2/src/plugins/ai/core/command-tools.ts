/**
 * Проекция команд в инструменты модели.
 *
 * ## Решение контракта: инструменты ассистента — проекция команд, а не второй список
 *
 * Внешнее требование звучит как «ассистент пользуется теми же возможностями, что и интерфейс».
 * Буквальное «инструмент = команда» ему не отвечает: у команды заголовок для человека, у
 * инструмента — описание для модели, и оно **измеряется в символах**, потому что уходит в
 * каждый запрос каждого шага. Не всякая команда осмысленна для модели («переключить панель»),
 * не всякий инструмент — для палитры (правка свойства с пятью аргументами).
 *
 * Поэтому команда **опционально объявляет** себя инструментом — блоком `agent` с описанием и
 * JSON Schema аргументов (`host/primitives/command`). Что это даёт:
 *
 * - **один путь исполнения**: отмена, аудит и журнал одинаковы для действия человека и модели;
 * - **две подачи**: заголовок переводится, описание для модели — нет;
 * - **явное согласие**: поверхность не растёт случайно — чтобы команда стала доступна модели,
 *   кто-то должен это написать.
 *
 * ## Команда правит документ, а не черновик хода
 *
 * Встроенные инструменты копят {@link module:plugins/ai/core/changeset|ChangeSet} и в документ
 * не пишут; команда пишет туда сразу, потому что она — та же дверь, в которую входит человек.
 * Это не смешение двух механизмов, а их граница: правка командой попадёт в буфер немедленно,
 * а применение набора в конце хода увидит расхождение с базой и **спросит** пользователя.
 * Молча перезаписать её нельзя, и именно этого проверка расхождения не даёт сделать.
 *
 * Отсюда же `readOnly: false` у спроецированного инструмента: провайдеру разрешено схлопывать
 * в контексте повторные ЧТЕНИЯ, а ответ команды устареть не может — он говорит о своём
 * действии и ни о чём больше.
 *
 * @module plugins/ai/core/command-tools
 */

import { TOOL_DESCRIPTION_BUDGET, TOOL_NAME_BUDGET, type AgentTool } from './types';

/** Как команда выглядит для модели. Структурная копия `CommandAgentSpec` платформы. */
export interface AgentCommandSpec {
  /** Описание для модели, а не ключ i18n: модель читает по-английски и перевода не ждёт. */
  readonly description: string;
  /** JSON Schema аргументов. Проверяет её реестр инструментов — до вызова команды. */
  readonly schema: object;
}

/**
 * Команда, объявившая себя инструментом.
 *
 * Структурная копия `CommandContribution & { agent }`: настоящая команда платформы сюда
 * присваивается, а обратной зависимости не возникает — ядро остаётся без импорта `@/sdk`.
 */
export interface AgentCommand {
  readonly id: string;
  readonly agent: AgentCommandSpec;
}

/** Исполнение команды. Ровно `CommandRegistry.execute`, суженный до двух аргументов. */
export type ExecuteCommand = (id: string, args?: unknown) => Promise<unknown>;

/** Почему команда не стала инструментом. Код, а не фраза: это ошибка автора плагина. */
export type CommandRejectionCode =
  /** Из идентификатора не получается имя инструмента (`snake_case`, начинается с буквы). */
  | 'name-invalid'
  /** Имя длиннее {@link TOOL_NAME_BUDGET}. */
  | 'name-too-long'
  /** Имя занято другим инструментом или другой командой. */
  | 'name-taken'
  /** Описание длиннее {@link TOOL_DESCRIPTION_BUDGET}. */
  | 'description-too-long';

/** Отвергнутая команда вместе с причиной. */
export interface CommandRejection {
  readonly commandId: string;
  readonly code: CommandRejectionCode;
}

/** Итог проекции: что стало инструментами и что не стало. */
export interface CommandProjection {
  readonly tools: readonly AgentTool[];
  readonly rejected: readonly CommandRejection[];
}

/**
 * Имя инструмента из идентификатора команды: `editor-schema.delete` → `editor_schema_delete`.
 *
 * Отображение детерминированное и без словаря исключений: имя инструмента входит в постоянную
 * часть запроса, и оно обязано быть одним и тем же от запуска к запуску, иначе кэш префикса
 * провайдера промахивается на каждом ходе.
 *
 * `null` — из идентификатора имени не получается (пусто или начинается не с буквы). Придумывать
 * замену нельзя: модель зовёт инструмент по имени, и подставленная приставка сделала бы адрес
 * неугадываемым по идентификатору команды.
 */
export function toolNameForCommand(commandId: string): string | null {
  const name = commandId
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
  return /^[a-z][a-z0-9_]*$/.test(name) ? name : null;
}

/**
 * Текст ответа команды для модели.
 *
 * Команда возвращает что угодно, включая `undefined` («сделал»). Пустой ответ модель читает
 * как отказ, поэтому у него есть слово; всё остальное сериализуется, а бюджет ответа наложит
 * реестр (`TOOL_TEXT_BUDGET`).
 */
function resultText(value: unknown): string {
  if (typeof value === 'string') return value === '' ? 'Done.' : value;
  if (value === undefined || value === null) return 'Done.';
  try {
    return JSON.stringify(value) ?? 'Done.';
  } catch {
    return 'Done.';
  }
}

/**
 * Спроецировать команды в инструменты.
 *
 * @param commands - Команды с блоком `agent` (`CommandRegistry.agentCommands()`).
 * @param execute - Исполнение команды; отказ реестра команд возвращается модели ошибкой.
 * @param taken - Имена, уже занятые встроенными инструментами.
 */
export function commandTools(
  commands: readonly AgentCommand[],
  execute: ExecuteCommand,
  taken: readonly string[] = []
): CommandProjection {
  const tools: AgentTool[] = [];
  const rejected: CommandRejection[] = [];
  const used = new Set(taken);

  for (const command of commands) {
    const name = toolNameForCommand(command.id);
    if (name === null) {
      rejected.push({ commandId: command.id, code: 'name-invalid' });
      continue;
    }
    if (name.length > TOOL_NAME_BUDGET) {
      rejected.push({ commandId: command.id, code: 'name-too-long' });
      continue;
    }
    if (used.has(name)) {
      // Молчаливая подмена хуже отказа: модель звала бы одно, а получала другое.
      rejected.push({ commandId: command.id, code: 'name-taken' });
      continue;
    }
    if (command.agent.description.length > TOOL_DESCRIPTION_BUDGET) {
      rejected.push({ commandId: command.id, code: 'description-too-long' });
      continue;
    }

    used.add(name);
    const { id, agent } = command;
    tools.push({
      name,
      description: agent.description,
      inputSchema: agent.schema,
      readOnly: false,
      async run(params: unknown) {
        try {
          const value = await execute(id, params);
          return { ok: true, text: resultText(value) };
        } catch (error) {
          // Исключение команды не роняет ход: модель получает ошибку и пробует иначе (урок 10).
          return {
            ok: false,
            text: '',
            error: {
              code: 'TOOL_FAILED' as const,
              message: error instanceof Error ? error.message : String(error),
            },
          };
        }
      },
    });
  }

  return { tools, rejected };
}
