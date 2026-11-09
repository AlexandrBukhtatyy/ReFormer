import Link from '@docusaurus/Link';

/**
 * Кнопка «Открыть билдер ↗» для страниц раздела «Билдер».
 *
 * Компонентом, а не `<Link>` прямо в MDX: prettier переносит длинный `<Link>` на несколько
 * строк, а MDX 3 оборачивает текст на отдельной строке в `<p>` — его нижний отступ растягивает
 * кнопку, и подпись прилипает к верхнему краю.
 */
export function OpenBuilderButton() {
  return (
    <div className="margin-bottom--lg">
      <Link className="button button--primary button--lg" to="pathname:///builder/">
        Открыть билдер ↗
      </Link>
    </div>
  );
}
