import { afterEach, describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import {
  classifyFormSchema,
  insertChildren,
  isIgnoredDir,
  shouldScanFile,
  type TreeEntry,
} from './discovery';
import { resetRuntimeState, setRuntimeConfig } from '../config/state';

const here = path.dirname(fileURLToPath(import.meta.url));
const exampleDir = path.resolve(
  here,
  '../../../react-playground/src/pages/examples/complex-multy-step-form-renderer-json'
);
const readJson = (p: string) => JSON.parse(readFileSync(p, 'utf8'));

describe('classifyFormSchema — дискриминатор meta-vs-form (§7.2)', () => {
  it('реальная json-schema.json → форма, high (есть $schema→form-schema)', () => {
    const json = readJson(path.join(exampleDir, 'json-schema.json'));
    expect(classifyFormSchema(json)).toEqual({ isForm: true, confidence: 'high' });
  });

  it('form-schema.schema.json (draft-07 JSON Schema) → НЕ форма', () => {
    const json = readJson(path.join(exampleDir, 'form-schema.schema.json'));
    expect(classifyFormSchema(json).isForm).toBe(false);
  });

  it('package.json → НЕ форма', () => {
    const json = readJson(path.resolve(here, '../../package.json'));
    expect(classifyFormSchema(json).isForm).toBe(false);
  });

  it('форма без $schema → medium (эвристика по shape)', () => {
    const json = {
      version: '1.0',
      root: { component: '$component(Box)', children: [{ value: '$model(a)' }] },
    };
    expect(classifyFormSchema(json)).toEqual({ isForm: true, confidence: 'medium' });
  });
});

describe('фильтры сканирования', () => {
  it('isIgnoredDir', () => {
    expect(isIgnoredDir('node_modules')).toBe(true);
    expect(isIgnoredDir('.git')).toBe(true);
    expect(isIgnoredDir('src')).toBe(false);
  });

  it('shouldScanFile', () => {
    expect(shouldScanFile('credit.form.json')).toBe(true);
    expect(shouldScanFile('json-schema.json')).toBe(true);
    expect(shouldScanFile('package.json')).toBe(false);
    expect(shouldScanFile('package-lock.json')).toBe(false);
    expect(shouldScanFile('main.tsx')).toBe(false);
  });
});

describe('insertChildren — вставка загруженного уровня в плоское дерево', () => {
  const dir = (path: string, depth: number): TreeEntry => ({
    path,
    name: path.slice(path.lastIndexOf('/') + 1),
    kind: 'directory',
    depth,
  });
  const file = (path: string, depth: number): TreeEntry => ({
    path,
    name: path.slice(path.lastIndexOf('/') + 1),
    kind: 'file',
    depth,
  });

  it('содержимое встаёт сразу после своей папки', () => {
    const tree = [dir('src', 0), file('README.md', 0)];
    const next = insertChildren(tree, 'src', [dir('src/io', 1), file('src/main.tsx', 1)]);
    expect(next.map((e) => e.path)).toEqual(['src', 'src/io', 'src/main.tsx', 'README.md']);
  });

  it('вложенная папка не задевает соседние ветки', () => {
    const tree = [dir('src', 0), dir('src/io', 1), file('src/main.tsx', 1), file('README.md', 0)];
    const next = insertChildren(tree, 'src/io', [file('src/io/fs.ts', 2)]);
    expect(next.map((e) => e.path)).toEqual([
      'src',
      'src/io',
      'src/io/fs.ts',
      'src/main.tsx',
      'README.md',
    ]);
  });

  it('повторная вставка (двойное раскрытие) — дерево не меняется', () => {
    const tree = [dir('src', 0), file('src/main.tsx', 1)];
    expect(insertChildren(tree, 'src', [file('src/main.tsx', 1)])).toBe(tree);
  });

  it('неизвестная папка (её уже удалили) — дерево не меняется', () => {
    const tree = [dir('src', 0)];
    expect(insertChildren(tree, 'gone', [file('gone/a.ts', 1)])).toBe(tree);
  });

  it('пустая папка помечается загруженной, записей не добавляется', () => {
    const tree = [dir('empty', 0), file('README.md', 0)];
    expect(insertChildren(tree, 'empty', []).map((e) => e.path)).toEqual(['empty', 'README.md']);
  });
});

describe('runtime-конфиг: project discovery (объединение с дефолтами)', () => {
  afterEach(resetRuntimeState);

  it('formSchemaMarkers — клиентский маркер поднимает confidence до high', () => {
    const form = { version: '1.0', root: { component: '$component(Box)', children: [] } };
    const withMarker = { $schema: './my-forms/acme-form.json', ...form };
    // Без конфига пользовательский маркер неизвестен → medium.
    expect(classifyFormSchema(withMarker).confidence).toBe('medium');
    setRuntimeConfig({ project: { formSchemaMarkers: ['acme-form.json'] } });
    expect(classifyFormSchema(withMarker).confidence).toBe('high');
    // Дефолтные маркеры продолжают работать.
    expect(classifyFormSchema({ $schema: './form-schema.schema.json', ...form }).confidence).toBe(
      'high'
    );
  });

  it('ignoreDirs — клиентские каталоги ∪ дефолтные', () => {
    expect(isIgnoredDir('fixtures')).toBe(false);
    setRuntimeConfig({ project: { ignoreDirs: ['fixtures'] } });
    expect(isIgnoredDir('fixtures')).toBe(true);
    expect(isIgnoredDir('node_modules')).toBe(true); // дефолт остаётся
  });

  it('skipFiles — клиентские файлы ∪ дефолтные', () => {
    expect(shouldScanFile('acme.json')).toBe(true);
    setRuntimeConfig({ project: { skipFiles: ['acme.json'] } });
    expect(shouldScanFile('acme.json')).toBe(false);
    expect(shouldScanFile('package.json')).toBe(false); // дефолт остаётся
  });
});
