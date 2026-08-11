/**
 * Картинка предпросмотра. Внешние URL отдаём браузеру как есть, пути в проекте читаем через File
 * System Access API и показываем blob-URL из {@link AssetCache}. Не нашлось — вместо «битой»
 * иконки показываем подпись с путём: в markdown это чаще опечатка в ссылке, чем испорченный файл.
 *
 * @module reformer-builder/canvas/markdown/MarkdownImage
 */

import { useEffect, useState, type ImgHTMLAttributes } from 'react';
import type { Element } from 'hast';
import type { AssetCache } from './assets';
import { withoutProps } from './hast-text';
import { isExternalUrl } from './resolve-asset';

type Props = ImgHTMLAttributes<HTMLImageElement> & {
  node?: Element;
  /** Кэш blob-URL документа: он же знает каталог файла и резолвит относительные пути. */
  assets: AssetCache;
};

export default function MarkdownImage(props: Props) {
  const { src, alt, assets } = props;
  const rest = withoutProps(props, ['node', 'assets', 'src', 'alt']);
  const raw = typeof src === 'string' ? src : '';
  const external = !raw || isExternalUrl(raw);

  const [resolved, setResolved] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);

  // Смена ссылки сбрасывает результат прошлого резолва во время рендера, а не в эффекте: setState
  // в теле эффекта даёт каскадные ре-рендеры (react-hooks/set-state-in-effect).
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
      setFailed(url == null);
    });
    return () => {
      alive = false;
    };
  }, [assets, external, raw]);

  if (failed) {
    return (
      <span className="rb-md-missing" title={raw}>
        {alt || raw}
      </span>
    );
  }
  const finalSrc = external ? raw : resolved;
  if (!finalSrc) return null;
  return <img {...rest} src={finalSrc} alt={alt ?? ''} />;
}
