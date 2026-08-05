import { describe, it, expect, vi } from 'vitest';
import { defineRegistry, FIELD_WRAPPER, type ComponentRegistry } from '@reformer/renderer-json';
import { loadForm, entryKeyOf, FormLoadError, FormPreflightError } from './loader';
import { FormFetchError } from './net';
import { createSchemaCache } from './cache';
import type { FormEntry } from './types';

const Stub = (): null => null;

const jsonResponse = (body: unknown): Response =>
  new Response(JSON.stringify(body), { headers: { 'content-type': 'application/json' } });

const base: ComponentRegistry = defineRegistry((r) => {
  r.component('Box', Stub);
  r.component('Input', Stub);
  r.component(FIELD_WRAPPER, Stub);
});

const schemaValue = { root: { component: '$component(Box)' } } as never;

const entry = (over: Partial<FormEntry> & Pick<FormEntry, 'id'>): FormEntry => ({
  version: '1.0.0',
  owner: 'mfe',
  schema: { kind: 'inline', value: schemaValue },
  initial: { kind: 'inline', value: {} },
  ...over,
});

describe('loadForm', () => {
  it('собирает бандл из inline-источников', async () => {
    const loaded = await loadForm(entry({ id: 'a' }), base);
    expect(loaded.schema).toBe(schemaValue);
    expect(loaded.registry).toBe(base); // расширения нет — база отдана как есть
  });

  it('расширение реестра перекрывает базу, база остаётся доступна', async () => {
    const Own = (): null => null;
    const own = defineRegistry((r) => {
      r.component('Input', Own); // перекрываем
      r.component('DomainField', Own); // добавляем
    });
    const loaded = await loadForm(
      entry({ id: 'a', registry: { kind: 'inline', value: own } }),
      base
    );
    expect(loaded.registry.get('Input')?.component).toBe(Own);
    expect(loaded.registry.has('Box')).toBe(true); // из базы
    expect(loaded.registry.has('DomainField')).toBe(true);
  });

  it('грузит module-источники', async () => {
    const load = vi.fn(async () => schemaValue);
    const loaded = await loadForm(entry({ id: 'a', schema: { kind: 'module', load } }), base);
    expect(load).toHaveBeenCalledOnce();
    expect(loaded.schema).toBe(schemaValue);
  });

  it('падение module-источника оборачивается с указанием части', async () => {
    const boom = entry({
      id: 'a',
      behavior: {
        kind: 'module',
        load: async () => {
          throw new Error('chunk load failed');
        },
      },
    });
    await expect(loadForm(boom, base)).rejects.toThrow(/a@1\.0\.0: behavior/);
    await expect(loadForm(boom, base)).rejects.toBeInstanceOf(FormLoadError);
  });

  it('схема тянется по сети', async () => {
    const fetchImpl = vi.fn(async () => jsonResponse(schemaValue));
    const net = entry({ id: 'a', schema: { kind: 'http', url: '/schema.json' } });
    const loaded = await loadForm(net, base, { fetchImpl });
    expect(loaded.schema).toEqual(schemaValue);
    expect(fetchImpl).toHaveBeenCalledOnce();
  });

  it('сетевой отказ приходит как FormLoadError с указанием части и причины', async () => {
    const fetchImpl = vi.fn(async () => new Response('', { status: 500 }));
    const net = entry({ id: 'a', schema: { kind: 'http', url: '/schema.json' } });
    const err = await loadForm(net, base, { fetchImpl }).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(FormLoadError);
    expect((err as FormLoadError).part).toBe('schema');
    expect((err as FormLoadError).cause).toBeInstanceOf(FormFetchError);
  });

  it('чужой JSON вместо схемы отсекается ДО кэша', async () => {
    // Положить в кэш чужой ответ — значит закрепить ошибку до истечения срока годности.
    const cache = createSchemaCache();
    const fetchImpl = vi.fn(async () => jsonResponse({ вовсе: 'не схема' }));
    const net = entry({ id: 'a', schema: { kind: 'http', url: '/schema.json' } });
    const err = await loadForm(net, base, { fetchImpl, cache }).catch((e: unknown) => e);
    expect((err as FormLoadError).cause).toMatchObject({ kind: 'not-a-form-schema' });
    expect(cache.memorySize).toBe(0);
  });

  it('вторая сборка той же формы берёт схему из кэша, а не из сети', async () => {
    const cache = createSchemaCache();
    const fetchImpl = vi.fn(async () => jsonResponse(schemaValue));
    const net = entry({ id: 'a', schema: { kind: 'http', url: '/schema.json' } });
    await loadForm(net, base, { fetchImpl, cache });
    await loadForm(net, base, { fetchImpl, cache });
    expect(fetchImpl).toHaveBeenCalledOnce();
  });

  it('ключ кэша разводит владельцев с одинаковым id формы', async () => {
    const cache = createSchemaCache();
    const fetchImpl = vi.fn(async () => jsonResponse(schemaValue));
    await loadForm(
      { ...entry({ id: 'a', schema: { kind: 'http', url: '/a.json' } }), owner: 'mfe-a' },
      base,
      { fetchImpl, cache }
    );
    await loadForm(
      { ...entry({ id: 'a', schema: { kind: 'http', url: '/b.json' } }), owner: 'mfe-b' },
      base,
      { fetchImpl, cache }
    );
    expect(fetchImpl).toHaveBeenCalledTimes(2); // не приняли чужую схему за свою
  });
});

