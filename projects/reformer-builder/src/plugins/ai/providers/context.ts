/**
 * Прополка контекста между шагами хода.
 *
 * Ход агента — это десятки запросов, и каждый следующий несёт всё, что накопилось в предыдущих.
 * В живом захвате последний запрос хода весил 51 КБ, из которых 28 КБ — рассуждение модели с
 * прошлых шагов, а ещё несколько килобайт — одна и та же карта формы, прочитанная восемь раз.
 * Полезной новизны там считанные сотни байт.
 *
 * Функции чистые и живут отдельно от адаптера SDK ровно потому, что цена ошибки здесь высокая:
 * порванная пара «вызов инструмента → его результат» — это отказ API, а не деградация качества.
 *
 * ВАЖНО, где это применимо. Правка сообщений в середине диалога меняет байты префикса и обнуляет
 * кэш от точки правки, поэтому на каналах с работающим кэшем (Anthropic, OpenAI) прополка — чистый
 * убыток. Она включается только для локальных серверов, где кэш не тарифицируется, зато контекст
 * упирается в физическое окно модели.
 *
 * @module plugins/ai/providers/context
 */

import type { ModelMessage } from 'ai';

/** Заглушка вместо содержимого устаревшего чтения. */
const SUPERSEDED = '(superseded — a newer result for the same call is below)';

/**
 * Убрать рассуждение модели из истории шагов.
 *
 * Самая крупная статья расхода: у think-моделей `reasoning_content` составлял больше половины
 * запроса. Фактический результат работы при этом не теряется — он в вызовах инструментов и их
 * ответах, а те остаются нетронутыми.
 *
 * Только для локальных каналов, и не из экономии одной: Anthropic при extended thinking требует
 * вернуть блоки рассуждения с подписями (иначе отказ API), а OpenAI ссылается на них по
 * идентификаторам. Локальные серверы ничего подобного не проверяют — более того, часть
 * DeepSeek-совместимых эндпоинтов ОТВЕЧАЕТ ОШИБКОЙ, если прислать `reasoning_content` обратно.
 */
export function dropReasoning(messages: readonly ModelMessage[]): ModelMessage[] {
  const out: ModelMessage[] = [];
  for (const message of messages) {
    if (message.role !== 'assistant' || !Array.isArray(message.content)) {
      out.push(message);
      continue;
    }
    const content = message.content.filter((part) => part.type !== 'reasoning');
    // Реплика, состоявшая из одного рассуждения, исчезает целиком: пустой assistant без частей
    // ломает схему сообщения. У шага с инструментом такого не бывает — там есть `tool-call`.
    if (!content.length) continue;
    out.push({ ...message, content });
  }
  return out;
}

/**
 * Схлопнуть устаревшие результаты повторных чтений.
 *
 * Одно и то же чтение (`get_form_outline` без аргументов, `describe_component` одного компонента)
 * модель зовёт по нескольку раз за ход, и каждый ответ остаётся в контексте до конца. Свежий ответ
 * делает прежние бессмысленными — но выбросить их нельзя: и Anthropic, и OpenAI требуют результат
 * на КАЖДЫЙ вызов инструмента, а пара без ответа — отказ API. Поэтому содержимое заменяется
 * заглушкой, а сама пара остаётся на месте.
 *
 * Результаты пишущих инструментов не трогаются никогда: они несут адреса созданных узлов, и
 * «устаревшего» среди них не бывает — каждый говорит о своей правке.
 *
 * @param messages - История шагов.
 * @param isReadOnly - Читающий ли это инструмент; пишущие пропускаются нетронутыми.
 */
export function pruneSupersededReads(
  messages: readonly ModelMessage[],
  isReadOnly: (toolName: string) => boolean
): ModelMessage[] {
  // Ключ вызова = имя инструмента вместе с аргументами: `describe_component('Input')` и
  // `describe_component('Select')` — разные вопросы, схлопывать их друг в друга нельзя.
  const keyByCallId = new Map<string, string>();
  for (const message of messages) {
    if (message.role !== 'assistant' || !Array.isArray(message.content)) continue;
    for (const part of message.content) {
      if (part.type !== 'tool-call' || !isReadOnly(part.toolName)) continue;
      keyByCallId.set(part.toolCallId, `${part.toolName}:${JSON.stringify(part.input ?? {})}`);
    }
  }

  // Последний вызов каждого ключа — единственный, чьё содержимое имеет смысл сохранить.
  const lastCallOfKey = new Map<string, string>();
  for (const [callId, key] of keyByCallId) lastCallOfKey.set(key, callId);
  const keep = new Set(lastCallOfKey.values());

  return messages.map((message) => {
    if (message.role !== 'tool' || !Array.isArray(message.content)) return message;
    const content = message.content.map((part) => {
      if (part.type !== 'tool-result') return part;
      const key = keyByCallId.get(part.toolCallId);
      if (key === undefined || keep.has(part.toolCallId)) return part;
      return { ...part, output: { type: 'text' as const, value: SUPERSEDED } };
    });
    return { ...message, content };
  });
}
