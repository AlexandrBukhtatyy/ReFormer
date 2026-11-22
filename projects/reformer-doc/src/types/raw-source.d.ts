/**
 * Импорт `файл?raw` — исходник файла строкой (лоадер `plugins/raw-source-loader.cjs`).
 * Нужен `<LiveExample>`, чтобы показать код примера из того же файла, что и рендер.
 */
declare module '*?raw' {
  const source: string;
  export default source;
}
