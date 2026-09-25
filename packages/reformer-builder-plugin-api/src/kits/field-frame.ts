/**
 * Рамка поля — контракт компонента `kit.infra.fieldFrame`.
 *
 * Рамка рисует вокруг произвольного контрола то, что у поля формы общее: подпись, описание,
 * отметку обязательности и ошибки. Стек, который кладёт в неё СВОЙ контрол (тема RJSF строит
 * на ней шаблон поля), знает только эти пропсы — и потому может взять рамку любого кита.
 *
 * ## Требование к любому компоненту кита: корень принимает `className`
 *
 * Не только к рамке. Билдер помечает узлы формы классом-токеном и по нему находит узел под
 * курсором и подсвечивает выделенный. Компонент, который теряет `className` по дороге к своему
 * корневому элементу, в превью выглядит нормально, но его нельзя выбрать кликом и не видно,
 * что он выделен (так было с полями `@reformer/ui-kit` — ReFormer-twlf).
 *
 * @module @reformer/builder-plugin-api/kits/field-frame
 */

import type { ReactNode } from 'react';

export interface KitFieldFrameProps {
  /** Идентификатор контрола — для `htmlFor` подписи. */
  readonly id?: string;
  readonly label?: ReactNode;
  readonly description?: ReactNode;
  readonly required?: boolean;
  /** Сообщения об ошибках; пусто или нет — ошибок нет. */
  readonly errors?: readonly string[];
  /**
   * Контрол подписывает себя сам (чекбокс, переключатель) — рамка свою подпись не рисует,
   * иначе подпись была бы дважды.
   */
  readonly inlineLabel?: boolean;
  /** Поле скрыто — рамка не рисует ничего. */
  readonly hidden?: boolean;
  readonly className?: string;
  readonly children?: ReactNode;
}
