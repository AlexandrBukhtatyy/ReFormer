/**
 * Редактор `className` в инспекторе: полноширинный input + выпадающие подсказки по токену под
 * кареткой. Значение — обычная строка (список классов через пробел), любой кастомный класс допустим
 * (свободный ввод). Подсказки фильтруются по текущему токену, уже использованные классы из списка
 * исключаются. Навигация: ↑/↓ — выбор, Enter/Tab — вставить, Esc — закрыть, клик — вставить. Запись
 * идёт через `setComponentProp` с коалесингом (как остальные пропы инспектора).
 *
 * Список подсказок приходит СНАРУЖИ (`classes`) — его поставляет активный кит через
 * `kit.styles.classNames`, а кит может ограничить набор групп для конкретного компонента (полю
 * формы — только отступы). Пустой список = подсказок нет; поле при этом остаётся полноценным
 * свободным вводом, потому что ограничение групп — это про подсказки, а не про запрет ввода.
 *
 * Класс вне словаря кита помечается значком-предупреждением: словарь уезжает в safelist сборки,
 * поэтому всё, чего в нём нет, Tailwind сгенерирует только при встрече в исходниках — иначе класс
 * молча не подействует в превью. Это подсказка, а не ошибка: ввод по-прежнему свободный.
 *
 * @module reformer-builder/panels/ClassNameField
 */

import { useRef, useState, type KeyboardEvent } from 'react';
import { TriangleAlert } from 'lucide-react';
import type { JsonNode } from '@reformer/renderer-json';
import { setComponentProp, type JsonPath } from '../model';
import { editorActions } from '../store';
import { knownClassNames, suggestClasses, unknownClasses, type InspectorProp } from '../catalog';
import { cn } from '../lib/cn';

const MAX_SUGGESTIONS = 24;

export function ClassNameField({
  node,
  path,
  prop,
  classes,
}: {
  node: JsonNode;
  path: JsonPath;
  prop: InspectorProp;
  /** Классы, разрешённые киту для этого компонента (см. `catalog/class-names`). */
  classes: string[];
}) {
  const props = (node as { componentProps?: Record<string, unknown> }).componentProps ?? {};
  const raw = props[prop.key];
  const value = typeof raw === 'string' ? raw : '';

  const inputRef = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [caret, setCaret] = useState(value.length);
  const [active, setActive] = useState(0);

  // Пустое значение убирает проп из схемы (как раньше для readonly-поля).
  const set = (v: string) =>
    editorActions.apply((s) => setComponentProp(s, path, prop.key, v.trim() ? v : undefined), {
      coalesceKey: `${prop.key}@${path.join('.')}`,
    });

  // Токен под кареткой (между окружающими пробелами) — по нему фильтруем подсказки.
  const pos = Math.min(caret, value.length);
  const tokenStart = value.slice(0, pos).search(/\S*$/);
  const tokenEnd = pos + (value.slice(pos).match(/^\S*/)?.[0].length ?? 0);
  const token = value.slice(tokenStart, pos);

  const used = new Set(value.split(/\s+/).filter(Boolean));
  const suggestions = suggestClasses(classes, token, used, MAX_SUGGESTIONS);
  const showList = open && suggestions.length > 0;

  // Классы вне словаря кита: в safelist сборки они не попадают, поэтому отрисуются, только если
  // встречаются в исходниках билдера или кита. Проверяем по ПОЛНОМУ словарю, а не по `classes`:
  // тот сужен политикой групп (полю формы кит разрешает предлагать только отступы), и суженным
  // списком мы ругались бы на рабочий `md:col-span-2`.
  const unknown = unknownClasses(knownClassNames(), value);
  const activeIdx = suggestions.length ? Math.min(active, suggestions.length - 1) : 0;

  const syncCaret = () => setCaret(inputRef.current?.selectionStart ?? value.length);

  // Заменить токен под кареткой выбранным классом + пробел, вернуть каретку за него.
  const complete = (cls: string) => {
    const head = value.slice(0, tokenStart);
    const tail = value.slice(tokenEnd);
    const insert = cls + (tail.startsWith(' ') ? '' : ' ');
    const next = head + insert + tail;
    const nextPos = head.length + insert.length;
    set(next);
    setCaret(nextPos);
    setActive(0);
    requestAnimationFrame(() => {
      const el = inputRef.current;
      if (el) {
        el.focus();
        el.setSelectionRange(nextPos, nextPos);
      }
    });
  };

  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowDown' && showList) {
      e.preventDefault();
      e.stopPropagation();
      setActive((a) => Math.min(a + 1, suggestions.length - 1));
    } else if (e.key === 'ArrowUp' && showList) {
      e.preventDefault();
      e.stopPropagation();
      setActive((a) => Math.max(a - 1, 0));
    } else if ((e.key === 'Enter' || e.key === 'Tab') && showList) {
      e.preventDefault();
      e.stopPropagation();
      complete(suggestions[activeIdx]);
    } else if (e.key === 'Escape' && open) {
      e.preventDefault();
      e.stopPropagation();
      setOpen(false);
    }
  };

  return (
    <div className="flex min-h-6 items-center gap-2.5">
      <span className="w-24 flex-none truncate text-xs" title={prop.description}>
        {prop.label}
      </span>
      <div className="relative min-w-0 flex-1">
        <input
          ref={inputRef}
          value={value}
          spellCheck={false}
          autoComplete="off"
          placeholder="flex gap-4 …"
          onChange={(e) => {
            set(e.target.value);
            setCaret(e.target.selectionStart ?? e.target.value.length);
            setOpen(true);
            setActive(0);
          }}
          onKeyDown={onKeyDown}
          onSelect={syncCaret}
          onFocus={() => setOpen(true)}
          onBlur={() => setOpen(false)}
          className={cn(
            'h-[26px] w-full rounded-md border border-input bg-background px-2 font-mono text-[11px] outline-none focus:border-ring',
            unknown.length && 'pr-6'
          )}
        />
        {unknown.length > 0 && (
          // Тултип вешаем на span, а не на иконку: атрибут `title` у `<svg>` браузер не показывает.
          <span
            className="absolute top-1/2 right-1.5 -translate-y-1/2"
            title={
              `Нет в словаре кита: ${unknown.join(', ')}.\n` +
              'Такой класс отрисуется, только если встречается в коде билдера или кита — ' +
              'проверьте результат в превью.'
            }
          >
            <TriangleAlert className="size-3.5 text-amber-600 dark:text-amber-400" />
          </span>
        )}
        {showList && (
          <div className="absolute inset-x-0 top-[30px] z-50 max-h-[240px] overflow-auto rounded-md border border-border bg-background p-1 shadow-md">
            {suggestions.map((cls, i) => (
              <button
                key={cls}
                type="button"
                // mousedown-preventDefault: не терять фокус input до onClick.
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => complete(cls)}
                className={cn(
                  'block w-full truncate rounded px-2 py-1 text-left font-mono text-[11px]',
                  i === activeIdx ? 'bg-primary/10 text-foreground' : 'hover:bg-muted'
                )}
              >
                {cls}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
