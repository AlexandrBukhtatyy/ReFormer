/**
 * Ячейка строки состояния: имя действующего профиля и список предложенных.
 *
 * Один профиль — не выбор: ячейка тогда просто называет его текстом. Два и больше — кнопка
 * со списком, где отмечен действующий, а у остальных сказано, что выбор перезагрузит приложение.
 *
 * Список открывается вверх и к правому краю: ячейка стоит в нижней полосе у правого края окна.
 *
 * @module plugins/base/profile-switch/ui/StatusCell
 */

import type { ReactElement } from 'react';
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
import type { ProfileChoice, SwitchState } from '../choices';
import { PROFILE_SWITCH_CELL_ID } from '../contract';

export interface StatusCellProps {
  readonly state: SwitchState;
  readonly i18n: Pick<PluginI18n, 'locale' | 't' | 'onDidChangeLocale'>;
  readonly onSelect: (choice: ProfileChoice) => void;
  readonly onReset: () => void;
}

export function StatusCell({
  state,
  i18n,
  onSelect,
  onReset,
}: StatusCellProps): ReactElement | null {
  const t = useTranslate(i18n);

  if (state.label === null) return null;
  if (state.choices.length < 2) {
    return <span data-status-indicator={PROFILE_SWITCH_CELL_ID}>{state.label}</span>;
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          data-status-indicator={PROFILE_SWITCH_CELL_ID}
          title={t('cell.hint', { label: state.label })}
          className="hover:text-foreground focus-visible:text-foreground data-[state=open]:text-foreground cursor-pointer rounded-sm outline-none focus-visible:underline"
        >
          {state.label}
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent side="top" align="end">
        <DropdownMenuLabel>{t('menu.title')}</DropdownMenuLabel>
        <DropdownMenuRadioGroup
          value={state.activeId ?? ''}
          onValueChange={(id) => {
            const chosen = state.choices.find((choice) => choice.id === id);
            if (chosen !== undefined) onSelect(chosen);
          }}
        >
          {state.choices.map((choice) => (
            <DropdownMenuRadioItem key={choice.id} value={choice.id}>
              <span>{choice.label}</span>
              {choice.restarts && (
                <span className="text-muted-foreground ml-auto pl-6 text-xs">
                  {t('menu.restarts')}
                </span>
              )}
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
        {/* Не ещё один профиль, а отказ от собственного выбора — поэтому вне радио-группы:
            отметки у него не бывает, даже когда профиль совпадает с конфигом. */}
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
