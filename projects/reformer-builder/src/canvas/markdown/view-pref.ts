/**
 * Переключение режима markdown-вкладки и его «липкое» предпочтение: следующий открытый `.md`
 * показывается так же, как пользователь смотрел предыдущий. Побочка (localStorage) вынесена сюда,
 * чтобы редьюсеры остались чистыми — `store/reducers` получает готовое значение через
 * `OpenOptions.mdView`.
 *
 * @module reformer-builder/canvas/markdown/view-pref
 */

import { editorActions, editorStore, type MarkdownView } from '../../store';
import { activeTab } from '../../store/reducers';
import { isMarkdownTab } from './is-markdown';

const KEY = 'rb.md.view';

/** Порядок сегментов переключателя — он же порядок цикла по ⇧⌘V. */
export const MD_VIEW_ORDER: readonly MarkdownView[] = ['code', 'preview', 'split'];

/** Режим для только что открытого markdown-файла: последний выбранный, по умолчанию — исходник. */
export function preferredMarkdownView(): MarkdownView {
  try {
    const saved = localStorage.getItem(KEY);
    if (saved === 'code' || saved === 'preview' || saved === 'split') return saved;
  } catch {
    /* приватный режим / отключённое хранилище — просто дефолт */
  }
  return 'code';
}

/** Запомнить выбор пользователя (вызывается вместе с `editorActions.setMdView`). */
function rememberMarkdownView(view: MarkdownView): void {
  try {
    localStorage.setItem(KEY, view);
  } catch {
    /* не критично: режим просто не переживёт перезагрузку */
  }
}

/** Переключить режим вкладки и запомнить его как дефолт для следующих markdown-файлов. */
export function applyMarkdownView(tabId: string, view: MarkdownView): void {
  rememberMarkdownView(view);
  editorActions.setMdView(tabId, view);
}

/**
 * Сдвинуть режим активной markdown-вкладки по кругу (⇧⌘V → вперёд, ⇧ уже занят — назад идём
 * из меню). На не-markdown вкладке ничего не делает: там сочетание должно остаться браузеру.
 */
export function cycleMarkdownView(delta: 1 | -1 = 1): void {
  const tab = activeTab(editorStore.getState());
  if (!isMarkdownTab(tab)) return;
  const current = tab?.mdView ?? 'code';
  const i = MD_VIEW_ORDER.indexOf(current);
  const next = MD_VIEW_ORDER[(i + delta + MD_VIEW_ORDER.length) % MD_VIEW_ORDER.length];
  applyMarkdownView(tab!.id, next);
}
