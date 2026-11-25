/**
 * Whitelist HTML-тегов и чистка DOM-атрибутов для оператора `$html(tag)`.
 *
 * JSON-схема — недоверенный вход: она задумана как артефакт, который может прийти строкой с сервера
 * или из CMS. Поэтому, в отличие от типизированной RenderSchema (там `component: 'div'` пишет автор
 * формы в своём же коде), JSON-ветка пропускает только теги из {@link ALLOWED_HTML_TAGS} и вычищает
 * атрибуты, через которые в разметку попадает исполняемый код.
 *
 * Whitelist, а не denylist: список ограничен вёрсткой и растёт осознанно, тогда как denylist молча
 * пропускает всё, о чём не подумали.
 *
 * @module reformer/renderer-json/html
 */

/**
 * Разрешённые в `$html(...)` теги — presentational-разметка форм: блоки, типографика, списки,
 * таблицы, медиа. Намеренно НЕ входят: `script`/`style`/`link`/`meta`/`base` (исполнение и загрузка
 * ресурсов), `iframe`/`object`/`embed` (встраивание чужого контекста), `form`/`button`/`input`/
 * `select`/`textarea` (управление формой — это поля схемы, а не вёрстка), `slot`/`template`.
 */
export const ALLOWED_HTML_TAGS: ReadonlySet<string> = new Set([
  // Блоки и секционирование
  'div',
  'section',
  'article',
  'aside',
  'header',
  'footer',
  'nav',
  'main',
  'figure',
  'figcaption',
  'details',
  'summary',
  'fieldset',
  'legend',
  // Типографика
  'p',
  'span',
  'h1',
  'h2',
  'h3',
  'h4',
  'h5',
  'h6',
  'strong',
  'b',
  'em',
  'i',
  'u',
  's',
  'small',
  'mark',
  'sub',
  'sup',
  'code',
  'pre',
  'kbd',
  'samp',
  'var',
  'blockquote',
  'cite',
  'q',
  'abbr',
  'time',
  'address',
  'label',
  'br',
  'hr',
  'a',
  // Списки
  'ul',
  'ol',
  'li',
  'dl',
  'dt',
  'dd',
  // Таблицы
  'table',
  'caption',
  'colgroup',
  'col',
  'thead',
  'tbody',
  'tfoot',
  'tr',
  'th',
  'td',
  // Медиа
  'img',
  'picture',
  'source',
  'video',
  'audio',
  'track',
  // Прогресс
  'progress',
  'meter',
]);

/**
 * Тег разрешён в `$html(...)`?
 *
 * @param tag - Имя тега из оператора (регистр приводится к нижнему).
 * @returns `true`, если тег входит в {@link ALLOWED_HTML_TAGS}.
 *
 * @example
 * ```ts
 * isAllowedHtmlTag('p');      // true
 * isAllowedHtmlTag('script'); // false
 * ```
 */
export function isAllowedHtmlTag(tag: string): boolean {
  return ALLOWED_HTML_TAGS.has(tag.toLowerCase());
}

/**
 * Имя атрибута для сравнения: без регистра, разделителей и префиксов привязки.
 *
 * Один и тот же атрибут пишут по-разному: React — `srcSet` и `xlinkHref`, разметка, Vue и Angular —
 * `srcset` и `xlink:href`; Vue вдобавок понимает `.innerHTML` (свойство DOM) и `^onclick` (атрибут).
 * Сравнение по точному написанию пропускало бы всё, что написано не так, как в React.
 */
function normalizedPropName(key: string): string {
  return key.toLowerCase().replace(/[^a-z0-9]/g, '');
}

/**
 * Атрибуты, чьё значение браузер трактует как URL — их схема может превратить в исполнение кода.
 * Имена — в виде {@link normalizedPropName}.
 */
const URL_PROPS: ReadonlySet<string> = new Set([
  'href',
  'src',
  'srcset',
  'poster',
  'action',
  'formaction',
  'data',
  'xlinkhref',
  'cite',
  'ping',
]);

