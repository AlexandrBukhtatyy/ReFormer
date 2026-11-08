/**
 * Webpack-лоадер для импортов с `?raw`: отдаёт исходник файла строкой.
 *
 * Стоит с `enforce: 'pre'` и поэтому получает файл ДО остальных лоадеров. Правило Babel
 * у Docusaurus сопоставляется по пути без query и тоже применится к `example.tsx?raw`, но уже
 * к результату этого лоадера — модулю из одной строки `export default "<исходник>"`. Тип
 * `asset/source` здесь не годится: он отдал бы текст ПОСЛЕ Babel, то есть транспилированный код.
 *
 * @param {string} source исходный текст файла
 * @returns {string} ES-модуль, экспортирующий исходник строкой
 */
module.exports = function rawSourceLoader(source) {
  return `export default ${JSON.stringify(source)};`;
};
