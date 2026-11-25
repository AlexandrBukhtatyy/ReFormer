/**
 * Заглушка старого адреса переехавшей страницы: сразу переводит на новый адрес с тем же якорем.
 * Плагина редиректов у сайта нет — заглушка его заменяет (например, /docs/mcp/benchmark →
 * /benchmark/mcp). Без JS остаётся видимая ссылка. Адрес — без baseUrl и локали: их добавляют
 * useBaseUrl и Link.
 */
import { type ReactNode, useEffect } from 'react';
import Link from '@docusaurus/Link';
import Translate from '@docusaurus/Translate';
import { useHistory, useLocation } from '@docusaurus/router';
import useBaseUrl from '@docusaurus/useBaseUrl';

export default function MovedTo({ to }: { to: string }): ReactNode {
  const href = useBaseUrl(to);
  const history = useHistory();
  const { hash } = useLocation();
  useEffect(() => {
    history.replace(`${href}${hash}`);
  }, [history, href, hash]);
  return (
    <p>
      <Translate id="moved.text">Страница переехала:</Translate> <Link to={to}>{href}</Link>
    </p>
  );
}
