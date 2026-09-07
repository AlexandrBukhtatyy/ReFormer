import { describe, expect, it, vi } from 'vitest';

import { createResourceClipboardService } from './resource-clipboard';

describe('буфер записей дерева', () => {
  it('копирование кладёт адреса и сообщает их размер', () => {
    const clipboard = createResourceClipboardService();

    clipboard.copy(['fs:a.ts', 'fs:b.ts']);

    expect(clipboard.get()).toEqual({ mode: 'copy', items: ['fs:a.ts', 'fs:b.ts'] });
    expect(clipboard.size()).toBe(2);
  });

  it('повторы снимаются: выделение может назвать одну запись дважды', () => {
    const clipboard = createResourceClipboardService();

    clipboard.copy(['fs:a.ts', 'fs:a.ts']);

    expect(clipboard.get().items).toEqual(['fs:a.ts']);
  });

  it('повторное копирование заменяет содержимое, а не добавляет', () => {
    const clipboard = createResourceClipboardService();

    clipboard.copy(['fs:a.ts']);
    clipboard.copy(['fs:b.ts']);

    expect(clipboard.get().items).toEqual(['fs:b.ts']);
  });

  it('вырезание помечено отдельно: копия оставляет оригинал, перенос — нет', () => {
    const clipboard = createResourceClipboardService();

    clipboard.cut(['fs:a.ts']);

    expect(clipboard.get().mode).toBe('cut');
  });

  it('пустой список очищает буфер', () => {
    const clipboard = createResourceClipboardService();

    clipboard.copy(['fs:a.ts']);
    clipboard.copy([]);

    expect(clipboard.size()).toBe(0);
  });

  it('снимок пустого буфера — одна и та же ссылка', () => {
    const clipboard = createResourceClipboardService();

    const first = clipboard.get();
    clipboard.clear();

    expect(clipboard.get()).toBe(first);
  });

  it('изменение будит подписчика, а очистка пустого — нет', () => {
    const clipboard = createResourceClipboardService();
    const seen = vi.fn();
    clipboard.observe(seen);

    clipboard.clear();
    expect(seen).not.toHaveBeenCalled();

    clipboard.copy(['fs:a.ts']);
    clipboard.clear();
    expect(seen).toHaveBeenCalledTimes(2);
  });
});
