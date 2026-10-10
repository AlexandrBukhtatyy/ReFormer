/**
 * Правило `url(options?)` — формат URL.
 *
 * Проверка — regex: необязательный `http(s)://`, домен с точкой и зоной из 2–6 букв, путь из
 * `[/\w .-]`, необязательные query и fragment. `requireProtocol` делает протокол обязательным, `allowedProtocols` сужает набор
 * (замечание `url_protocol` с `params.allowedProtocols`); регистр значения не важен.
 *
 * Зонды (порт, localhost, IP, IDN, userinfo, пробелы) фиксируют ТЕКУЩЕЕ поведение с пометкой
 * «поведение под вопросом»: какие адреса допустимы — решение контракта [ReFormer-4srm]. Бывшие
 * дефекты: адрес с query или fragment отклонялся [ReFormer-o1n1]; вложенный квантификатор пути
 * `([/\w .-]*)*` давал экспоненциальный перебор на невалидном вводе — поле «зависало»
 * [ReFormer-jgsu].
 */

import { describe, expect, it } from 'vitest';
import { url } from '../../../src/form/validators/url';
import { checkRule, describeRule } from '../../test-utils/rule-table';

describeRule('url — без опций: протокол необязателен', url(), [
  { value: 'example.com', code: null },
  { value: 'http://example.com', code: null },
  { value: 'https://example.com/', code: null },
  { value: 'https://sub.example.co.uk/path/to/page.html', code: null },
  { value: 'https://my-site.example.com/a_b/c-d', code: null },
  { value: 'HTTPS://EXAMPLE.COM/PATH', code: null, label: 'верхний регистр' },
]);

describeRule('url — без опций: недопустимые значения', url(), [
  { value: 'not a url', code: 'url' },
  { value: 'https://example', code: 'url', label: 'без зоны' },
  { value: 'http://', code: 'url' },
  { value: 'ftp://example.com', code: 'url', label: 'протокол не http(s)' },
  { value: 'mailto:user@example.com', code: 'url' },
  { value: '//example.com', code: 'url', label: 'протокол-относительный адрес' },
  { value: 'https://exa mple.com', code: 'url', label: 'пробел в домене' },
]);

describeRule('url — requireProtocol', url({ requireProtocol: true }), [
  { value: 'http://example.com', code: null },
  { value: 'https://example.com/path', code: null },
  { value: 'HTTP://EXAMPLE.COM', code: null, label: 'протокол в верхнем регистре' },
  { value: 'example.com', code: 'url', label: 'без протокола' },
]);

describeRule('url — allowedProtocols: [https]', url({ allowedProtocols: ['https'] }), [
  { value: 'https://example.com', code: null },
  { value: 'HTTPS://EXAMPLE.COM', code: null, label: 'регистр значения не важен' },
  { value: 'http://example.com', code: 'url_protocol', params: { allowedProtocols: ['https'] } },
  {
    value: 'example.com',
    code: 'url_protocol',
    params: { allowedProtocols: ['https'] },
    label: 'без протокола — тоже url_protocol',
  },
  { value: 'not a url', code: 'url', label: 'сначала формат: не адрес — url' },
]);

describeRule(
  'url — allowedProtocols: [http, https]',
  url({ allowedProtocols: ['http', 'https'] }),
  [
    { value: 'http://example.com', code: null },
    { value: 'https://example.com', code: null },
    { value: 'example.com', code: 'url_protocol', params: { allowedProtocols: ['http', 'https'] } },
  ]
);

describeRule('url — пустой allowedProtocols не ограничивает', url({ allowedProtocols: [] }), [
  { value: 'http://example.com', code: null },
  { value: 'example.com', code: null },
]);

describeRule(
  'url — пустые значения пропускаются',
  url({ requireProtocol: true, allowedProtocols: ['https'] }),
  [
    { value: '', code: null },
    { value: null, code: null },
    { value: undefined, code: null },
  ]
);

describe('url — опции', () => {
  it('у замечания формата только код', () => {
    expect(url()('not a url')).toEqual({ code: 'url' });
  });

  it('свой код заменяет url, params из опций переходят в замечание', () => {
    expect(url({ code: 'site.url', params: { example: 'https://site.ru' } })('x')).toEqual({
      code: 'site.url',
      params: { example: 'https://site.ru' },
    });
  });

  // поведение под вопросом [ReFormer-4srm]: один `code` из опций заменяет ОБА встроенных кода (url и url_protocol) —
  // разные тексты для «не адрес» и «не тот протокол» своим кодом не задать.
  it('свой код заменяет и url_protocol; params сливаются, из опций главнее', () => {
    const rule = url({
      allowedProtocols: ['https'],
      code: 'site.url',
      params: { allowedProtocols: 'только https', hint: 'x' },
    });
    expect(rule('http://example.com')).toEqual({
      code: 'site.url',
      params: { allowedProtocols: 'только https', hint: 'x' },
    });
  });
});

