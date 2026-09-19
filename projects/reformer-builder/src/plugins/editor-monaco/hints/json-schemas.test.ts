import { describe, expect, it } from 'vitest';
import {
  createJsonSchemaRegistry,
  declaredSchema,
  resolveDeclaredSchema,
  type SchemaEntry,
  type UriLike,
} from './json-schemas';

function setup() {
  const published: SchemaEntry[][] = [];
  const registry = createJsonSchemaRegistry((schemas) => {
    published.push(schemas);
  });
  return { registry, published, last: () => published[published.length - 1] };
}

const KIT_A = { uri: 'inmemory://schema/a.json', schema: { title: 'a' } };
const KIT_B = { uri: 'inmemory://schema/b.json', schema: { title: 'b' } };

describe('createJsonSchemaRegistry', () => {
  it('документы копятся в fileMatch одной схемы', () => {
    const { registry, last } = setup();
    registry.associate('doc://1', KIT_A, null);
    registry.associate('doc://2', KIT_A, null);
    expect(last()).toEqual([
      { uri: KIT_A.uri, fileMatch: ['doc://1', 'doc://2'], schema: KIT_A.schema },
    ]);
  });

  it('повтор с тем же ответом не публикует — воркер не перезапускается', () => {
    const { registry, published } = setup();
    registry.associate('doc://1', KIT_A, null);
    registry.associate('doc://1', KIT_A, null);
    expect(published).toHaveLength(1);
  });

  it('смена кита переносит документ, осиротевшая схема уходит', () => {
    const { registry, last } = setup();
    registry.associate('doc://1', KIT_A, null);
    registry.associate('doc://1', KIT_B, null);
    expect(last()).toEqual([{ uri: KIT_B.uri, fileMatch: ['doc://1'], schema: KIT_B.schema }]);
  });

  it('объявленный $schema получает ту же схему вторым адресом', () => {
    const { registry, last } = setup();
    registry.associate('doc://1', KIT_A, 'doc://form-schema.schema.json');
    expect(last()).toEqual([
      { uri: KIT_A.uri, fileMatch: ['doc://1'], schema: KIT_A.schema },
      { uri: 'doc://form-schema.schema.json', schema: KIT_A.schema },
    ]);
  });
});

describe('declaredSchema', () => {
  it('ключ корня', () => {
    expect(declaredSchema('{"$schema": "./s.json", "root": {}}')).toBe('./s.json');
  });

  it('нет ключа, не объект, неразборчивый текст — null', () => {
    expect(declaredSchema('{"root": {"$schema": "x"}}')).toBeNull();
    expect(declaredSchema('[]')).toBeNull();
    expect(declaredSchema('{"$schema": ')).toBeNull();
  });
});

describe('resolveDeclaredSchema', () => {
  /** Подмена `monaco.Uri`: хватает пути и склейки обратно. */
  const parse = (uri: string): UriLike => {
    const match = /^([a-z]+:\/\/[^/]*)(\/.*)$/.exec(uri);
    const [, head, path] = match ?? ['', uri, ''];
    return { path, with: (change) => ({ toString: () => `${head}${change.path}` }) };
  };
  const DOC = 'inmemory://document/fs/forms/a/form.json';

  it('относительный — от каталога документа', () => {
    expect(resolveDeclaredSchema('./s.json', DOC, parse)).toBe(
      'inmemory://document/fs/forms/a/s.json'
    );
    expect(resolveDeclaredSchema('../s.json', DOC, parse)).toBe(
      'inmemory://document/fs/forms/s.json'
    );
  });

  it('абсолютный путь — от корня адреса', () => {
    expect(resolveDeclaredSchema('/s.json', DOC, parse)).toBe('inmemory://document/s.json');
  });

  it('со схемой — как есть', () => {
    expect(resolveDeclaredSchema('https://x.dev/s.json', DOC, parse)).toBe('https://x.dev/s.json');
  });
});
