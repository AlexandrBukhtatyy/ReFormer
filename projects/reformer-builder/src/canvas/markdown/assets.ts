/**
 * Кэш blob-URL для картинок предпросмотра.
 *
 * Картинка в markdown — это путь в проекте, а показать её можно только прочитав файл через File
 * System Access API и завернув в `blob:`-URL. URL держит память до `revokeObjectURL`, поэтому все
 * они живут в одном кэше на инстанс предпросмотра: он же их и освобождает при размонтировании или
 * смене документа. Кэш заодно убирает мигание — при каждой правке текста файл не перечитывается.
 *
 * @module reformer-builder/canvas/markdown/assets
 */

import { readFileByPath } from '../../io/fs-ops';
import { projectStore } from '../../store/project-store';
import { resolveRelativePath } from './resolve-asset';

export class AssetCache {
  /** Ссылка из markdown → промис blob-URL (`null` — файла нет или каталог проекта не открыт). */
  private readonly urls = new Map<string, Promise<string | null>>();
  /**
   * Номер «поколения» кэша, растёт на каждом {@link AssetCache.dispose}. Чтение, начатое до сброса,
   * по возвращении увидит другое поколение и сразу отзовёт свой URL — иначе он утёк бы.
   */
  private generation = 0;

  /** Каталог markdown-файла: относительно него считаются пути картинок. */
  private readonly baseDir: string | null;

  constructor(baseDir: string | null) {
    this.baseDir = baseDir;
  }

  /** blob-URL по ссылке из markdown; повторные запросы той же ссылки переиспользуют результат. */
  get(src: string): Promise<string | null> {
    const cached = this.urls.get(src);
    if (cached) return cached;
    const pending = this.read(src);
    this.urls.set(src, pending);
    return pending;
  }

  private async read(src: string): Promise<string | null> {
    const generation = this.generation;
    const root = projectStore.getState().dirHandle;
    const path = this.baseDir == null ? null : resolveRelativePath(this.baseDir, src);
    if (!root || !path) return null;
    try {
      const file = await readFileByPath(root, path);
      const url = URL.createObjectURL(file);
      // Пока читали файл, кэш успели сбросить — этот URL уже никто не отзовёт, делаем это сами.
      if (generation !== this.generation) {
        URL.revokeObjectURL(url);
        return null;
      }
      return url;
    } catch {
      return null;
    }
  }

  /**
   * Освободить все выданные URL. Это именно сброс, а не «конец жизни» объекта: React монтирует
   * компоненты повторно (StrictMode в разработке, будущий Offscreen), и после такого сброса кэш
   * обязан снова работать — иначе картинки исчезли бы навсегда.
   */
  dispose(): void {
    this.generation += 1;
    for (const pending of this.urls.values()) {
      void pending.then((url) => {
        if (url) URL.revokeObjectURL(url);
      });
    }
    this.urls.clear();
  }
}