describe('url — зонды: порт, localhost, IP, IDN (поведение под вопросом)', () => {
  // поведение под вопросом [ReFormer-4srm]: regex требует буквенную зону и не знает порта/userinfo — отклоняются
  // адреса, валидные по WHATWG URL (dev-адреса, IP, кириллические домены), зато пробелы в «пути»
  // и длинные зоны проходят. Нужен ли public-only контракт — решать при переписывании правила.
  checkRule(url(), [
    { value: 'http://example.com:8080', code: 'url', label: 'порт отклоняется' },
    { value: 'example.com:8080', code: 'url', label: 'порт без протокола отклоняется' },
    { value: 'http://localhost', code: 'url', label: 'localhost отклоняется — нет зоны' },
    { value: 'http://localhost:3000', code: 'url', label: 'localhost с портом отклоняется' },
    { value: 'http://192.168.0.1', code: 'url', label: 'IPv4 отклоняется — цифры в зоне' },
    { value: 'https://пример.рф', code: 'url', label: 'кириллический домен (IDN) отклоняется' },
    {
      value: 'https://xn--e1afmkfd.xn--p1ai',
      code: null,
      label: 'тот же домен в punycode проходит',
    },
    { value: 'https://user:pass@example.com', code: 'url', label: 'userinfo отклоняется' },
    { value: 'example.com hello world', code: null, label: 'пробелы в «пути» проходят' },
    { value: 'https://example.photography', code: null, label: 'зона длиннее 6 букв проходит' },
  ]);
});

describe('url — протоколы вне http(s) (поведение под вопросом)', () => {
  // поведение под вопросом [ReFormer-4srm]: JSDoc обещает url_protocol для «иного протокола», но regex знает только
  // http(s) — ftp:// даёт url, а allowedProtocols: ['ftp'] не пропустит ни один адрес.
  checkRule(url({ allowedProtocols: ['https'] }), [
    {
      value: 'ftp://example.com',
      code: 'url',
      label: 'ftp:// при [https] — url, а не url_protocol',
    },
  ]);
  checkRule(url({ allowedProtocols: ['ftp'] }), [
    { value: 'ftp://example.com', code: 'url', label: 'ftp:// при [ftp] — url' },
  ]);
  // поведение под вопросом [ReFormer-4srm]: значение приводится к нижнему регистру, а записи allowedProtocols — нет:
  // ['HTTPS'] не пропускает ни одного адреса.
  checkRule(url({ allowedProtocols: ['HTTPS'] }), [
    {
      value: 'https://example.com',
      code: 'url_protocol',
      params: { allowedProtocols: ['HTTPS'] },
      label: 'https:// при [HTTPS] — url_protocol',
    },
  ]);
});

describe('url — query и fragment [ReFormer-o1n1]', () => {
  it('адрес с query-строкой допустим [ReFormer-o1n1]', () => {
    expect(url()('https://example.com/search?q=1')).toBeNull();
  });

  it('адрес с фрагментом допустим [ReFormer-o1n1]', () => {
    expect(url()('https://example.com/docs#install')).toBeNull();
  });

  it('query с фрагментом и query без пути допустимы', () => {
    expect([
      url()('https://example.com/search?q=a+b&page=2#results'),
      url({ requireProtocol: true })('https://example.com?q=1'),
    ]).toEqual([null, null]);
  });

  it('пробел в query или fragment — не адрес', () => {
    expect([
      url()('https://example.com/search?q=a b')?.code,
      url()('https://example.com/docs#part two')?.code,
    ]).toEqual(['url', 'url']);
  });
});

describe('url — время проверки невалидного ввода [ReFormer-jgsu]', () => {
  // Было: каждый символ пути перед недопустимым удваивал перебор — 23 символа ~0.5 с, 26 — ~4 с.
  it('23 символа пути и недопустимый символ проверяются быстрее 50 мс [ReFormer-jgsu]', () => {
    const input = `https://example.com/${'a'.repeat(23)}"`;
    const started = performance.now();
    url()(input);
    expect(performance.now() - started).toBeLessThan(50);
  });

  it('2000 символов пути и недопустимый символ — тоже быстрее 50 мс', () => {
    const input = `https://example.com/${'a/'.repeat(1000)}"`;
    const started = performance.now();
    const issue = url()(input);
    expect([issue?.code, performance.now() - started < 50]).toEqual(['url', true]);
  });
});
