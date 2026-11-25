/**
 * Whitelist тегов и чистка DOM-атрибутов html-узлов.
 *
 * Смысл проверок: JSON-схема может прийти с сервера, поэтому «отбрасывается» здесь важнее, чем
 * «рендерится» — каждый кейс ниже соответствует вектору, который иначе доехал бы до DOM.
 */
import { describe, it, expect, vi, afterEach } from 'vitest';
import { ALLOWED_HTML_TAGS, isAllowedHtmlTag, sanitizeHtmlProps } from './html-tags';

afterEach(() => {
  vi.restoreAllMocks();
});

/** Глушит ожидаемый warn санитайзера, чтобы вывод тестов оставался чистым. */
const silenceWarn = (): void => {
  vi.spyOn(console, 'warn').mockImplementation(() => {});
};

describe('isAllowedHtmlTag', () => {
  it('пропускает презентационные теги', () => {
    for (const tag of ['div', 'p', 'h3', 'ul', 'li', 'table', 'img', 'hr', 'a']) {
      expect(isAllowedHtmlTag(tag)).toBe(true);
    }
  });

  it('отвергает исполняемые и встраивающие теги', () => {
    for (const tag of ['script', 'style', 'iframe', 'object', 'embed', 'link', 'meta', 'base']) {
      expect(isAllowedHtmlTag(tag)).toBe(false);
    }
  });

  it('отвергает управляющие элементы формы — поля описываются узлами схемы', () => {
    for (const tag of ['form', 'input', 'select', 'textarea', 'button']) {
      expect(isAllowedHtmlTag(tag)).toBe(false);
    }
  });

  it('нечувствителен к регистру', () => {
    expect(isAllowedHtmlTag('DIV')).toBe(true);
    expect(isAllowedHtmlTag('ScRiPt')).toBe(false);
  });

  it('whitelist непустой и содержит базовую вёрстку', () => {
    expect(ALLOWED_HTML_TAGS.size).toBeGreaterThan(40);
    expect(ALLOWED_HTML_TAGS.has('span')).toBe(true);
  });
});

describe('sanitizeHtmlProps', () => {
  it('оставляет обычные атрибуты нетронутыми (та же ссылка, если чистить нечего)', () => {
    const props = { className: 'p-4', id: 'notice', 'aria-live': 'polite' };
    expect(sanitizeHtmlProps(props, 'div')).toBe(props);
  });

  it('выбрасывает dangerouslySetInnerHTML', () => {
    silenceWarn();
    const out = sanitizeHtmlProps(
      { className: 'x', dangerouslySetInnerHTML: { __html: '<img onerror=alert(1)>' } },
      'div'
    );
    expect(out).toEqual({ className: 'x' });
  });

  it('выбрасывает обработчики событий', () => {
    silenceWarn();
    const out = sanitizeHtmlProps({ onClick: 'alert(1)', onMouseOver: 'x', title: 'ok' }, 'div');
    expect(out).toEqual({ title: 'ok' });
  });

  // React строковый `onclick` проигнорирует, а Vue и Angular поставят его атрибутом разметки —
  // и браузер исполнит. Чистка не знает, кто нарисует узел, поэтому регистр не различает.
  it('выбрасывает обработчики в написании разметки — строчными', () => {
    silenceWarn();
    const out = sanitizeHtmlProps(
      { onclick: 'alert(1)', onerror: 'alert(2)', ONLOAD: 'alert(3)', title: 'ok' },
      'img'
    );
    expect(out).toEqual({ title: 'ok' });
  });

  it('выбрасывает обработчики в написании Vue: событие модели, префиксы привязки, кебаб', () => {
    silenceWarn();
    const out = sanitizeHtmlProps(
      {
        'onUpdate:modelValue': () => {},
        '^onclick': 'alert(1)',
        '.onclick': () => {},
        'on-click': 'alert(1)',
        onVnodeMounted: () => {},
        id: 'x',
      },
      'div'
    );
    expect(out).toEqual({ id: 'x' });
  });

  // Атрибутов разметки на `on…`, которые не обработчики, в HTML нет: список известных событий
  // пропускал бы каждое новое, поэтому отбрасывается любое такое имя.
  it('отбрасывает любое имя на "on" — списка «безопасных» нет', () => {
    silenceWarn();
    expect(sanitizeHtmlProps({ onlyChild: true, once: 'x', lang: 'ru' }, 'div')).toEqual({
      lang: 'ru',
    });
  });

  it('не трогает имена, где "on" не в начале', () => {
    const props = { 'aria-controls': 'panel', 'data-on': '1', loading: 'lazy', on: 'x' };
    expect(sanitizeHtmlProps(props, 'div')).toBe(props);
  });

  // Vue и Angular пишут такие props прямо в свойство DOM — это тот же вектор, что
  // `dangerouslySetInnerHTML` в React.
  it.each(['innerHTML', 'innerhtml', '.innerHTML', 'outerHTML', 'srcdoc', 'srcDoc'])(
    'выбрасывает сырую разметку: %s',
    (key) => {
      silenceWarn();
      expect(sanitizeHtmlProps({ [key]: '<img src=x onerror=alert(1)>', id: 'x' }, 'div')).toEqual({
        id: 'x',
      });
    }
  );

  it.each(['srcset', 'srcSet', 'formaction', 'formAction', 'xlink:href', 'xlinkHref', 'HREF'])(
    'проверяет URL-атрибут в любом написании: %s',
    (key) => {
      silenceWarn();
      expect(sanitizeHtmlProps({ [key]: 'javascript:alert(1)' }, 'a')).toEqual({});
      const safe = { [key]: '/static/logo.png' };
      expect(sanitizeHtmlProps(safe, 'a')).toBe(safe);
    }
  );

  it('выбрасывает javascript:-URL', () => {
    silenceWarn();
    const out = sanitizeHtmlProps({ href: 'javascript:alert(1)', className: 'link' }, 'a');
    expect(out).toEqual({ className: 'link' });
  });

  it('ловит javascript:-URL, замаскированный пробелами и управляющими символами', () => {
    silenceWarn();
    const out = sanitizeHtmlProps({ href: '  java\tscript:alert(1)' }, 'a');
    expect(out).toEqual({});
  });

  it('выбрасывает data:text/html, но пропускает data:image', () => {
    silenceWarn();
    expect(sanitizeHtmlProps({ src: 'data:text/html;base64,PHNjcmlwdD4=' }, 'img')).toEqual({});
    const safe = { src: 'data:image/png;base64,iVBORw0KGgo=' };
    expect(sanitizeHtmlProps(safe, 'img')).toBe(safe);
  });

  it('пропускает обычные http/относительные URL', () => {
    const props = { href: 'https://example.com/docs', src: '/static/logo.png' };
    expect(sanitizeHtmlProps(props, 'a')).toBe(props);
  });

  it('предупреждает о том, что именно отброшено', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    sanitizeHtmlProps({ onClick: 'x' }, 'div');
    expect(warn).toHaveBeenCalledTimes(1);
    expect(warn.mock.calls[0][0]).toContain('onClick');
    expect(warn.mock.calls[0][0]).toContain('$html(div)');
  });

  it('undefined-props проходят как есть', () => {
    expect(sanitizeHtmlProps(undefined, 'div')).toBeUndefined();
  });
});
