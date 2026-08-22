/**
 * Проверка, что корпус проверяет СУЩЕСТВУЮЩЕЕ.
 *
 * Третий по счёту дефект прибора за две фазы, и самый коварный. `assertStrongExpectations`
 * ловит слишком ОБЩЕЕ ожидание («cross», «registry»), но бессильно против слишком
 * КОНКРЕТНОГО и при этом выдуманного. Замерено: задача `basic/disabled-submit` ждала
 * `isValid` / `FormStatus`, которых в ReFormer нет вовсе — в документации 25 раз встречается
 * `isValidating`, а `isValid` совпадал с ним как ПРЕФИКС при поиске подстрокой. Из-за этого
 * непопадание сервера было записано в его пробелы, хотя пробел был в корпусе.
 *
 * Правило: ожидание, похожее на идентификатор, обязано существовать — либо как публичный
 * символ, либо как упоминание в документации. Иначе задача не измеряет ничего.
 */

/** Ожидание-идентификатор: `validateWhen`, `cross(`, `$dataSource`, `form.status`. */
const IDENT = /^[$]?[A-Za-z_][\w$]*$/;

/**
 * Регулярка «слово целиком» с поправкой на `$`-префикс: `\b` перед `$` не срабатывает
 * (граница слова требует словесного символа рядом), поэтому для таких имён проверяем
 * только правую границу. Без этого `$model`/`$component`/`$dataSource` ложно объявлялись
 * несуществующими.
 */
function wholeWord(name) {
  const escaped = name.replace(/[$]/g, '\\$');
  const left = name.startsWith('$') ? '' : '\\b';
  return new RegExp(`${left}${escaped}\\b`, 'g');
}

/**
 * @param {Array<{id:string, expectAny:string[]}>} tasks
 * @param {{ docsOf: (pkg: string) => string, packages: readonly string[], hasSymbol: (name:string) => Promise<boolean> }} sources
 * @returns {Promise<string[]>} список проблем; пустой массив — корпус в порядке
 */
export async function auditExpectations(tasks, sources) {
  const problems = [];
  const docs = sources.packages.map((p) => sources.docsOf(p)).join('\n');

  for (const task of tasks) {
    for (const expectation of task.expectAny) {
      const name = expectation.replace(/\($/, '');
      if (!IDENT.test(name)) continue;
      if (await sources.hasSymbol(name)) continue;
      const hits = (docs.match(wholeWord(name)) ?? []).length;
      if (hits === 0) {
        problems.push(
          `${task.id}: ожидание "${expectation}" не существует — ни публичного символа, ` +
            `ни единого упоминания в документации. Задача измеряет несуществующий API.`
        );
      }
    }
  }
  return problems;
}
