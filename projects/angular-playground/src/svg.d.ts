/** SVG-файл приходит текстом: сборка подключает загрузчик `text` для расширения `.svg`. */
declare module '*.svg' {
  const text: string;
  export default text;
}
