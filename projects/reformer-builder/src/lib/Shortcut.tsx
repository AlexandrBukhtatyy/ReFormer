/**
 * `Shortcut` — аккорд горячих клавиш в `<Kbd>`-чипах под ОС пользователя. Запись нейтральная
 * (`Mod+Shift+Z`), раскладка по платформе — в `./shortcuts`. Для текста внутри `title`/предложения
 * компонент не нужен: там `formatShortcut` из того же модуля.
 *
 * @module reformer-builder/lib/Shortcut
 */

import { Kbd, KbdGroup } from '@reformer/ui-kit/kbd';
import { shortcutKeys } from './shortcuts';

/** @example <Shortcut keys="Mod+Shift+Z" /> — ⇧ ⌘ Z на macOS, Ctrl Shift Z на Windows/Linux. */
export function Shortcut({ keys, className }: { keys: string; className?: string }) {
  return (
    <KbdGroup className={className}>
      {shortcutKeys(keys).map((key, i) => (
        <Kbd key={i}>{key}</Kbd>
      ))}
    </KbdGroup>
  );
}
