/**
 * Окно настроек: поиск сверху, разделы слева, список настроек справа.
 *
 * ## Раскладка повторяет редактор настроек VS Code, и это не подражание
 *
 * У неё три свойства, каждое из которых решает свою задачу: **поиск сверху** — потому что
 * настройку ищут по названию, а не по разделу, и с ростом числа настроек это единственный
 * способ её найти; **разделы слева списком** — потому что вкладки поверх содержимого
 * разъезжаются уже на пятом разделе; **широкое окно** — потому что настройка это подпись,
 * пояснение и поле в столбик, и на узкой колонке пояснение занимает четыре строки вместо
 * одной. Совпадение с редактором, на который человек насмотрелся, — дополнительная выгода:
 * искать он будет там, где привык.
 *
 * ## Поиск идёт по ВСЕМ разделам, а не внутри выбранного
 *
 * Поиск внутри раздела требует сперва угадать раздел — то есть ровно то, от чего поиск
 * избавляет. Поэтому запрос отменяет выбор раздела и показывает найденное отовсюду,
 * подписывая каждую строку её разделом.
 *
 * ## Значение читается на каждый кадр, а не хранится в состоянии
 *
 * Своя копия значения в `useState` разошлась бы с действительностью в первый же момент, когда
 * настройку меняют мимо окна — командой, другим окном, чужой вкладкой через общее хранилище.
 * Поэтому источник истины один: {@link SettingField.read}.
 *
 * @module shell/platform/ui/dialogs/SettingsDialog
 */

import { useCallback, useEffect, useMemo, useState, type ReactElement } from 'react';
import { Button } from '@reformer/ui-kit/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@reformer/ui-kit/dialog';
import { Input } from '@reformer/ui-kit/input';
import { Label } from '@reformer/ui-kit/label';
import { ScrollArea } from '@reformer/ui-kit/scroll-area';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@reformer/ui-kit/select';
import { Search } from 'lucide-react';
import type { CommandRegistry } from '@/shell/platform/primitives/command';
import type { RootI18nService } from '@/shell/platform/services/i18n/i18n';
import { DIALOG_SCOPE, useScope, type ScopeStack } from '@/shell/platform/ui/keyboard/scope';
import type { SettingField, SettingsSection } from './settings-ui';
import { useLocale } from '@/shell/platform/ui/chrome/usePanels';

/** Команда, открывающая окно. Идентификатор экспортирован: на него ссылается пункт меню. */
export const SETTINGS_OPEN_COMMAND_ID = 'host.settings.open';

export interface SettingsDialogProps {
  readonly commands: CommandRegistry;
  readonly i18n: RootI18nService;
  /** Разделы. Пустой список означает, что настраивать нечего — команда тогда недоступна. */
  readonly sections: readonly SettingsSection[];
  readonly scopes?: ScopeStack;
}

/** Строка списка: поле и раздел, которому оно принадлежит. Раздел нужен подписи при поиске. */
interface SettingRowModel {
  readonly section: SettingsSection;
  readonly field: SettingField;
}

/** Все поля всех разделов, отобранные запросом. Пустой запрос отбора не делает. */
function search(
  sections: readonly SettingsSection[],
  query: string,
  translate: (key: string) => string
): readonly SettingRowModel[] {
  const needle = query.trim().toLowerCase();
  const rows = sections.flatMap((section) =>
    section.fields.map((field) => ({ section, field }) satisfies SettingRowModel)
  );
  if (needle === '') return rows;
  return rows.filter(({ section, field }) => {
    // Ищем по тому, что ВИДНО: подпись, пояснение и название раздела. Идентификаторы полей
    // человеку не показаны, и попадание по ним выглядело бы как случайное.
    const haystack = [
      translate(section.titleKey),
      translate(field.titleKey),
      field.descriptionKey === undefined ? '' : translate(field.descriptionKey),
    ]
      .join(' ')
      .toLowerCase();
    return haystack.includes(needle);
  });
}

