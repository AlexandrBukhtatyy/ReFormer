import { describe, expect, it, vi } from 'vitest';

import { createMarketplaceClient } from './registry';

const URL_ = 'https://registry.example.org/plugins.json';

const respond = (body: unknown, status = 200) =>
  vi.fn(() =>
    Promise.resolve(
      new Response(typeof body === 'string' ? body : JSON.stringify(body), { status })
    )
  );

const clientWith = (fetch: ReturnType<typeof respond>, url: string = URL_) =>
  createMarketplaceClient({ url, fetch: fetch as unknown as typeof globalThis.fetch });

const ENTRY = {
  id: 'acme-forms',
  package: '@acme/forms-plugin',
  name: 'Acme Forms',
  description: 'Формы Acme',
  publisher: 'Acme',
};

describe('реестр не настроен', () => {
  it('без адреса не ходит в сеть и говорит об этом отдельным кодом', async () => {
    const fetch = respond([]);
    const client = createMarketplaceClient({ fetch: fetch as unknown as typeof globalThis.fetch });

    expect(client.configured()).toBe(false);
    const result = await client.list();

    // Это состояние, а не поломка: раздел показывает его текстом, а не пустым списком.
    expect(result.ok || result.problem.code).toBe('not-configured');
    expect(fetch).not.toHaveBeenCalled();
  });
});

describe('чтение каталога', () => {
  it('принимает и массив, и объект с «plugins»', async () => {
    const asArray = await clientWith(respond([ENTRY])).list();
    const asObject = await clientWith(respond({ version: 1, plugins: [ENTRY] })).list();

    // Вторая форма оставляет реестру место под собственные поля — отвергать её было бы упрямством.
    expect(asArray.ok && asArray.entries).toEqual([ENTRY]);
    expect(asObject.ok && asObject.entries).toEqual([ENTRY]);
  });

  it('запись без id или package пропускается, а каталог остаётся годным', async () => {
    const result = await clientWith(
      respond([ENTRY, { id: 'без-пакета' }, { package: 'без-идентификатора' }, 'строка'])
    ).list();

    // Пропуск, а не отказ целиком: одна испорченная запись не должна прятать весь каталог.
    expect(result.ok && result.entries.map((entry) => entry.id)).toEqual(['acme-forms']);
  });

  it('имя по умолчанию — идентификатор, лишние поля не мешают', async () => {
    const result = await clientWith(
      respond([{ id: 'acme', package: 'acme', downloads: 100500 }])
    ).list();

    expect(result.ok && result.entries[0]).toEqual({ id: 'acme', package: 'acme', name: 'acme' });
  });

  it('не каталог — отказ с кодом формы, а не пустой список', async () => {
    const result = await clientWith(respond({ plugins: 'нет' })).list();

    expect(result.ok || result.problem.code).toBe('malformed');
  });

  it('сеть и статус отказа различимы', async () => {
    const broken = vi.fn(() => Promise.reject(new Error('нет сети')));
    const status = respond('', 503);

    expect(
      await createMarketplaceClient({
        url: URL_,
        fetch: broken as unknown as typeof globalThis.fetch,
      }).list()
    ).toMatchObject({ problem: { code: 'network' } });
    expect(await clientWith(status).list()).toMatchObject({ problem: { code: 'network' } });
  });
});
