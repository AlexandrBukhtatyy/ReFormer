/**
 * Разбор пакета npm — на НАСТОЯЩЕМ архиве и на подделках, собранных вручную.
 *
 * Два рода проверок, и оба нужны. Настоящий архив отвечает на вопрос «читаем ли мы то, что
 * кладёт npm»: выдуманный tar подтвердил бы только согласие нашего кода с нашим же
 * представлением о формате. Собранные вручную заголовки отвечают на второй вопрос — «что мы
 * отказываемся из него доставать», — и для него настоящий архив бесполезен: ссылок и путей
 * с `..` в нём нет, а проверять надо именно их.
 *
 * @module shell/platform/plugin/npm/package.test
 */

import { gzipSync } from 'node:zlib';

import { describe, expect, it } from 'vitest';

import { FIXTURE_INTEGRITY, fixtureTarball } from './__fixtures__/tarball';
import { readNpmPackage } from './package';
import { readTar } from './tar';

const encoder = new TextEncoder();

/** Октальное поле tar: значение, дополненное нулями до длины. */
function octal(value: number, length: number): string {
  return value.toString(8).padStart(length - 1, '0') + '\0';
}

/**
 * Собирает tar руками. Контрольная сумма заголовка НЕ считается: наш разбор её не проверяет
 * (подпись архива говорит о целостности несравнимо больше), и притворяться, что считает,
 * тест не должен.
 */
function makeTar(entries: readonly { path: string; type: string; body?: string }[]): Uint8Array {
  const blocks: Uint8Array[] = [];
  for (const entry of entries) {
    const body = encoder.encode(entry.body ?? '');
    const header = new Uint8Array(512);
    header.set(encoder.encode(entry.path.slice(0, 100)), 0);
    header.set(encoder.encode(octal(0o644, 8)), 100);
    header.set(encoder.encode(octal(body.length, 12)), 124);
    header.set(encoder.encode(entry.type), 156);
    header.set(encoder.encode('ustar\0'), 257);
    blocks.push(header);
    if (body.length > 0) {
      const padded = new Uint8Array(Math.ceil(body.length / 512) * 512);
      padded.set(body);
      blocks.push(padded);
    }
  }
  blocks.push(new Uint8Array(1024));

  const size = blocks.reduce((total, block) => total + block.length, 0);
  const tar = new Uint8Array(size);
  let offset = 0;
  for (const block of blocks) {
    tar.set(block, offset);
    offset += block.length;
  }
  return tar;
}

const gzip = (tar: Uint8Array): Uint8Array => new Uint8Array(gzipSync(tar));

async function sri(data: Uint8Array): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-512', data as BufferSource);
  return `sha512-${Buffer.from(digest).toString('base64')}`;
}

/** Архив из перечисленных записей плюс подпись к нему. */
async function packed(entries: Parameters<typeof makeTar>[0]) {
  const data = gzip(makeTar(entries));
  return { data, integrity: await sri(data) };
}

describe('пакет npm, собранный npm', () => {
  it('читается целиком, обёртка package/ снята', async () => {
    const result = await readNpmPackage(fixtureTarball(), { integrity: FIXTURE_INTEGRITY });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect([...result.files.keys()].sort()).toEqual([
      'locales/en.json',
      'locales/ru.json',
      'main.js',
      'manifest.json',
      'package.json',
    ]);
    const manifest = JSON.parse(new TextDecoder().decode(result.files.get('manifest.json')));
    expect(manifest).toMatchObject({ id: 'acme-hello', main: 'main.js' });
  });
});

describe('подпись', () => {
  it('не совпала — отказ, и распаковки не было', async () => {
    const bytes = fixtureTarball();
    const other = await sri(new Uint8Array([1, 2, 3]));

    const result = await readNpmPackage(bytes, { integrity: other });

    expect(result.ok || result.problem.code).toBe('integrity');
    expect(result.ok || result.problem.message).toContain('не совпала');
  });

  it('алгоритм не из списка — отказ с перечислением известных', async () => {
    const result = await readNpmPackage(fixtureTarball(), { integrity: 'sha1-Ym9ndXM=' });

    // SHA-1 из dist.shasum не принимается: его подделка по карману, а плагин исполняется
    // в том же realm, что и оболочка.
    expect(result.ok || result.problem.message).toContain('sha512');
  });

  it('пустая подпись — отказ, а не «сойдёт»', async () => {
    const result = await readNpmPackage(fixtureTarball(), { integrity: '   ' });

    expect(result.ok || result.problem.code).toBe('integrity');
  });
});

describe('что из архива доставать отказываемся', () => {
  it('симлинк — отказ целиком, а не пропуск записи', async () => {
    const { data, integrity } = await packed([
      { path: 'package/manifest.json', type: '0', body: '{}' },
      { path: 'package/secrets', type: '2' },
    ]);

    const result = await readNpmPackage(data, { integrity });

    expect(result.ok || result.problem.code).toBe('unpack');
    expect(result.ok || result.problem.message).toContain('ссылку');
  });

  it('путь за пределы архива — отказ', async () => {
    const { data, integrity } = await packed([
      { path: 'package/../../etc/passwd', type: '0', body: 'x' },
    ]);

    expect((await readNpmPackage(data, { integrity })).ok).toBe(false);
  });

  it('запись вне package/ — отказ: так пакеты npm не устроены', async () => {
    const { data, integrity } = await packed([{ path: 'other/main.js', type: '0', body: 'x' }]);
    const result = await readNpmPackage(data, { integrity });

    expect(result.ok || result.problem.code).toBe('layout');
  });

  it('не gzip — отказ распаковки', async () => {
    const data = makeTar([{ path: 'package/main.js', type: '0', body: 'x' }]);

    const result = await readNpmPackage(data, { integrity: await sri(data) });

    expect(result.ok || result.problem.code).toBe('unpack');
  });
});

describe('пределы', () => {
  it('слишком много файлов — отказ, а не усечение', () => {
    const entries = Array.from({ length: 5 }, (_, index) => ({
      path: `package/file${String(index)}.js`,
      type: '0',
      body: 'x',
    }));

    const result = readTar(makeTar(entries), { entries: 3, bytes: 1024 });

    // Усечение дало бы плагин, который «необъяснимо» падает на первом же импорте.
    expect(result.ok || result.reason).toContain('больше 3 файлов');
  });

  it('слишком большой распакованный объём — отказ', () => {
    const result = readTar(
      makeTar([{ path: 'package/big.js', type: '0', body: 'x'.repeat(600) }]),
      {
        entries: 10,
        bytes: 100,
      }
    );

    expect(result.ok || result.reason).toContain('100 байт');
  });
});

describe('каталоги и длинные пути', () => {
  it('каталоги в набор не попадают: путь несёт его сам', () => {
    const result = readTar(
      makeTar([
        { path: 'package/locales/', type: '5' },
        { path: 'package/locales/ru.json', type: '0', body: '{}' },
      ])
    );

    expect(result.ok && result.entries.map((entry) => entry.path)).toEqual([
      'package/locales/ru.json',
    ]);
  });

  it('PAX-заголовок задаёт путь следующей записи', () => {
    // Так `npm pack` кладёт пути длиннее ста символов.
    const long = `package/${'d'.repeat(120)}/main.js`;
    const record = `${String(`path=${long}\n`.length + 4)} path=${long}\n`;
    const result = readTar(
      makeTar([
        { path: 'PaxHeader', type: 'x', body: record },
        { path: 'package/truncated-name.js', type: '0', body: 'код' },
      ])
    );

    expect(result.ok && result.entries[0]?.path).toBe(long);
  });
});
