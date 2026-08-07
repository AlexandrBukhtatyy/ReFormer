/**
 * Символьный гейт совместимости. Проверяем главное: кит, собранный против более нового рантайма,
 * получает ВНЯТНУЮ причину отказа, а не сырую ESM-ошибку в консоли. Это не косметика — при
 * несовместимости пользователь иначе видит пустой билдер и не понимает, что произошло.
 */
import { describe, expect, it } from 'vitest';
import { loadKitNamespace } from './compat';
import { toDescriptor } from './descriptor';
import type { KitEntry } from './registry';
import type { KitNamespace } from './types';

const descriptor = toDescriptor({ version: '1.0', components: [] });

function kitWith(loadNamespace: () => Promise<KitNamespace>): KitEntry {
  return {
    id: 'test',
    label: 'Test kit',
    version: '1.0.0',
    catalog: { version: '1.0', components: [] },
    loadNamespace,
  };
}

/** Полный INFRA-набор, чтобы проверять именно интересующую ветку. */
const fullInfra: KitNamespace = {
  FormField: () => null,
  AsyncBoundary: () => null,
  List: () => null,
};

describe('успешная загрузка', () => {
  it('отдаёт namespace и пустой список недостающих INFRA', async () => {
    const res = await loadKitNamespace(
      kitWith(async () => fullInfra),
      descriptor
    );
    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.namespace).toBe(fullInfra);
      expect(res.missingInfra).toEqual([]);
    }
  });

  it('отсутствие List — не ошибка, а предупреждение (ровно случай ui-kit@11)', async () => {
    const res = await loadKitNamespace(
      kitWith(async () => ({ FormField: () => null, AsyncBoundary: () => null })),
      descriptor
    );
    expect(res.ok).toBe(true);
    if (res.ok) expect(res.missingInfra).toEqual(['List']);
  });
});

describe('отказ', () => {
  it('ESM link error превращается в причину с ИМЕНЕМ символа и пакетом', async () => {
    // Дословно то, чем падает ui-kit@12 на локальном рантайме (спайк S1).
    const kit = kitWith(async () => {
      throw new SyntaxError(
        "The requested module '@reformer/renderer-react' does not provide an export named 'useModelArrayItems'"
      );
    });
    const res = await loadKitNamespace(kit, descriptor);
    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.reason).toContain('useModelArrayItems');
      expect(res.reason).toContain('@reformer/renderer-react');
      expect(res.reason).toContain('более новой версии');
    }
  });

  it('кит без враппера поля отвергается: рендерить поля нечем', async () => {
    const res = await loadKitNamespace(
      kitWith(async () => ({ Box: () => null })),
      descriptor
    );
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.reason).toContain('FormField');
  });

  it('произвольная ошибка загрузки не теряется', async () => {
    const res = await loadKitNamespace(
      kitWith(async () => {
        throw new Error('Failed to fetch dynamically imported module');
      }),
      descriptor
    );
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.reason).toContain('Failed to fetch');
  });
});
