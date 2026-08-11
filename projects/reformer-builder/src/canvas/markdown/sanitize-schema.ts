/**
 * Схема санитайзера предпросмотра (`rehype-sanitize`).
 *
 * Raw-HTML внутри markdown мы рендерим (`rehype-raw`) — в README он встречается постоянно
 * (`<details>`, `<br>`, `<img>`), и без него текст выглядел бы «пропавшим». Раз так, HTML обязан
 * проходить через санитайзер: файл открыт из чужого каталога, а оболочка билдера держит handle
 * файловой системы — исполнение чего-либо из markdown недопустимо.
 *
 * За основу берём `defaultSchema` (GitHub-совместимая, уже разрешает `details`, чек-боксы GFM и
 * `className` вида `language-*` на `<code>`) и правим ровно три вещи — см. комментарии ниже.
 *
 * @module reformer-builder/canvas/markdown/sanitize-schema
 */

import { defaultSchema } from 'rehype-sanitize';
import type { Options } from 'rehype-sanitize';

const base = defaultSchema;
const anyAttributes = base.attributes?.['*'] ?? [];

export const sanitizeSchema: Options = {
  ...base,
  attributes: {
    ...base.attributes,
    // `dataLine` — наша разметка строк исходника для синхроскролла (см. `rehype-source-line`).
    '*': [...anyAttributes, 'dataLine'],
    // `data:`-картинки (см. protocols ниже) плюс размеры, которые пишут в HTML-вставках.
    img: [...(base.attributes?.img ?? []), 'width', 'height'],
  },
  protocols: {
    ...base.protocols,
    // Инлайновые картинки `data:image/...` — обычное дело в самодостаточных README.
    src: [...(base.protocols?.src ?? []), 'data'],
  },
  // По умолчанию санитайзер префиксует `id` («user-content-»), чтобы разметка не переопределяла
  // свойства документа. Нам префикс ломает главное — якоря: `rehype-slug` кладёт в `id` тот самый
  // slug, на который ссылается оглавление самого файла. Ищем якорь мы внутри своего контейнера,
  // в отдельном поддереве, так что отключаем префикс осознанно.
  clobberPrefix: '',
};
