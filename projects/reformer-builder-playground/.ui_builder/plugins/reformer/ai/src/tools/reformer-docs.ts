/**
 * Справка по библиотеке ReFormer — единственный инструмент, который смотрит НАРУЖУ редактора.
 *
 * Остальные двенадцать работают со схемой открытой формы и каталогом этого кита. Этот отвечает
 * на вопросы о самой библиотеке: каким оператором выражается поведение, как объявляется
 * валидация, где про это написано.
 *
 * Почему один инструмент, а не набор из MCP. Поверхность уходит в запрос модели на каждом шаге
 * хода, и бюджет здесь — 7700 символов на все инструменты. Набор сервера стоит 2858 символов;
 * свободного места после сжатия — 382. Замер (`docs/mcp-eval/builder-toolset.md`) показал, что
 * это размен: фасад отстаёт от набора на 8 п.п. first-pass, выигрывая 87 % поверхности. Выбор
 * идёт не между «фасад и набор», а между «фасад и ничего».
 *
 * Отвечает не инструмент, а СПРАВКА (`../reference`): встроенная на `@reformer/mcp`
 * (`../knowledge/mcp-reference`) либо плагина-поставщика. Инструмент о ней знает только контракт —
 * поэтому её можно заменить, не трогая ни его описания, ни поверхности инструментов. Умолчание —
 * «справки нет»: инструмент при этом остаётся в наборе и честно говорит, что справка недоступна.
 * Убирать его было бы хуже — поверхность инструментов менялась бы от состояния сборки, а модель,
 * не видя справки, идёт выдумывать API вместо того, чтобы спросить.
 *
 * @module plugins/reformer/ai/tools/reformer-docs
 */

import type { ResolveLibraryReference } from '../reference';
import { ok, TOOL_TEXT_BUDGET, type AgentTool } from '../model/types';

interface Params {
  question: string;
}

/** Справки нет — законное состояние: корпус не собран либо стек собран без неё. */
const NO_REFERENCE: ResolveLibraryReference = () => undefined;

/**
 * Собрать инструмент справки.
 *
 * @param reference - Какая справка действует сейчас; по умолчанию — никакой.
 */
export function createReformerDocsTool(
  reference: ResolveLibraryReference = NO_REFERENCE
): AgentTool<Params> {
  return {
    name: 'ask_reformer',
    // Описание отсекает неверное применение прямой фразой: без неё модель зовёт справку вместо
    // `list_components`, потому что «компонент» звучит как вопрос про библиотеку.
    description:
      'The ReFormer library itself: which API a behaviour needs, how validation and computed ' +
      'fields are declared, where it is documented. Not this editor components.',
    inputSchema: {
      type: 'object',
      properties: {
        question: { type: 'string', description: 'Question in plain words' },
      },
      required: ['question'],
      additionalProperties: false,
    },
    readOnly: true,

    async run(params, ctx) {
      // Бюджет передаётся справке, а не оставляется реестру: реестр режет по символам, посреди
      // блока кода, и модель дописывает оборванный вызов сама. Справка знает, что резать первым.
      const answer = await reference()?.ask(params.question, {
        maxChars: TOOL_TEXT_BUDGET,
        ...(ctx.turn ? { signal: ctx.turn.signal } : {}),
      });
      if (!answer) {
        // Справки нет — это состояние сборки, и молчать о нём нельзя: агент решил бы, что
        // библиотека такого не умеет, и пошёл выдумывать API.
        return ok(
          'Library reference is unavailable in this build. Answer from the form and the component ' +
            'catalog only; do not guess ReFormer API names.'
        );
      }
      return ok(answer.text);
    },
  };
}
