/**
 * Картинка предпросмотра.
 *
 * Внешний URL отдаётся браузеру как есть, путь в проекте читается через порт и показывается
 * ссылкой из кэша ({@link AssetCache}). Не нашлось — вместо «битой» иконки видна подпись
 * с путём: в markdown это чаще опечатка в ссылке, чем испорченный файл, и подпись говорит,
 * что именно чинить.
 *
 * @module plugins/editor-markdown/ui/MarkdownImage
 */

import { useEffect, useState, type ImgHTMLAttributes, type ReactElement } from 'react';
import type { AssetCache } from '../render/assets';
import { isExternalUrl } from '../render/markdown';
import { withoutProps } from './props';

export type MarkdownImageProps = ImgHTMLAttributes<HTMLImageElement> & {
  /** Узел разбора от react-markdown; в разметку не уходит. */
  readonly node?: unknown;
  readonly assets: AssetCache;
};

export function MarkdownImage(props: MarkdownImageProps): ReactElement | null {
  const { src, alt, assets } = props;
  const rest = withoutProps(props, ['node', 'assets', 'src', 'alt']);
  const raw = typeof src === 'string' ? src : '';
  const external = raw === '' || isExternalUrl(raw);

  const [resolved, setResolved] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);

  // Смена ссылки сбрасывает прошлый результат ВО ВРЕМЯ отрисовки, а не в эффекте: `setState`
  // в теле эффекта даёт каскад перерисовок, и React справедливо на это ругается.
  const key = external ? '' : raw;
  const [resolvedKey, setResolvedKey] = useState(key);
  if (resolvedKey !== key) {
    setResolvedKey(key);
    setResolved(null);
    setFailed(false);
  }

  useEffect(() => {
    if (external) return;
    let alive = true;
    void assets.get(raw).then((url) => {
      if (!alive) return;
      setResolved(url);
      setFailed(url === null);
    });
    return () => {
      alive = false;
    };
  }, [assets, external, raw]);

  if (failed) {
    return (
      <span className="text-muted-foreground border-border rounded border border-dashed px-1.5 py-0.5 text-[12px]">
        {alt === undefined || alt === '' ? raw : alt}
      </span>
    );
  }

  const source = external ? raw : resolved;
  // Пока путь не разрешён, места картинке не занимаем: подставная рамка прыгала бы при
  // каждой правке текста, а чтение файла случается один раз на документ.
  if (source === null || source === '') return null;
  return <img {...rest} src={source} alt={alt ?? ''} />;
}
