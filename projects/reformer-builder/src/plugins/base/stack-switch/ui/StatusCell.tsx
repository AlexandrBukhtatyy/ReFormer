/**
 * Ячейка строки состояния: действующее сочетание «движок · кит» и список, на что его сменить.
 *
 * Здесь только отрисовка. Что показать, решает `../combinations`, что сделать по щелчку —
 * `../switching`; ячейка получает готовый список и отдаёт выбранный пункт.
 *
 * ## Почему `button`, а не `Button` кита
 *
 * Тот же довод, что у собственных ячеек оболочки (шапка `StatusBar`): ячейка строки состояния —
 * окрашенный текст, а не плашка. Кнопка кита принесла бы высоту, отступы и фон, и в полосе
 * текста появился бы один элемент другого рода. Нативная кнопка даёт то, ради чего она нужна, —
 * фокус с клавиатуры и роль — и не даёт ничего сверх.
 *
 * ## Когда ячейка не кнопка
 *
 * Сочетание одно — переключать не между чем (организация закрепила состав, кит единственный).
 * Кнопка, открывающая список из одного отмеченного пункта, обещает выбор, которого нет; поэтому
 * остаётся текст: он по-прежнему отвечает на вопрос «на чём я сейчас работаю».
 *
 * @module plugins/base/stack-switch/ui/StatusCell
 */

import { useCallback, useSyncExternalStore, type ReactElement } from 'react';
import { useTranslate, type PluginI18n } from '@reformer/builder-plugin-api';
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
import type { Combination } from '../combinations';
import { STACK_SWITCH_CELL_ID } from '../contract';
import type { SwitchStore } from '../store';

export interface StatusCellProps {
  readonly store: Pick<SwitchStore, 'get' | 'subscribe'>;
  readonly i18n: Pick<PluginI18n, 'locale' | 't' | 'onDidChangeLocale'>;
  readonly onSelect: (combination: Combination) => void;
  /** Вернуть обе оси к конфигу запуска — снять выбор человека. */
  readonly onReset: () => void;
}

export function StatusCell({
  store,
  i18n,
  onSelect,
  onReset,
}: StatusCellProps): ReactElement | null {
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
  if (state.combinations.length < 2) {
    return <span data-status-indicator={STACK_SWITCH_CELL_ID}>{state.label}</span>;
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          data-status-indicator={STACK_SWITCH_CELL_ID}
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
            const chosen = state.combinations.find((combination) => combination.id === id);
            if (chosen !== undefined) onSelect(chosen);
          }}
        >
          {state.combinations.map((combination) => (
            <DropdownMenuRadioItem key={combination.id} value={combination.id}>
              <span>{combination.label}</span>
              {combination.restarts && (
                <span className="text-muted-foreground ml-auto pl-6 text-xs">
                  {t('menu.restarts')}
                </span>
              )}
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
        {/* Не ещё одно сочетание, а отказ от собственного выбора — поэтому вне радио-группы:
            отметки у него не бывает, даже когда сочетание совпадает с конфигом. */}
        <DropdownMenuSeparator />
        <DropdownMenuItem
          onSelect={() => {
            onReset();
          }}
        >
          <span>{t('menu.reset')}</span>
          {state.resetRestarts && (
            <span className="text-muted-foreground ml-auto pl-6 text-xs">{t('menu.restarts')}</span>
          )}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
