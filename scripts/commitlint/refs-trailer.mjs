/**
 * Правило commitlint `refs-trailer` — формат третьей, необязательной секции сообщения коммита:
 * ссылок на задачи.
 *
 *   type(scope): тема
 *
 *   Тело — что и зачем.
 *
 *   Refs: ReFormer-3548, ReFormer-um17, #12
 *   Closes: #12
 *
 * `Refs:` — одна строка в последнем абзаце. ПЕРВЫЙ ID — задача, по которой сделан коммит,
 * остальные — задачи, на которые он повлиял: порядок значим, поэтому список и держится одной
 * строкой. ID — задача beads (`ReFormer-k152.13`) или GitHub issue (`#12`, `owner/repo#12`).
 * `Closes:` — необязательная строка после `Refs:`: GitHub закроет перечисленные issue, когда
 * коммит попадёт в default-ветку. Каждый из них обязан стоять и в `Refs`, чтобы `Refs` оставался
 * полным списком. Задачу beads коммит не закрывает — это делает `bd close`.
 *
 * Разбор свой, а не из парсера commitlint: тот считает футером только строки с `#N` или
 * `BREAKING CHANGE`, а `Refs: ReFormer-…` для него — обычное тело.
 *
 * Почему секция — отдельный абзац только из трейлеров `Ключ: значение`: тогда git читает его
 * сам (`git log --format='%(trailers:key=Refs,valueonly)'`). Одна строка не того вида — `Closes #12`
 * без двоеточия или `BREAKING CHANGE: …` (в ключе пробел) — и git перестаёт считать абзац блоком
 * трейлеров целиком. GitHub форму с двоеточием понимает (`Closes: #10` есть в его документации).
 */

/** Синхронно с `issue-prefix` в .beads/config.yaml. */
const BEADS_PREFIX = 'ReFormer';

const BEADS_ID = new RegExp(`^${BEADS_PREFIX}-[a-z0-9]+(?:\\.\\d+)*$`);
const GITHUB_ID = /^(?:[\w.-]+\/[\w.-]+)?#\d+$/;

/** ID, похожий на задачу, — для поиска старого стиля «голой строкой» и опечаток в префиксе. */
const ID_LIKE = new RegExp(`^(?:${BEADS_PREFIX}-\\S+|(?:[\\w.-]+\\/[\\w.-]+)?#\\d+)$`, 'i');

/** Трейлер git: ключ из латиницы, цифр и дефисов, двоеточие, значение. */
const TRAILER = /^([A-Za-z][A-Za-z0-9-]*):\s*(.*)$/;

/**
 * Строка, которая выглядит как ссылка на задачу, но с другим ключом: опечатка в `Refs`/`Closes`,
 * синоним (`Task:`, `Issues:`) или ключевое слово GitHub без двоеточия (`Fixes #12`). Заголовок
 * сюда не попадает — он проверяется отдельно от абзацев тела.
 */
const MISSPELLED = new RegExp(
  `^(?:refs?|references?|tasks?|issues?|close[sd]?|fix(?:e[sd])?|resolve[sd]?)` +
    `(?:\\s*:|\\s+(?:${BEADS_PREFIX}-|[\\w.-]+\\/[\\w.-]+#|#)\\S)`,
  'i'
);

/** Строка-ножницы `git commit -v`: всё ниже — дифф, а не сообщение. */
const SCISSORS = /^# -+ >8 -+$/;

const ID_HINT = `ожидается ${BEADS_PREFIX}-<id>, #<N> или owner/repo#<N>`;

