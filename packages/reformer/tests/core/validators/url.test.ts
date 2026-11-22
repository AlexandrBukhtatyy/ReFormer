/**
 * Правило `url(options?)` — формат URL.
 *
 * Контракт [ReFormer-4srm]: разбор — `new URL`; хост — `localhost`, домен с буквенной зоной (в том
 * числе кириллический и punycode), IPv4 или `[IPv6]`; порт допустим; пробелы и userinfo запрещены.
 * Протокол необязателен, пока не задан `requireProtocol`; по умолчанию разрешены `http` и `https`,
 * чужой протокол — `url_protocol` с `params.allowedProtocols`; сравнение без учёта регистра.
 *
 * Бывшие дефекты: адрес с query или fragment отклонялся [ReFormer-o1n1]; вложенный квантификатор
 * пути `([/\w .-]*)*` давал экспоненциальный перебор на невалидном вводе — поле «зависало»
 * [ReFormer-jgsu]; регулярка домена перебирала точки квадратично на вводе вида `a.a.a.…`
 * [ReFormer-4srm].
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
  {
    value: 'ftp://example.com',
    code: 'url_protocol',
    params: { allowedProtocols: ['http', 'https'] },
    label: 'протокол не http(s) — url_protocol [ReFormer-4srm]',
  },
  { value: 'mailto:user@example.com', code: 'url' },
  { value: 'example', code: 'url', label: 'одно слово — не адрес' },
  { value: '123', code: 'url', label: 'число — не IP-адрес' },
  { value: 'http://example.com:99999', code: 'url', label: 'порт вне диапазона' },
  { value: 'http://-bad-.example.com', code: 'url', label: 'метка домена с дефисом по краям' },
  { value: 'http://my_site.example.com', code: 'url', label: 'подчёркивание в домене' },
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

  // Контракт (JSDoc url) [ReFormer-4srm]: свой `code` заменяет оба встроенных кода — url и url_protocol.
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

describe('url — порт, localhost, IP, IDN, userinfo, пробелы [ReFormer-4srm]', () => {
  checkRule(url(), [
    { value: 'http://example.com:8080', code: null, label: 'порт' },
    { value: 'example.com:8080', code: null, label: 'порт без протокола' },
    { value: 'http://localhost', code: null, label: 'localhost' },
    { value: 'localhost:3000', code: null, label: 'localhost с портом без протокола' },
    { value: 'http://192.168.0.1', code: null, label: 'IPv4' },
    { value: 'http://[::1]:3000/path', code: null, label: 'IPv6 с портом' },
    { value: 'http://256.1.1.1', code: 'url', label: 'IPv4 вне диапазона' },
    { value: 'https://пример.рф', code: null, label: 'кириллический домен' },
    { value: 'https://xn--e1afmkfd.xn--p1ai', code: null, label: 'тот же домен в punycode' },
    { value: 'https://example.photography', code: null, label: 'длинная зона' },
    { value: 'https://user:pass@example.com', code: 'url', label: 'userinfo запрещён' },
    { value: 'https://user@example.com', code: 'url', label: 'userinfo без пароля запрещён' },
    { value: 'example.com hello world', code: 'url', label: 'пробелы запрещены' },
    { value: 'https://example.com/a\tb', code: 'url', label: 'табуляция запрещена' },
  ]);
});

describe('url — протоколы [ReFormer-4srm]', () => {
  checkRule(url({ allowedProtocols: ['https'] }), [
    {
      value: 'ftp://example.com',
      code: 'url_protocol',
      params: { allowedProtocols: ['https'] },
      label: 'ftp:// при [https] — url_protocol',
    },
  ]);
  checkRule(url({ allowedProtocols: ['ftp'] }), [
    { value: 'ftp://example.com', code: null, label: 'ftp:// при [ftp] проходит' },
    { value: 'FTP://example.com/file.txt', code: null, label: 'регистр протокола не важен' },
  ]);
  checkRule(url({ allowedProtocols: ['HTTPS'] }), [
    { value: 'https://example.com', code: null, label: 'https:// при [HTTPS] проходит' },
    {
      value: 'http://example.com',
      code: 'url_protocol',
      params: { allowedProtocols: ['HTTPS'] },
      label: 'в params — список как задан',
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
  it('домен из 20 000 меток без зоны проверяется быстрее 50 мс [ReFormer-4srm]', () => {
    const input = `https://${'a.'.repeat(20_000)}1`;
    const started = performance.now();
    const issue = url()(input);
    expect([issue?.code, performance.now() - started < 50]).toEqual(['url', true]);
  });

  // Было: каждый символ пути перед недопустимым удваивал перебор — 23 символа ~0.5 с, 26 — ~4 с.
  it('23 символа пути и недопустимый символ проверяются быстрее 50 мс [ReFormer-jgsu]', () => {
    const input = `https://example.com/${'a'.repeat(23)}"`;
    const started = performance.now();
    url()(input);
    expect(performance.now() - started).toBeLessThan(50);
  });

  it('2000 символов пути и недопустимый символ — тоже быстрее 50 мс', () => {
    const input = `https://example.com/${'a/'.repeat(1000)} `;
    const started = performance.now();
    const issue = url()(input);
    expect([issue?.code, performance.now() - started < 50]).toEqual(['url', true]);
  });
});
