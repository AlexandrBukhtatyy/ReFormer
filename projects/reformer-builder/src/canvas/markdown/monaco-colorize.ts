/**
 * Подсветка fenced-блоков предпросмотра силами уже подключённого Monaco.
 *
 * `monaco.editor.colorize()` отдаёт готовый HTML с токенами и попутно инжектит в документ таблицу
 * цветов активной темы (`<style class="monaco-colors">`) — поэтому работает и когда редактор не
 * смонтирован (режим «Предпросмотр»). Плюсом получаем ровно те же цвета, что в редакторе слева,
 * без второго набора грамматик и без новой зависимости.
 *
 * Monaco тянется динамическим `import()`: документ без единого блока кода не грузит чанк редактора.
 *
 * @module reformer-builder/canvas/markdown/monaco-colorize
 */

import { fenceLanguage } from './fence-language';

type MonacoModule = typeof import('monaco-editor/editor/editor.api');

let monacoPromise: Promise<MonacoModule> | null = null;

/** Monaco + грамматики `basic-languages` (тот же инстанс, что у редактора). Грузится один раз. */
function loadMonaco(): Promise<MonacoModule> {
  monacoPromise ??= (async () => {
    const [monaco] = await Promise.all([
      import('monaco-editor/editor/editor.api'),
      import('../monaco-languages'),
    ]);
    return monaco;
  })();
  return monacoPromise;
}

/**
 * HTML с токенами Monaco для блока кода; `null` — язык не указан либо незнаком (рисуем как есть).
 *
 * Тему выставляем перед подсветкой: индексы классов `mtkN` привязаны к АКТИВНОЙ теме, поэтому при
 * её смене блоки надо красить заново (вызывающая сторона держит `dark` в зависимостях эффекта).
 */
export async function colorizeCode(
  code: string,
  info: string | null,
  dark: boolean
): Promise<string | null> {
  const language = fenceLanguage(info);
  if (!language || language === 'plaintext') return null;
  try {
    const monaco = await loadMonaco();
    monaco.editor.setTheme(dark ? 'vs-dark' : 'vs');
    const html = await monaco.editor.colorize(code, language, { tabSize: 2 });
    // colorize завершает вывод переводом строки — в <pre> он дал бы лишнюю пустую строку.
    return html.replace(/<br\s*\/?>$/, '');
  } catch {
    return null;
  }
}
