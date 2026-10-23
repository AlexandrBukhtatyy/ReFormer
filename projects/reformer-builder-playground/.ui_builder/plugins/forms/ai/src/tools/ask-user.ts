/**
 * `ask_user` — модель спрашивает человека и ждёт ответа тем же ходом.
 *
 * ## Зачем блокирующий инструмент, а не «спроси текстом»
 *
 * Вопрос текстом заканчивает ход: модель пишет «какой тип у поля?» и останавливается, а ответ
 * человека приходит уже следующим ходом — без правок, сделанных до вопроса, в черновике и без
 * вызовов, которые модель успела сделать. Инструмент держит ход открытым: ответ возвращается
 * результатом вызова, модель продолжает с того же места, и весь ход — одна правка для отмены.
 *
 * Форма — как у `AskUserQuestion` Claude Code: до четырёх вопросов за вызов, у каждого два–четыре
 * варианта, мультивыбор и свой ответ. Все вопросы одним вызовом: карточка с четырьмя вопросами
 * дешевле четырёх остановок хода, а модель, которой разрешено спрашивать по одному, спрашивает
 * по одному.
 *
 * ## Чего здесь нет
 *
 * Ожидания: его держит мост (`TurnScope.ask`), а инструмент только описывает вопросы и
 * пересказывает ответы модели. Без моста — в тестах цикла, в замерах — спрашивать некого, и
 * инструмент честно отвечает «продолжай на допущениях», а не висит.
 *
 * @module plugins/forms/ai/tools/ask-user
 */

import {
  formToolFail,
  formToolOk,
  type FormAgentTool,
  type FormAskAnswer,
  type FormAskQuestion,
  type FormToolOutcome,
} from '@reformer/builder-plugin-api';

interface Params {
  questions: {
    question: string;
    header?: string;
    options: { label: string; description?: string }[];
    multiSelect?: boolean;
  }[];
}

export const askUserTool: FormAgentTool<Params> = {
  name: 'ask_user',
  description:
    'Ask the user before editing when the request is ambiguous in a way that changes the ' +
    'result. Put all questions in one call, 2-4 short options each; the user may also answer ' +
    'in their own words. Never ask what a tool can tell you.',
  inputSchema: {
    type: 'object',
    properties: {
      questions: {
        type: 'array',
        minItems: 1,
        maxItems: 4,
        items: {
          type: 'object',
          properties: {
            question: { type: 'string' },
            header: { type: 'string' },
            options: {
              type: 'array',
              minItems: 2,
              maxItems: 4,
              items: {
                type: 'object',
                properties: {
                  label: { type: 'string' },
                  description: { type: 'string' },
                },
                required: ['label'],
                additionalProperties: false,
              },
            },
            multiSelect: { type: 'boolean' },
          },
          required: ['question', 'options'],
          additionalProperties: false,
        },
      },
    },
    required: ['questions'],
    additionalProperties: false,
  },
  readOnly: true,
  interactive: true,
  async run(params, ctx) {
    // Длины режутся здесь, а не схемой: пределы в схеме уходили бы модели в каждом запросе, а
    // слишком длинный вопрос — не повод отказать, его достаточно укоротить.
    const questions: FormAskQuestion[] = params.questions.map((spec) => {
      const header = clip(spec.header, LIMIT.header);
      return {
        question: clip(spec.question, LIMIT.question),
        ...(header !== '' ? { header } : {}),
        options: spec.options.map((option) => {
          const description = clip(option.description, LIMIT.description);
          return {
            label: clip(option.label, LIMIT.label),
            ...(description !== '' ? { description } : {}),
          };
        }),
        multiSelect: spec.multiSelect === true,
      };
    });
    const invalid = invalidQuestions(questions);
    if (invalid !== null) return invalid;

    const ask = ctx.turn?.ask;
    if (ask === undefined) {
      return formToolFail(
        'UNAVAILABLE',
        'No one to ask right now. Proceed and state your assumptions.'
      );
    }
    const outcome = await ask(questions);
    if (outcome === 'limit') {
      return formToolFail(
        'REFUSED',
        'Question limit for this turn reached. Proceed and state your assumptions.'
      );
    }
    if (outcome === 'cancelled') {
      return formToolFail('UNAVAILABLE', 'The user stopped the turn without answering.');
    }
    return formToolOk(describeAnswers(questions, outcome));
  },
};

/** Пределы длины — по месту в карточке: метка вопроса — чип, вариант — строка, вопрос — абзац. */
const LIMIT = { question: 300, header: 16, label: 60, description: 150 } as const;

/** Обрезать строку до предела, сняв пробелы по краям. */
function clip(value: string | undefined, max: number): string {
  const text = (value ?? '').trim();
  return text.length > max ? `${text.slice(0, max - 1)}…` : text;
}

/**
 * Что схема не выражает: разные вопросы и разные варианты внутри вопроса. Два одинаковых
 * варианта человек не различит, а ответ с одинаковыми метками модель не поймёт.
 */
function invalidQuestions(questions: readonly FormAskQuestion[]): FormToolOutcome | null {
  const texts = questions.map((question) => question.question);
  if (texts.some((text) => text === '') || new Set(texts).size !== texts.length) {
    return formToolFail(
      'INVALID_PARAMS',
      'Each question must be non-empty and different from the others.'
    );
  }
  for (const [index, question] of questions.entries()) {
    const labels = question.options.map((option) => option.label);
    if (labels.some((label) => label === '') || new Set(labels).size !== labels.length) {
      return formToolFail(
        'INVALID_PARAMS',
        `questions[${index}]: option labels must be non-empty and different.`
      );
    }
  }
  return null;
}

/** Ответы для модели — строкой на вопрос, словами человека как есть. */
export function describeAnswers(
  questions: readonly FormAskQuestion[],
  answers: readonly FormAskAnswer[]
): string {
  const lines = questions.map((question, index) => {
    const answer = answers[index] ?? { selected: [] };
    return `${index + 1}) "${question.question}" → ${answerText(answer)}`;
  });
  return ['The user answered:', ...lines].join('\n');
}

/** Ответ на вопрос одной строкой: выбранное, свои слова или то и другое. */
export function answerText(answer: FormAskAnswer): string {
  const chosen = answer.selected.map((label) => `"${label}"`).join(', ');
  const own = answer.text?.trim();
  if (chosen === '') return own ? `own words: "${own}"` : '(no answer)';
  return own ? `${chosen}; adds: "${own}"` : chosen;
}
