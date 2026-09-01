/**
 * Режимы markdown-вкладки и «липкое» предпочтение.
 *
 * ## Почему предпочтение живёт в настройках, а не в состоянии вкладки
 *
 * Человек смотрит документацию ОДНИМ способом: если он открыл README предпросмотром, то и
 * следующий `.md` он хочет видеть так же. Состояние вкладки этого не помнит по построению —
 * вкладка новая, — поэтому режим по умолчанию берётся из настроек, а вкладка держит только
 * своё текущее значение. Ровно так же ведёт себя VSCode, и ровно так это было в v1
 * (`canvas/markdown/view-pref.ts`), только там предпочтение лежало в `localStorage` мимо
 * всякой службы.
 *
 * Область настройки — `user`: способ чтения документации принадлежит человеку, а не проекту.
 *
 * @module plugins/editor-markdown/state/view
 */

/** Что показывает вкладка markdown. */
export type MarkdownView = 'code' | 'preview' | 'split';

/** Порядок переключения по кругу — он же порядок кнопок в ряду действий. */
export const MARKDOWN_VIEWS: readonly MarkdownView[] = Object.freeze(['code', 'preview', 'split']);

/** Ключ настройки предпочтения. Пространство имён плагина — часть ключа, как у всех настроек. */
export const MARKDOWN_VIEW_SETTING = 'editor-markdown.view';

/**
 * Режим по умолчанию — исходник.
 *
 * Не предпросмотр: markdown в проекте форм чаще правят, чем читают, а открывшийся рендер
 * заставляет искать кнопку «показать текст» до того, как человек напечатает первый символ.
 */
export const DEFAULT_MARKDOWN_VIEW: MarkdownView = 'code';

/** Режим ли это. Непрозрачное значение из настроек приходит от прошлых версий приложения. */
export function isMarkdownView(value: unknown): value is MarkdownView {
  return value === 'code' || value === 'preview' || value === 'split';
}

/** Значение настройки → режим. Мусор трактуется как умолчание, а не как повод падать. */
export function readView(value: unknown): MarkdownView {
  return isMarkdownView(value) ? value : DEFAULT_MARKDOWN_VIEW;
}

/**
 * Следующий режим по кругу.
 *
 * `direction` — потому что цикл нужен в обе стороны: сочетание клавиш идёт вперёд, а пункт
 * меню «предыдущий вид» назад. Неизвестный текущий режим начинает круг с начала.
 */
export function cycleView(current: MarkdownView, direction: 1 | -1 = 1): MarkdownView {
  const at = MARKDOWN_VIEWS.indexOf(current);
  const size = MARKDOWN_VIEWS.length;
  const next = MARKDOWN_VIEWS[((((at === -1 ? 0 : at) + direction) % size) + size) % size];
  return next ?? DEFAULT_MARKDOWN_VIEW;
}

/**
 * Режим, доступный при текущих возможностях.
 *
 * Режим «рядом» требует редактора кода, который приходит ПОРТОМ от композиции (плагины
 * не импортируют друг друга). Без него «рядом» неотличим от предпросмотра, и показывать
 * кнопку, которая ничего не меняет, нельзя — она обещала бы вторую половину экрана.
 */
export function availableViews(hasTextEditor: boolean): readonly MarkdownView[] {
  return hasTextEditor ? MARKDOWN_VIEWS : MARKDOWN_VIEWS.filter((view) => view !== 'split');
}

/** Приводит режим к доступному: без редактора кода «рядом» становится предпросмотром. */
export function clampView(view: MarkdownView, hasTextEditor: boolean): MarkdownView {
  if (view === 'split' && !hasTextEditor) return 'preview';
  return view;
}