/** Абзацы сообщения без комментариев git; каждый абзац — массив строк. */
function paragraphs(raw) {
  const lines = [];
  for (const line of raw.split(/\r?\n/)) {
    if (SCISSORS.test(line)) break;
    if (/^#(\s|$)/.test(line)) continue;
    lines.push(line.trimEnd());
  }
  const result = [];
  let current = [];
  for (const line of lines) {
    if (line === '') {
      if (current.length) result.push(current);
      current = [];
    } else {
      current.push(line);
    }
  }
  if (current.length) result.push(current);
  return result;
}

/** Разбирает список ID через `, `; возвращает текст ошибки или массив ID. */
function parseIds(key, value) {
  const ids = value.split(',').map((id) => id.trim());
  if (ids.some((id) => id === '')) {
    return `${key}: пустой элемент списка — ID разделяются запятой с пробелом: «${key}: A, B»`;
  }
  if (value !== ids.join(', ')) {
    return `${key}: ID разделяются запятой с пробелом — «${key}: ${ids.join(', ')}»`;
  }
  const bad = ids.find((id) => !BEADS_ID.test(id) && !GITHUB_ID.test(id));
  if (bad) return `${key}: ID «${bad}» не по формату — ${ID_HINT}`;
  const duplicate = ids.find((id, index) => ids.indexOf(id) !== index);
  if (duplicate) return `${key}: ID «${duplicate}» указан дважды`;
  return ids;
}

/** Возвращает текст первой ошибки секции ссылок или null, если секции нет или она в порядке. */
export function checkRefs(raw) {
  const [, ...body] = paragraphs(raw);
  const last = body.at(-1) ?? [];

  const misspelled = body.flat().find((line) => {
    if (!MISSPELLED.test(line)) return false;
    const key = TRAILER.exec(line)?.[1];
    return key !== 'Refs' && key !== 'Closes';
  });
  if (misspelled) {
    return (
      `строка «${misspelled}»: ссылки на задачи пишутся ключом «Refs:», ` +
      `закрываемые GitHub issue — «Closes:» (с двоеточием, с заглавной буквы)`
    );
  }

  const isKeyed = (line) => /^(Refs|Closes):/.test(line);
  const keyedOutside = body.slice(0, -1).flat().find(isKeyed);
  if (keyedOutside) {
    return (
      `строка «${keyedOutside}»: секция ссылок — последний абзац сообщения, ` +
      `отделённый от тела пустой строкой`
    );
  }

  if (!last.some(isKeyed)) {
    const bare =
      last.length > 0 && last.every((line) => line.split(/,\s*/).every((id) => ID_LIKE.test(id)));
    return bare
      ? `последний абзац «${last.join(' ')}» — ссылки на задачи без ключа: оформи как «Refs: ${last.join(', ')}»`
      : null;
  }

  const notTrailer = last.find((line) => !TRAILER.test(line));
  if (notTrailer) {
    return (
      `строка «${notTrailer}» в одном абзаце с Refs: в секции ссылок допустимы только строки ` +
      `«Ключ: значение» — BREAKING CHANGE и текст отдели пустой строкой выше`
    );
  }

  const refsLines = last.filter((line) => line.startsWith('Refs:'));
  const closesLines = last.filter((line) => line.startsWith('Closes:'));
  if (refsLines.length === 0) return 'Closes: без Refs: — закрываемые issue перечисляются и в Refs';
  if (refsLines.length > 1) return 'Refs: — одна строка, все ID через запятую: «Refs: A, B, C»';
  if (closesLines.length > 1)
    return 'Closes: — одна строка, все issue через запятую: «Closes: #1, #2»';
  if (closesLines.length && last.indexOf(closesLines[0]) < last.indexOf(refsLines[0])) {
    return 'Closes: идёт после Refs:';
  }

  const refs = parseIds('Refs', TRAILER.exec(refsLines[0])[2]);
  if (typeof refs === 'string') return refs;
  if (closesLines.length === 0) return null;

  const closes = parseIds('Closes', TRAILER.exec(closesLines[0])[2]);
  if (typeof closes === 'string') return closes;
  const beads = closes.find((id) => !GITHUB_ID.test(id));
  if (beads) return `Closes: «${beads}» — только GitHub issue; задачу beads закрывает bd close`;
  const missing = closes.find((id) => !refs.includes(id));
  if (missing) return `Closes: «${missing}» нет в Refs — закрываемый issue указывается и в Refs`;
  return null;
}

/** Правило для commitlint: `'refs-trailer': [2, 'always']`. */
export function refsTrailer(parsed) {
  const error = checkRefs(parsed.raw ?? '');
  return error ? [false, error] : [true];
}
