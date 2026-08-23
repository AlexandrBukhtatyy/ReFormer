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
    const source = await loadKnowledge();
    if (!source) {
      // Корпус не собран — это состояние сборки, и молчать о нём нельзя: агент решил бы, что
      // библиотека такого не умеет, и пошёл выдумывать API.
      return ok(
        'Library reference is unavailable in this build. Answer from the form and the component ' +
          'catalog only; do not guess ReFormer API names.'
      );
    }

    // Источник называется в ответе, когда знания взяты из проекта: агент должен понимать, что
    // это версии ПОЛЬЗОВАТЕЛЯ, а не те, с которыми собран билдер. Для вшитого корпуса строки
    // нет — она стоила бы символов в каждом ответе, не добавляя выбора.
    const suffix = source.origin === 'project' ? sourceLine(source.versions) : '';

    // Бюджет передаётся сюда, а не оставляется реестру: реестр режет по символам, посреди блока
    // кода, и модель дописывает оборванный вызов сама. Внутри известно, что резать первым.
    //
    // Приписка вычитается ДО нарезки, а не дописывается после. Иначе ответ у верхней границы
    // бюджета вместе с ней перевалит за неё, и `clamp` в реестре срежет хвост — то есть саму
    // приписку. Замер: 5 ответов из 6 упирались в границу, и источник терялся ровно там, где
    // он важнее всего.
    const answer = await askReformer(source.knowledge, params.question, {
      maxChars: TOOL_TEXT_BUDGET - suffix.length,
    });

    return ok(suffix ? `${answer.text}${suffix}` : answer.text);
  },
};

/** Строка про источник знаний — считается заранее, потому что её длина входит в бюджет ответа. */
function sourceLine(versions: Record<string, string>): string {
  const list = Object.entries(versions)
    .map(([pkg, v]) => `${pkg.replace('@reformer/', '')}@${v}`)
    .join(', ');
  return `\n\n_Источник: node_modules проекта${list ? ` (${list})` : ''}._`;
}
