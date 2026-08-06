/**
 * Диалоги меню «Справка»: «Горячие клавиши» (сгруппированный список шорткатов на `lib/Shortcut`,
 * подписи — под ОС пользователя) и «О программе» (бренд + краткое описание билдера). Источник
 * шорткатов — обработчик `onKey` в EditorLayout и `MenubarShortcut` в AppMenuBar; при изменении
 * хоткеев обновлять здесь.
 * Активный диалог управляется извне (AppMenuBar), монтируется свежим при открытии.
 *
 * @module reformer-builder/app/HelpDialogs
 */

import { Fragment } from 'react';
import { Blocks } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@reformer/ui-kit/dialog';
import { Shortcut as ShortcutKeys } from '../lib/Shortcut';
import { PLATFORM } from '../lib/shortcuts';

export type HelpDialog = 'shortcuts' | 'about';

/**
 * Один шорткат: подпись + один или несколько альтернативных аккордов. Аккорды — в нейтральной
 * записи (`Mod` = ⌘ на macOS / Ctrl на остальных), подписи собирает `Shortcut` под ОС.
 */
type Shortcut = { label: string; combos: string[] };
type ShortcutGroup = { title: string; items: Shortcut[] };

const SHORTCUT_GROUPS: ReadonlyArray<ShortcutGroup> = [
  {
    title: 'Общие',
    items: [
      { label: 'Сохранить / Экспорт', combos: ['Mod+S'] },
      { label: 'Закрыть модалку / снять выделение', combos: ['Escape'] },
      { label: 'Цикл фокуса по зонам (вперёд / назад)', combos: ['F6', 'Shift+F6'] },
    ],
  },
  {
    title: 'Панели и вид',
    items: [
      { label: 'Боковая панель', combos: ['Mod+B'] },
      { label: 'Файлы', combos: ['Shift+Mod+E'] },
      { label: 'Палитра', combos: ['Shift+Mod+B'] },
      { label: 'Свойства', combos: ['Alt+Mod+B'] },
      {
        label: 'Режим отображения (вперёд / назад)',
        combos: ['Mod+Alt+V', 'Shift+Mod+Alt+V'],
      },
      {
        label: 'Схематичный / Renderer / Код',
        combos: ['Mod+Alt+1', 'Mod+Alt+2', 'Mod+Alt+3'],
      },
      { label: 'Renderer: Редактирование ⇄ Тест', combos: ['Mod+Alt+E'] },
    ],
  },
  {
    title: 'Редактирование (холст: Схематичный и Renderer)',
    items: [
      {
        label: 'Навигация по узлам (в ряду — ←→ по соседям)',
        combos: ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'],
      },
      { label: 'Расширить выделение (вдоль ряда / столбца)', combos: ['Shift+Arrows'] },
      { label: 'Переместить узел', combos: ['Mod+Arrows'] },
      {
        label: 'Дублировать до / после (вдоль ряда / столбца)',
        combos: ['Shift+Alt+ArrowUp', 'Shift+Alt+ArrowDown'],
      },
      { label: 'Добавить компонент', combos: ['Enter'] },
      { label: 'Перейти к свойствам', combos: ['Space'] },
      { label: 'Дублировать', combos: ['Mod+D'] },
      { label: 'Удалить', combos: ['Delete', 'Backspace'] },
      {
        label: 'Сгруппировать / Разгруппировать',
        combos: ['Mod+G', 'Shift+Mod+G'],
      },
      { label: 'Сменить раскладку', combos: ['Shift+Mod+L'] },
      {
        label: 'Отменить / Вернуть',
        combos: ['Mod+Z', 'Shift+Mod+Z'],
      },
    ],
  },
];

function ShortcutsBody() {
  return (
    <>
      <DialogHeader>
        <DialogTitle>Горячие клавиши</DialogTitle>
        <DialogDescription>
          {PLATFORM === 'mac'
            ? 'Комбинации показаны для macOS; на Windows/Linux те же аккорды набираются на Ctrl/Alt.'
            : 'Комбинации показаны для Windows/Linux; на macOS те же аккорды набираются на ⌘/⌥.'}
        </DialogDescription>
      </DialogHeader>
      <div className="-mr-2 max-h-[60vh] space-y-5 overflow-y-auto pr-2 py-1">
        {SHORTCUT_GROUPS.map((group) => (
          <section key={group.title} className="space-y-1">
            <h3 className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
              {group.title}
            </h3>
            <dl className="divide-y divide-border/60">
              {group.items.map((s) => (
                <div key={s.label} className="flex items-center justify-between gap-4 py-1.5">
                  <dt className="text-[13px] text-foreground">{s.label}</dt>
                  <dd className="flex flex-none items-center gap-1.5">
                    {s.combos.map((combo, i) => (
                      <Fragment key={combo}>
                        {i > 0 && <span className="text-xs text-muted-foreground">/</span>}
                        <ShortcutKeys keys={combo} />
                      </Fragment>
                    ))}
                  </dd>
                </div>
              ))}
            </dl>
          </section>
        ))}
      </div>
    </>
  );
}

function AboutBody() {
  return (
    <>
      <DialogHeader>
        <div className="flex items-center gap-3">
          <span className="grid h-10 w-10 flex-none place-items-center rounded-lg bg-primary text-primary-foreground shadow-sm">
            <Blocks className="h-5 w-5" />
          </span>
          <div>
            <DialogTitle>ReFormer Builder</DialogTitle>
            <DialogDescription>Визуальный конструктор форм</DialogDescription>
          </div>
        </div>
      </DialogHeader>
      <div className="space-y-3 py-1 text-[13px] leading-relaxed text-muted-foreground">
        <p>
          Собирает схему формы из компонентов{' '}
          <span className="font-medium text-foreground">@reformer/ui-kit</span> и экспортирует её
          для рендеринга через renderer-react и renderer-json.
        </p>
        <p>
          Схематичный предпросмотр, живой Renderer и генерация кода — в одном окне. Полный список
          горячих клавиш — в меню «Справка → Горячие клавиши».
        </p>
      </div>
    </>
  );
}

export function HelpDialogs({
  dialog,
  onClose,
}: {
  dialog: HelpDialog | null;
  onClose: () => void;
}) {
  if (!dialog) return null;
  return (
    <Dialog
      open
      onOpenChange={(o) => {
        if (!o) onClose();
      }}
    >
      <DialogContent className={dialog === 'shortcuts' ? 'max-w-lg' : 'max-w-md'}>
        {dialog === 'shortcuts' ? <ShortcutsBody /> : <AboutBody />}
      </DialogContent>
    </Dialog>
  );
}