describe('loadForm — preflight', () => {
  const badSchema = { root: { component: '$component(НетТакого)' } } as never;

  it('по умолчанию непройденная проверка бросает FormPreflightError', async () => {
    const bad = entry({ id: 'a', schema: { kind: 'inline', value: badSchema } });
    const err = await loadForm(bad, base).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(FormPreflightError);
    expect((err as Error).message).toContain('НетТакого');
  });

  it("режим 'warn' пропускает форму, но сообщает о проблеме", async () => {
    const bad = entry({ id: 'a', schema: { kind: 'inline', value: badSchema } });
    const seen: string[] = [];
    const loaded = await loadForm(bad, base, {
      preflight: 'warn',
      onDiagnostic: (d) => seen.push(d.code),
    });
    expect(seen).toContain('missing-components');
    expect(loaded.preflight?.ok).toBe(false);
  });

  it("режим 'off' не проверяет вовсе", async () => {
    const bad = entry({ id: 'a', schema: { kind: 'inline', value: badSchema } });
    const loaded = await loadForm(bad, base, { preflight: 'off' });
    expect(loaded.preflight).toBeUndefined();
  });

  it('проверка видит СОСТАВНОЙ реестр: компонент из расширения записи не считается промахом', async () => {
    // Если бы preflight смотрел только в базовый реестр, любое расширение записи давало бы
    // ложный отказ — и наоборот, потеря композиции прошла бы незамеченной.
    const own = defineRegistry((r) => r.component('DomainField', Stub));
    const withOwn = entry({
      id: 'a',
      schema: {
        kind: 'inline',
        value: { root: { component: '$component(DomainField)' } } as never,
      },
      registry: { kind: 'inline', value: own },
    });
    await expect(loadForm(withOwn, base)).resolves.toBeDefined();
  });

  it('без initial и без model — внятная ошибка до сборки формы', async () => {
    const noModel = entry({ id: 'a', initial: undefined });
    await expect(loadForm(noModel, base)).rejects.toThrow(/initial.*model/);
  });

  it('фабрика модели проходит насквозь и не вызывается на этапе загрузки', async () => {
    const makeModel = vi.fn();
    const loaded = await loadForm(
      entry({ id: 'a', initial: undefined, model: { kind: 'inline', value: makeModel } }),
      base
    );
    expect(loaded.makeModel).toBe(makeModel);
    expect(makeModel).not.toHaveBeenCalled();
  });
});

describe('entryKeyOf', () => {
  it('склеивает id и версию', () => {
    expect(entryKeyOf({ id: 'credit', version: '2.1.0' })).toBe('credit@2.1.0');
  });
});
