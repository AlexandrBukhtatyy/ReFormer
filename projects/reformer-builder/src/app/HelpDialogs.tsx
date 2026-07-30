/**
 * Диалоги меню «Справка»: «Горячие клавиши» (сгруппированный список шорткатов на @reformer/ui-kit
 * `kbd`) и «О программе» (бренд + краткое описание билдера). Источник шорткатов — обработчик
 * `onKey` в EditorLayout и `MenubarShortcut` в AppMenuBar; при изменении хоткеев обновлять здесь.
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
import { Kbd, KbdGroup } from '@reformer/ui-kit/kbd';

export type HelpDialog = 'shortcuts' | 'about';

/** Один шорткат: подпись + один или несколько альтернативных аккордов (каждый — набор клавиш). */
type Shortcut = { label: string; combos: string[][] };
type ShortcutGroup = { title: string; items: Shortcut[] };

const SHORTCUT_GROUPS: ReadonlyArray<ShortcutGroup> = [
  {
    title: 'Общие',
    items: [
      { label: 'Сохранить / Экспорт', combos: [['⌘', 'S']] },
      { label: 'Закрыть модалку / снять выделение', combos: [['Esc']] },
      { label: 'Цикл фокуса по зонам (вперёд / назад)', combos: [['F6'], ['⇧', 'F6']] },
    ],
  },
  {
    title: 'Панели и вид',
    items: [
      { label: 'Боковая панель', combos: [['⌘', 'B']] },
      { label: 'Файлы', combos: [['⇧', '⌘', 'E']] },
      { label: 'Палитра', combos: [['⇧', '⌘', 'B']] },
      { label: 'Свойства', combos: [['⌥', '⌘', 'B']] },
      {
        label: 'Режим отображения (вперёд / назад)',
        combos: [
          ['⌘', '⌥', 'V'],
          ['⇧', '⌘', '⌥', 'V'],
        ],
      },
      {
        label: 'Схематичный / Renderer / Код',
        combos: [
          ['⌘', '⌥', '1'],
          ['⌘', '⌥', '2'],
          ['⌘', '⌥', '3'],
        ],
      },
    ],
  },
  {
    title: 'Редактирование (схематичный режим)',
    items: [
      { label: 'Навигация по узлам', combos: [['↑'], ['↓'], ['←'], ['→']] },
      { label: 'Расширить выделение', combos: [['⇧', '↑↓←→']] },
      { label: 'Переместить узел', combos: [['⌘', '↑↓←→']] },
      {
        label: 'Дублировать вверх / вниз',
        combos: [
          ['⇧', '⌥', '↑'],
          ['⇧', '⌥', '↓'],
        ],
      },
      { label: 'Добавить компонент', combos: [['↵']] },
      { label: 'Перейти к свойствам', combos: [['Space']] },
      { label: 'Дублировать', combos: [['⌘', 'D']] },
      { label: 'Удалить', combos: [['Delete'], ['⌫']] },
      {
        label: 'Сгруппировать / Разгруппировать',
        combos: [
          ['⌘', 'G'],
          ['⇧', '⌘', 'G'],
        ],
      },
      { label: 'Сменить раскладку', combos: [['⇧', '⌘', 'L']] },
      {
        label: 'Отменить / Вернуть',
        combos: [
          ['⌘', 'Z'],
          ['⇧', '⌘', 'Z'],
        ],
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
          На macOS — ⌘/⌥, на Windows/Linux те же комбинации на Ctrl/Alt.
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
                      <Fragment key={i}>
                        {i > 0 && <span className="text-xs text-muted-foreground">/</span>}
                        <KbdGroup>
                          {combo.map((key, j) => (
                            <Kbd key={j}>{key}</Kbd>
                          ))}
                        </KbdGroup>
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
