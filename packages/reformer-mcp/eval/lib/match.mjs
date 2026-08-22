/**
 * Сопоставление ответа сервера с ожиданиями корпуса.
 *
 * Здесь живёт защита от ложных попаданий, которая уже один раз спасла замер. Тупиковый ответ
 * `find_recipe` («No recipe found…») печатает СПИСОК доступных рецептов и алиасов — а в нём
 * есть и слово `cross`, и `renderer-json/registry`. Слабое ожидание вроде `["cross"]`
 * совпадало с этим списком, и задача засчитывалась как решённая, хотя агент получил тупик.
 * На baseline это давало завышенный first-pass, а последующее устранение тупика выглядело
 * как «регресс».
 *
 * Отсюда два правила:
 *  1. ответ, начинающийся с известного маркера «ничего не найдено», НЕ может быть попаданием
 *     ни при каких совпадениях подстрок;
 *  2. ожидания в корпусе — конкретные идентификаторы API (`defineRegistry`, `cross(`), а не
 *     общие слова. Их проверяет `assertStrongExpectations` при загрузке корпуса.
 */

/** Начала ответов, которые означают «сервер ничего не нашёл». */
const EMPTY_MARKERS = [
  'No recipe found',
  'No curated recipe is registered',
  'No documentation sections matched',
  'No public symbols',
  'Symbol "',
  'Section "',
];

export function isEmptyAnswer(text) {
  const head = String(text).trimStart();
  return EMPTY_MARKERS.some((m) => head.startsWith(m));
}

/** Совпавшие ожидания. Пустой массив, если ответ — «ничего не найдено». */
export function matched(text, expectAny) {
  if (isEmptyAnswer(text)) return [];
  const hay = String(text).toLowerCase();
  return expectAny.filter((e) => hay.includes(e.toLowerCase()));
}

/**
 * Слова, которые сервер печатает в служебных списках (алиасы `find_recipe`, имена файлов
 * рецептов, подсказки) — ожидание, состоящее только из такого слова, не различает ответ и
 * шум, поэтому корпус их запрещает.
 */
const WEAK_TOKENS = new Set([
  'array',
  'arrays',
  'async',
  'copy',
  'cross',
  'cycle',
  'options',
  'preload',
  'registry',
  'reset',
  'submit',
  'sync',
  'transform',
  'validate',
  'validation',
  'validator',
  'wizard',
  'step',
  'valid',
  'status',
  'remove',
  'clear',
  'required',
  'hidden',
]);

/**
 * Слабое ли ожидание. Слабым может быть только ГОЛОЕ слово: как только в ожидании есть
 * скобка, точка, `$` или пробел (`cross(`, `form.status`, `$dataSource`, `Cycle detected`),
 * оно перестаёт совпадать со служебными списками сервера — там имена печатаются через
 * запятую и как пути файлов. Раньше эти символы срезались перед проверкой, и сторож
 * объявлял слабым как раз то, что делает ожидание точным.
 */
function isWeak(expectation) {
  const e = String(expectation);
  if (/[($.\s/]/.test(e)) return false;
  return WEAK_TOKENS.has(e.toLowerCase());
}

/**
 * Проверка качества корпуса: у каждой задачи должно быть хотя бы одно ожидание, которое
 * нельзя удовлетворить служебным списком. Бросает с перечнем нарушителей.
 */
export function assertStrongExpectations(tasks) {
  const weak = tasks.filter((t) => t.expectAny.every(isWeak));
  if (weak.length > 0) {
    throw new Error(
      `Корпус: у ${weak.length} задач(и) все ожидания — общие слова, которые встречаются в ` +
        `служебных списках сервера и дают ложные попадания:\n` +
        weak.map((t) => `  - ${t.id}: [${t.expectAny.join(', ')}]`).join('\n') +
        `\nЗамените их на конкретные идентификаторы API (например \`defineRegistry\`, \`cross(\`).`
    );
  }
}
