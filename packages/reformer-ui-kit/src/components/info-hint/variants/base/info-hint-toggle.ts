/**
 * Следующее состояние тултипа по клику на иконку-подсказку.
 *
 * Radix `TooltipTrigger` закрывает тултип на `pointerdown`, поэтому к моменту `click` значение `open`
 * уже сброшено и «было ли открыто» приходится помнить с `pointerdown`. У клика с клавиатуры
 * (Enter/Space, `event.detail === 0`) `pointerdown` нет вовсе — там актуален сам `open`.
 */
export function nextOpenOnClick(
  detail: number,
  open: boolean,
  wasOpenOnPointerDown: boolean
): boolean {
  return !(detail === 0 ? open : wasOpenOnPointerDown);
}
