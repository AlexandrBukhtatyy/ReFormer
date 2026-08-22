/**
 * Decision-слой: выбор оператора по требованию.
 *
 * Главная защита здесь — не «правило срабатывает», а «правило рекомендует СУЩЕСТВУЮЩИЙ API».
 * Промпты этого же сервера уже однажды учили снятому `validateFormModel` (ради чего заведён
 * scripts/check-mcp-prompts.mjs); таблица правил — ровно такой же источник утверждений об
 * API и обязана проверяться так же.
 *
 * Второй пласт — разведение близких решений. Именно на них агент ошибается, и именно они
 * перечислены в секциях `Anti-patterns` самой документации: «resetWhen вместо enableWhen»,
 * «двусторонняя связь через два copyFrom вместо syncFields». Каждая пара зафиксирована
 * кейсом на обоих языках, потому что требования пишут и по-русски, и по-английски.
 */

import { describe, it, expect } from 'vitest';
import { chooseApi, DECISION_RULES } from '../src/decide/api-decision';
import { chooseApiTool } from '../src/tools/choose-api';
import { findOneSymbol } from '../src/index/symbols';
import { getPublicSymbols } from '../src/utils/symbols-parser';
import { KNOWN_PACKAGES, getFullDocs } from '../src/utils/docs-parser';

const hasSymbols = getPublicSymbols('@reformer/core').length > 0;

/** Требование → ожидаемый оператор. Пары подобраны так, чтобы ловить именно подмены. */
const CASES: Array<[string, string]> = [
  // значение: вычислить / скопировать / синхронизировать
  ['total должен вычисляться как price * quantity', 'computeFrom'],
  ['total is derived from price and quantity', 'computeFrom'],
  ['адрес доставки копирует адрес плательщика при установке галочки', 'copyFrom'],
  ['держать два поля синхронными в обе стороны', 'syncFields'],
  ['keep two fields in sync both directions', 'syncFields'],
  ['приводить вводимый текст к верхнему регистру', 'transformValue'],
  // доступность / видимость / сброс — три разных решения, которые часто путают
  ['поле B доступно только когда A заполнено', 'enableWhen'],
  ['field B should be disabled when field A is empty', 'enableWhen'],
  ['скрыть узел разметки по условию', 'hideWhen'],
  ['показывать шаг только при выполнении условия', 'hideWhen'],
  // Сброс: предикат против факта изменения. Раньше таблица фиксировала здесь resetWhen —
  // это и был дефект: для «когда изменился» resetWhen не срабатывает, он смотрит на условие.
  ['очистить поле номера карты, когда способ оплаты не карта', 'resetWhen'],
  ['очистить зависимое поле, когда изменился родительский выбор', 'onChange'],
  ['поле carModel очищается при изменении поля carBrand', 'onChange'],
  ['clear the dependent field when the parent select changes', 'onChange'],
  // Массив очищается своим .clear() из onChange, а не resetValue.
  ['очистить массив properties, когда чекбокс снят', 'onChange'],
  ['clear the array of items when the checkbox is unchecked', 'onChange'],
  // реакции
  ['выполнить побочный эффект при изменении поля', 'onChange'],
  ['перепроверить поле, когда изменилось другое', 'revalidateWhen'],
  // массивы
  ['навесить поведение на каждую строку массива', 'applyEach'],
  ['из группы чекбоксов активным может быть только один', 'exclusiveFlag'],
  // валидация
  ['проверить на сервере, что email не занят', 'validateAsync'],
  ['check email availability on the server', 'validateAsync'],
  ['поле обязательно только когда установлен флаг', 'validateWhen'],
  ['required if the checkbox is checked', 'validateWhen'],
  ['confirmPassword должен совпадать с password', 'cross'],
  ['провалидировать каждый элемент массива', 'each'],
  // сборка и submit
  ['форма не должна пересоздаваться при ререндере', 'useFormBundle'],
  ['заблокировать кнопку отправки, пока форма невалидна', 'useFormValidation'],
];

describe('decide/api-decision — таблица правил', () => {
  it.runIf(hasSymbols)('рекомендуемый символ существует как публичный экспорт', async () => {
    const missing: string[] = [];
    for (const rule of DECISION_RULES) {
      if ((await findOneSymbol(rule.recommend)) === null) {
        missing.push(`${rule.id} → ${rule.recommend}`);
      }
    }
    expect(missing, `правила указывают на несуществующий API: ${missing.join(', ')}`).toEqual([]);
  });

  it.runIf(hasSymbols)(
    'альтернативы существуют как экспорт либо описаны в документации',
    async () => {
      // Альтернативой может быть не только экспорт, но и МЕТОД (`schema.node(x).setHidden()`) —
      // такой записывается в вызовной форме, чтобы агент не искал его через get_symbol_docs.
      // Проверка та же, что у корпуса eval: имя обязано где-то существовать.
      const missing: string[] = [];
      for (const rule of DECISION_RULES) {
        for (const alt of rule.alternatives ?? []) {
          const bare = /^[A-Za-z_$][\w$]*$/.test(alt.symbol);
          if (bare) {
            if ((await findOneSymbol(alt.symbol)) === null)
              missing.push(`${rule.id} → ${alt.symbol}`);
            continue;
          }
          const method = alt.symbol.match(/([A-Za-z_$][\w$]*)\(\)\s*$/)?.[1];
          const found =
            method !== undefined &&
            KNOWN_PACKAGES.some((p) => new RegExp(`\\b${method}\\b`).test(getFullDocs(p)));
          if (!found) missing.push(`${rule.id} → ${alt.symbol}`);
        }
      }
      expect(missing, `альтернативы указывают в никуда: ${missing.join(', ')}`).toEqual([]);
    }
  );

  it('идентификаторы правил уникальны', () => {
    const ids = DECISION_RULES.map((r) => r.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('разводит близкие решения на русском и английском', () => {
    const wrong: string[] = [];
    for (const [requirement, expected] of CASES) {
      const top = chooseApi(requirement)[0];
      const got = top?.rule.recommend ?? '(нет правила)';
      if (got !== expected) wrong.push(`"${requirement}" → ${got}, ждём ${expected}`);
    }
    expect(wrong, `неверные решения:\n  ${wrong.join('\n  ')}`).toEqual([]);
  });

  it('пустое требование не даёт решений', () => {
    expect(chooseApi('')).toEqual([]);
    expect(chooseApi('   ')).toEqual([]);
  });
});

describe('tool choose_api', () => {
  it('пустой аргумент → внятное сообщение, а не падение', async () => {
    for (const requirement of [undefined, '', '   ']) {
      const { content } = await chooseApiTool({ requirement: requirement as string });
      expect(content[0].text).toMatch(/requirement/i);
    }
  });

  it.runIf(hasSymbols)('ответ несёт сигнатуру, пример и анти-паттерн', async () => {
    const { content } = await chooseApiTool({
      requirement: 'очистить поле номера карты, когда способ оплаты не карта',
    });
    const text = content[0].text;
    expect(text).toContain('resetWhen');
    expect(text).toContain('## Signature');
    expect(text).toContain('## Example');
    // Документация прямо предупреждает про подмену enableWhen — это и есть самое ценное.
    expect(text).toContain('## Anti-patterns recorded for this choice');
    expect(text).toContain('enableWhen');
  });

  it.runIf(hasSymbols)(
    'нераспознанное требование честно уходит в поиск, а не выдумывает',
    async () => {
      const { content } = await chooseApiTool({ requirement: 'zzqq wubble frotz' });
      expect(content[0].text).toMatch(/No decision rule matched/);
    }
  );
});