export function SettingsDialog({
  commands,
  i18n,
  sections,
  scopes,
}: SettingsDialogProps): ReactElement | null {
  const [open, setOpen] = useState(false);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  // Смена языка меняет ВСЕ подписи окна, включая его собственные, поэтому подписка на локаль
  // здесь обязательна: иначе окно осталось бы на прежнем языке до перерисовки чем-то ещё.
  useLocale(i18n);
  useScope(scopes, open ? DIALOG_SCOPE : null);

  useEffect(() => {
    try {
      const subscription = commands.register({
        id: SETTINGS_OPEN_COMMAND_ID,
        titleKey: 'shell.settings.title',
        // То же сочетание, что в VS Code: настройки — первое, что ищут на этой клавише.
        keybinding: 'mod+,',
        allowInEditable: true,
        enabled: () => sections.length > 0,
        run: () => {
          setOpen(true);
        },
      });
      return () => {
        subscription.dispose();
      };
    } catch (error) {
      console.error('[shell] команда настроек не зарегистрирована', error);
      return undefined;
    }
  }, [commands, sections]);

  const searching = query.trim() !== '';
  const active = sections.find((section) => section.id === activeId) ?? sections[0] ?? null;
  const rows = useMemo(
    () =>
      searching
        ? search(sections, query, (key) => i18n.t(key))
        : search(active === null ? [] : [active], '', (key) => i18n.t(key)),
    [searching, sections, query, active, i18n]
  );

  if (sections.length === 0) return null;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent
        data-testid="settings-dialog"
        // Крупное окно и своя раскладка вместо сетки кита: у окна три полосы (шапка,
        // содержимое, ничего снизу), и прокручиваться обязана только средняя.
        className="flex h-[80vh] max-w-5xl flex-col gap-0 overflow-hidden p-0 sm:max-w-5xl"
      >
        {/* Шапка в ОДНУ строку: заголовок, поиск по центру и запас справа под крестик окна.
            Столбцы равной ширины держат поиск по центру ОКНА, а не остатка строки, — иначе
            он ездил бы вслед за длиной заголовка, а она меняется вместе с языком. */}
        <DialogHeader className="border-border grid flex-none grid-cols-3 items-center gap-2 border-b px-4 py-2">
          <DialogTitle className="text-[13px] font-semibold">
            {i18n.t('shell.settings.title')}
          </DialogTitle>
          {/* Пояснение остаётся для скринридера: окно обязано себя называть, а на экране
              его место занимает поиск — как в редакторе настроек, с которого взята раскладка. */}
          <DialogDescription className="sr-only">
            {i18n.t('shell.settings.description')}
          </DialogDescription>
          <div className="relative w-full max-w-xs justify-self-center">
            <Search
              aria-hidden="true"
              className="text-muted-foreground pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2"
            />
            <Input
              aria-label={i18n.t('shell.settings.search')}
              data-testid="settings-search"
              className="h-7 pl-8 text-[13px]"
              placeholder={i18n.t('shell.settings.search')}
              value={query}
              onChange={(event) => setQuery(event.target.value)}
            />
          </div>
          <span aria-hidden="true" />
        </DialogHeader>

        <div className="flex min-h-0 flex-1">
          <nav
            aria-label={i18n.t('shell.settings.sections')}
            className="border-border w-56 flex-none overflow-y-auto border-r p-2"
          >
            {sections.map((section) => (
              <Button
                key={section.id}
                variant="ghost"
                size="sm"
                aria-current={!searching && section.id === active?.id}
                data-testid={`settings-section-${section.id}`}
                className={
                  !searching && section.id === active?.id
                    ? 'bg-accent text-accent-foreground w-full justify-start font-normal'
                    : 'w-full justify-start font-normal'
                }
                onClick={() => {
                  // Выбор раздела отменяет поиск: иначе список остался бы отфильтрованным,
                  // и нажатие по разделу выглядело бы как отказ.
                  setQuery('');
                  setActiveId(section.id);
                }}
              >
                {i18n.t(section.titleKey)}
              </Button>
            ))}
          </nav>

          <ScrollArea className="min-h-0 flex-1">
            <div className="px-6 py-2">
              {rows.length === 0 ? (
                <p className="text-muted-foreground py-6 text-[13px]">
                  {i18n.t('shell.settings.no-results')}
                </p>
              ) : (
                rows.map((row) => (
                  <SettingRow
                    key={`${row.section.id}:${row.field.id}`}
                    row={row}
                    i18n={i18n}
                    // Раздел подписывают только результаты поиска: внутри выбранного раздела
                    // его название стояло бы над каждой строкой без нужды.
                    withSection={searching}
                  />
                ))
              )}
            </div>
          </ScrollArea>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function SettingRow({
  row,
  i18n,
  withSection,
}: {
  row: SettingRowModel;
  i18n: RootI18nService;
  withSection: boolean;
}): ReactElement {
  const { field, section } = row;
  // Отказ записи показываем В ОКНЕ: настройка, которая «не применилась», без объяснения
  // выглядит как неработающий переключатель — человек жмёт его второй и третий раз.
  const [failed, setFailed] = useState(false);
  const [, force] = useState(0);

  const change = useCallback(
    (value: string) => {
      setFailed(false);
      void field
        .write(value)
        // Перерисовка после записи: значение читается у поля, и без неё выбранное
        // не появилось бы в списке до чужого кадра.
        .then(() => force((tick) => tick + 1))
        .catch((error: unknown) => {
          console.error(`[shell] настройка «${field.id}» не записана`, error);
          setFailed(true);
        });
    },
    [field]
  );

  return (
    // Настройка — СТРОКА: слева то, что читают («что это и зачем»), справа то, чем меняют.
    // Так глаз проходит список сверху вниз по одной колонке подписей, а поля стоят в свой
    // столбец и не разъезжаются вслед за длиной пояснений.
    <div className="border-border/60 flex items-start justify-between gap-8 border-b py-4 last:border-b-0">
      <div className="min-w-0 flex-1">
        {withSection ? (
          <div className="text-muted-foreground mb-1 text-[11px] font-medium tracking-wide uppercase">
            {i18n.t(section.titleKey)}
          </div>
        ) : null}
        <Label htmlFor={`setting-${field.id}`} className="text-[13px] font-semibold">
          {i18n.t(field.titleKey)}
        </Label>
        {field.descriptionKey === undefined ? null : (
          <p className="text-muted-foreground mt-1 text-[12px] leading-relaxed">
            {i18n.t(field.descriptionKey)}
          </p>
        )}
      </div>

      <div className="w-64 flex-none">
        <Select value={field.read()} onValueChange={change}>
          <SelectTrigger
            id={`setting-${field.id}`}
            size="sm"
            data-testid={`setting-${field.id}`}
            className="w-full"
          >
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {field.choices.map((choice) => (
              <SelectItem key={choice.value} value={choice.value}>
                {i18n.t(choice.titleKey)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {/* Отказ записи — под полем, а не под подписью: он про действие, а действие здесь. */}
        {failed ? (
          <p className="text-destructive mt-1.5 text-[12px]">{i18n.t('shell.settings.failed')}</p>
        ) : null}
      </div>
    </div>
  );
}
