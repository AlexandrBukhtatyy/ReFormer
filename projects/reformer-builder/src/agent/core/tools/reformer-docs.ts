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
 * Каскад (`choose_api` → рецепт → полнотекст) исполняется внутри `askReformer` — кодом, а не
 * моделью. Промежуточные промахи в контекст не попадают: наружу уходит только собранный ответ.
 *
 * @module reformer-builder/agent/core/tools/reformer-docs
 */

import { askReformer } from '@reformer/mcp/dist/core/facade.js';
import { loadKnowledge } from '../../knowledge';
import { ok, TOOL_TEXT_BUDGET, type AgentTool } from '../types';

interface Params {
  question: string;
}

export const reformerDocsTool: AgentTool<Params> = {
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

  async run(params) {
    const knowledge = await loadKnowledge();
    if (!knowledge) {
      // Корпус не собран — это состояние сборки, и молчать о нём нельзя: агент решил бы, что
      // библиотека такого не умеет, и пошёл выдумывать API.
      return ok(
        'Library reference is unavailable in this build. Answer from the form and the component ' +
          'catalog only; do not guess ReFormer API names.'
      );
    }

    // Бюджет передаётся сюда, а не оставляется реестру: реестр режет по символам, посреди блока
    // кода, и модель дописывает оборванный вызов сама. Внутри известно, что резать первым.
    const answer = await askReformer(knowledge, params.question, {
      maxChars: TOOL_TEXT_BUDGET,
    });
    return ok(answer.text);
  },
};
