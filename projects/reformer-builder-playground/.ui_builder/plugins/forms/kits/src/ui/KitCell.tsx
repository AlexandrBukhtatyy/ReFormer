/**
 * Ячейка строки состояния: действующий кит и список, на какой его сменить.
 *
 * Здесь только отрисовка. Что показать, решает `../cell`, что сделать по щелчку — плагин;
 * ячейка получает готовый список и отдаёт выбранный пункт.
 *
 * ## Почему `button`, а не `Button` кита
 *
 * Тот же довод, что у собственных ячеек оболочки: ячейка строки состояния — окрашенный текст,
 * а не плашка. Кнопка кита принесла бы высоту, отступы и фон, и в полосе текста появился бы
 * один элемент другого рода. Нативная кнопка даёт то, ради чего она нужна, — фокус с клавиатуры
 * и роль — и не даёт ничего сверх.
 *
 * ## Когда ячейка не кнопка
 *
 * Кит один — переключать не между чем. Кнопка, открывающая список из одного отмеченного пункта,
 * обещает выбор, которого нет; поэтому остаётся текст: он по-прежнему отвечает на вопрос
 * «чем нарисована форма».
 *
 * @module plugins/forms/kits/ui/KitCell
 */

import { useCallback, useSyncExternalStore, type ReactElement } from 'react';
import { UNKNOWN_KIT_VERSION, useTranslate, type PluginI18n } from '@reformer/builder-plugin-api';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@reformer/ui-kit/dropdown-menu';
import { KITS_CELL_ID, type KitCellStore } from '../cell';

export interface KitCellProps {
  readonly store: Pick<KitCellStore, 'get' | 'subscribe'>;
  readonly i18n: Pick<PluginI18n, 'locale' | 't' | 'onDidChangeLocale'>;
  readonly onSelect: (kitId: string) => void;
  /** Вернуть кит к конфигу запуска — снять выбор человека. */
  readonly onReset: () => void;
}

export function KitCell({ store, i18n, onSelect, onReset }: KitCellProps): ReactElement | null {
  const t = useTranslate(i18n);
  const subscribe = useCallback(
    (onStoreChange: () => void) => {
      const subscription = store.subscribe(onStoreChange);
      return () => {
        subscription.dispose();
      };
    },
    [store]
  );
  const getSnapshot = useCallback(() => store.get(), [store]);
  const state = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);

  if (state.label === null) return null;
  if (state.kits.length < 2) {
    return <span data-status-indicator={KITS_CELL_ID}>{state.label}</span>;
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          data-status-indicator={KITS_CELL_ID}
          title={t('cell.hint', { label: state.label })}
          className="hover:text-foreground focus-visible:text-foreground data-[state=open]:text-foreground cursor-pointer rounded-sm outline-none focus-visible:underline"
        >
          {state.label}
        </button>
      </DropdownMenuTrigger>
      {/* Вверх и к правому краю: ячейка стоит в нижней полосе у правого края окна. */}
      <DropdownMenuContent side="top" align="end">
        <DropdownMenuLabel>{t('menu.title')}</DropdownMenuLabel>
        <DropdownMenuRadioGroup
          value={state.activeId ?? ''}
          onValueChange={(id) => {
            if (id !== state.activeId) onSelect(id);
          }}
        >
          {state.kits.map((kit) => (
            <DropdownMenuRadioItem key={kit.id} value={kit.id}>
              <span>{kit.label}</span>
              {/* Версию показывает только кит, который её назвал: служебное «версии нет»
                  человеку ничего не говорит. */}
              {kit.version !== UNKNOWN_KIT_VERSION && (
                <span className="text-muted-foreground ml-auto pl-6 text-xs">{kit.version}</span>
              )}
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
        {/* Не ещё один кит, а отказ от собственного выбора — поэтому вне радио-группы:
            отметки у него не бывает, даже когда кит совпадает с конфигом. */}
        <DropdownMenuSeparator />
        <DropdownMenuItem
          onSelect={() => {
            onReset();
          }}
        >
          <span>{t('menu.reset')}</span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