/**
 * Атрибуты и свойства DOM, значение которых браузер разбирает как разметку. Имена — в виде
 * {@link normalizedPropName}.
 */
const RAW_HTML_PROPS: ReadonlySet<string> = new Set([
  'dangerouslysetinnerhtml',
  'innerhtml',
  'outerhtml',
  'srcdoc',
]);

/**
 * URL опасен? Схема-строка сравнивается после снятия управляющих символов и пробелов — иначе
 * `"java\tscript:alert(1)"` и `" javascript:…"` прошли бы мимо проверки (браузер их нормализует
 * и исполнит). `data:` разрешён только для картинок: `data:text/html` — полноценный XSS-вектор.
 */
function isDangerousUrl(value: string): boolean {
  // Управляющие символы и пробелы отбрасываются посимвольно (regex по \x00-\x20 читается хуже
  // и требует отключения no-control-regex).
  const normalized = Array.from(value)
    .filter((ch) => ch.charCodeAt(0) > 0x20)
    .join('')
    .toLowerCase();
  if (normalized.startsWith('javascript:') || normalized.startsWith('vbscript:')) return true;
  if (normalized.startsWith('data:')) return !normalized.startsWith('data:image/');
  return false;
}

/**
 * Чистит props HTML-узла: убирает сырую разметку (`dangerouslySetInnerHTML`, `innerHTML`,
 * `outerHTML`, `srcdoc`), обработчики `on*` и URL-атрибуты с исполняемой схемой. Возвращает НОВЫЙ
 * объект (исходный не мутируется); если чистить нечего — исходную ссылку.
 *
 * Обработчики выкидываются, а не пропускаются: из JSON они приходят строками, и `$fn(...)`-резолв
 * мог бы подставить туда и функцию — а исполняемое поведение недоверенной разметке не положено.
 *
 * Имена сравниваются без регистра и разделителей: чистка не знает, кто нарисует узел. React
 * строковый `onclick` проигнорирует, а Vue и Angular поставят его атрибутом — и браузер его
 * исполнит; то же с `innerHTML`, который у них пишется прямо в свойство DOM.
 *
 * @param props - `componentProps` html-узла (уже после резолва операторов).
 * @param tag - Тег узла — только для текста предупреждения.
 * @returns Очищенные props.
 *
 * @example
 * ```ts
 * sanitizeHtmlProps({ className: 'p-4', href: 'javascript:alert(1)' }, 'a');
 * // → { className: 'p-4' } + console.warn
 * ```
 */
export function sanitizeHtmlProps(
  props: Record<string, unknown> | undefined,
  tag: string
): Record<string, unknown> | undefined {
  if (!props) return props;
  let dropped: string[] | null = null;
  const out: Record<string, unknown> = {};
  for (const key of Object.keys(props)) {
    const value = props[key];
    const name = normalizedPropName(key);
    // Любое имя на `on…`: и `onClick`, и `onclick`, и `onUpdate:modelValue`. Атрибутов разметки,
    // которые начинаются с `on` и при этом не обработчики, в HTML нет.
    const isEventHandler = name.length > 2 && name.startsWith('on');
    const isDangerousUrlProp =
      URL_PROPS.has(name) && typeof value === 'string' && isDangerousUrl(value);
    if (RAW_HTML_PROPS.has(name) || isEventHandler || isDangerousUrlProp) {
      (dropped ??= []).push(key);
      continue;
    }
    out[key] = value;
  }
  if (!dropped) return props;
  if (typeof console !== 'undefined') {
    console.warn(
      `[JsonRenderer] $html(${tag}): отброшены небезопасные props — ${dropped.join(', ')}. ` +
        'HTML-узлы предназначены для презентационной разметки: исполняемые обработчики, ' +
        'сырой innerHTML и javascript:/data:-URL в них не пропускаются.'
    );
  }
  return out;
}
