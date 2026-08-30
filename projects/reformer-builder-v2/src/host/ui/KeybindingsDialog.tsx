/**
 * Экран «Горячие клавиши»: что назначено, чем, и как это переназначить.
 *
 * ## Заменяет read-only таблицу справки, а не дополняет её
 *
 * Двух списков сочетаний, обязанных совпадать, в проекте не бывает: один из них разошёлся бы
 * с другим на первой же новой команде, и разошёлся бы молча. Поэтому read-only таблица
 * справки убрана вместе со своей командой, а пункт меню «Горячие клавиши» ведёт сюда.
 *
 * ## Запись нажатия слушает клавиатуру САМА, в фазе погружения
 *
 * Обычный `onKeyDown` React здесь не годится дважды. Во-первых, React делегирует события,
 * и к моменту синтетического вызова глобальный слой уже мог отработать: `mod+s` во время
 * записи сохранил бы файл. Во-вторых, диалог Radix живёт в портале и ловит Escape на
 * `document` в фазе погружения — то есть закрылся бы раньше, чем компонент узнал о нажатии.
 *
 * Отсюда: нативный слушатель на САМОМ поле, `capture: true`, `preventDefault` и
 * `stopPropagation` на каждом нажатии. Это единственное место оболочки, где перехват
 * настолько жёсткий, и он ограничен временем записи.
 *
 * @module host/ui/KeybindingsDialog
 */

import { useCallback, useEffect, useRef, useState, type ReactElement } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@reformer/ui-kit/dialog';
import { Button } from '@reformer/ui-kit/button';
import { Input } from '@reformer/ui-kit/input';
import { Kbd, KbdGroup } from '@reformer/ui-kit/kbd';
import { ScrollArea } from '@reformer/ui-kit/scroll-area';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@reformer/ui-kit/table';
import type { CommandRegistry } from '../primitives/command';
import type { RootI18nService } from '../services/i18n/i18n';
import {
  beginRecording,
  conflictsOf,
  editorRows,
  pushKey,
  withRebinding,
  withReset,
  withUnbinding,
  type EditorRow,
  type RecordingState,
} from './keybinding-editor';
import {
  detectPlatformModifier,
  eventToKeybinding,
  formatKeybinding,
  type PlatformModifier,
} from './keybindings';
import type { KeybindingLayer } from './keybinding-rules';
import type { KeymapService } from './keymap';
import { DIALOG_SCOPE, useScope, type ScopeStack } from './scope';
import { useLocale } from './usePanels';
import { WHEN_TRUE } from '../primitives/when-expr';

/** Команда, открывающая экран. Идентификатор экспортирован: на него ссылается пункт меню. */
export const KEYBINDINGS_OPEN_COMMAND_ID = 'host.keybindings.open';

export interface KeybindingsDialogProps {
  readonly commands: CommandRegistry;
  readonly keymap: KeymapService;
  readonly i18n: RootI18nService;
  readonly scopes?: ScopeStack;
  readonly modifier?: PlatformModifier;
}

/**
 * Кто назначил сочетание — колонка «Источник», как в редакторе клавиш VS Code.
 *
 * Плагин встроенный и плагин каталога сведены в одну подпись: человеку важно, что клавишу
 * назначил не он и не оболочка, а разницу между «встроен» и «лежит в проекте» показывает
 * список плагинов. `null` — у строки нет сочетания вовсе, и источника у него быть не может.
 */
function sourceLabel(layer: KeybindingLayer | null, t: (key: string) => string): string {
  switch (layer) {
    case 'user':
      return t('shell.keybindings.source.user');
    case 'builtin-plugin':
    case 'catalog-plugin':
      return t('shell.keybindings.source.plugin');
    case 'host':
      return t('shell.keybindings.source.host');
    default:
      return '';
  }
}

/** Сочетание клавишами. Ступени аккорда — раздельными группами: это два НАЖАТИЯ. */
function ChordKeys({ chord }: { chord: readonly string[] }): ReactElement {
  return (
    <span className="flex flex-none items-center gap-1">
      {chord.map((step, stepIndex) => (
        <KbdGroup key={`${step}-${String(stepIndex)}`} className="flex-none">
          {step
            .split('+')
            .filter((key) => key !== '')
            .map((key, index) => (
              <Kbd key={`${key}-${String(index)}`}>{key}</Kbd>
            ))}
        </KbdGroup>
      ))}
    </span>
  );
}

/**
 * Поле записи нажатия.
 *
 * Слушатель ставится на сам элемент в фазе погружения — см. шапку модуля. Escape отменяет
 * запись, а не записывается: голое Escape уже несёт три смысла в приложении, и отдавать его
 * в назначение значило бы отнять один из них.
 */
function Recorder({
  state,
  onKey,
  onCancel,
}: {
  readonly state: RecordingState;
  readonly onKey: (binding: string | null) => void;
  readonly onCancel: () => void;
}): ReactElement {
  const ref = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const node = ref.current;
    if (node === null) return;
    node.focus();

    const listener = (event: KeyboardEvent): void => {
      event.preventDefault();
      event.stopPropagation();
      if (event.key === 'Escape') {
        onCancel();
        return;
      }
      onKey(eventToKeybinding(event));
    };
    node.addEventListener('keydown', listener, { capture: true });
    return () => {
      node.removeEventListener('keydown', listener, { capture: true });
    };
  }, [onKey, onCancel]);

  return (
    <div
      ref={ref}
      tabIndex={0}
      data-testid="keybinding-recorder"
      className="border-primary flex min-h-8 flex-1 items-center gap-1 rounded border px-2 outline-none"
    >
      <ChordKeys chord={state.steps} />
    </div>
  );
}

export function KeybindingsDialog({
  commands,
  keymap,
  i18n,
  scopes,
  modifier,
}: KeybindingsDialogProps): ReactElement {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [editing, setEditing] = useState<string | null>(null);
  const [recording, setRecording] = useState<RecordingState>(beginRecording);
  // Смена раскладки — повод перерисоваться: список строится из неё.
  const [revision, setRevision] = useState(0);
  useScope(scopes, open ? DIALOG_SCOPE : null);
  useLocale(i18n);
  const { t } = i18n;
  const platformModifier = modifier ?? detectPlatformModifier();

  useEffect(() => {
    const subscription = keymap.onDidChange(() => {
      setRevision((value) => value + 1);
    });
    return () => {
      subscription.dispose();
    };
  }, [keymap]);

  useEffect(() => {
    try {
      const subscription = commands.register({
        id: KEYBINDINGS_OPEN_COMMAND_ID,
        titleKey: 'shell.keybindings.title',
        // Аккорд, как в VS Code: у клавиатуры своё пространство сочетаний, и открытие
        // её настроек — первое, что в этом пространстве стоит завести.
        keybinding: 'mod+k mod+s',
        allowInEditable: true,
        run: () => {
          setOpen(true);
        },
      });
      return () => {
        subscription.dispose();
      };
    } catch (error) {
      console.error('[shell] команда настройки клавиш не зарегистрирована', error);
      return undefined;
    }
  }, [commands]);

  const conflicting = new Set(
    keymap.conflicts().flatMap((conflict) => conflict.rules.map((rule) => rule.id))
  );
  const rows = open
    ? editorRows(keymap.index(), {
        translate: (key, owner) =>
          owner?.pluginId === undefined ? i18n.t(key) : i18n.forPlugin(owner.pluginId).t(key),
        commands: commands.getAll(),
        conflicting,
        query,
      })
    : [];

  const stopEditing = useCallback(() => {
    setEditing(null);
    setRecording(beginRecording());
  }, []);

  const commit = useCallback(
    (row: EditorRow) => {
      if (recording.steps.length === 0) return;
      void keymap
        .setUserRules(withRebinding(keymap.userRules(), row.commandId, recording.steps, row.when))
        .catch((error: unknown) => {
          console.error('[shell] раскладка не записана', error);
        });
      stopEditing();
    },
    [keymap, recording, stopEditing]
  );

  const unbind = useCallback(
    (row: EditorRow) => {
      // Снятие, а не удаление записи: сочетание, объявленное командой или плагином, живёт
      // в коде, и перекрыть его нечем, кроме явной строки с минусом.
      void keymap
        .setUserRules(withUnbinding(keymap.userRules(), row.commandId, row.chord))
        .catch((error: unknown) => {
          console.error('[shell] раскладка не записана', error);
        });
    },
    [keymap]
  );

  const reset = useCallback(
    (row: EditorRow) => {
      void keymap
        .setUserRules(withReset(keymap.userRules(), row.commandId))
        .catch((error: unknown) => {
          console.error('[shell] раскладка не записана', error);
        });
    },
    [keymap]
  );

  // Занятые тем же сочетанием правила — считаются до записи, чтобы человек увидел
  // соперника раньше, чем нажмёт «Назначить».
  const taken =
    editing === null || recording.steps.length === 0
      ? []
      : conflictsOf(keymap.index(), recording.steps, WHEN_TRUE).filter(
          (rule) => rule.commandId !== editing
        );

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) stopEditing();
      }}
    >
      <DialogContent
        // Ширина задаётся именно ВАРИАНТОМ `sm:`, а не базовым `max-w-*`: у диалога кита
        // объявлено `sm:max-w-lg`, и слияние классов не считает эти два конфликтующими —
        // в CSS правило с медиа-запросом идёт позже и побеждает. Базовый `max-w-4xl`
        // молча не применялся вовсе.
        className="sm:max-w-5xl"
        data-testid="keybindings-dialog"
        data-revision={revision}
      >
        <DialogHeader>
          <DialogTitle>{t('shell.keybindings.title')}</DialogTitle>
          <DialogDescription>{t('shell.keybindings.hint')}</DialogDescription>
        </DialogHeader>

        <Input
          value={query}
          onChange={(event) => {
            setQuery(event.target.value);
          }}
          placeholder={t('shell.keybindings.search.placeholder')}
          aria-label={t('shell.keybindings.search.label')}
        />

        {/* Прокрутка — областью кита, а не нативным `overflow-y-auto`: её полоса лежит
            оверлеем поверх края и не отъедает ширину у таблицы, которой здесь и так тесно.

            ВЫСОТУ область берёт из РАСКЛАДКИ, а не из класса на себе. Своему окну она
            объявляет `h-full`, а сто процентов от `max-height` родителя — это `auto`:
            предела нет, прокрутка не включается вовсе, и таблица уезжает за нижний край
            экрана. Поэтому предел стоит на обёртке-колонке, а высоту области задаёт
            флексбокс (`flex-auto` + `min-h-0`): пока строк мало — по содержимому, дальше —
            упор в предел и прокрутка.

            ШИРИНА — причина, по которой область сюда сперва не поставили: Radix кладёт
            содержимое в свой `display: table`, а тот растёт до МИНИМАЛЬНОЙ ширины
            содержимого, и таблица разъезжалась до полутора тысяч пикселей — кнопки
            последней колонки уезжали за край. С нынешней разметкой не растёт: минимальная
            ширина у контейнера таблицы нулевая (он сам прокручивается, `overflow-x-auto`),
            и `display: table` остаётся шириной окна. Это ИЗМЕРЕНО тестом, а не
            подразумевается, — вместе с самой прокруткой. */}
        <div className="flex max-h-[55vh] flex-col">
          <ScrollArea className="min-h-0 flex-auto">
            {/* Отступ справа — под полосу-оверлей: без него она ложится на кнопки
                последней колонки, а они здесь крайние по краю. */}
            <Table className="table-fixed pr-2.5">
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[24%]">{t('shell.keybindings.column.command')}</TableHead>
                  <TableHead className="w-[20%]">{t('shell.keybindings.column.key')}</TableHead>
                  <TableHead className="w-[16%]">{t('shell.keybindings.column.chord')}</TableHead>
                  <TableHead className="w-[16%]">{t('shell.keybindings.column.when')}</TableHead>
                  <TableHead className="w-[10%]">{t('shell.keybindings.column.source')}</TableHead>
                  <TableHead className="sr-only">{t('shell.keybindings.column.actions')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((row) => (
                  <TableRow key={row.id} data-testid={`keybinding-row-${row.commandId}`}>
                    <TableCell className="truncate">
                      {row.title}
                      {row.conflicting && (
                        <span className="ml-2 text-[11px] text-amber-600">
                          {t('shell.keybindings.conflict.unresolved')}
                        </span>
                      )}
                    </TableCell>

                    {/* Ключ — то, чем команду называют в раскладке, в манифесте плагина и
                      в обращении к ассистенту. Моноширинным и приглушённым: это не текст
                      интерфейса, а адрес, и отличать его от заголовка глазами обязательно. */}
                    <TableCell className="text-muted-foreground truncate font-mono text-[11px]">
                      {row.commandId}
                    </TableCell>

                    <TableCell>
                      {editing === row.commandId ? (
                        <Recorder
                          state={recording}
                          onKey={(binding) => {
                            setRecording((state) => pushKey(state, binding));
                          }}
                          onCancel={stopEditing}
                        />
                      ) : (
                        <ChordKeys
                          chord={row.chord.map((step) => formatKeybinding(step, platformModifier))}
                        />
                      )}
                    </TableCell>

                    <TableCell className="text-muted-foreground truncate font-mono text-[11px]">
                      {row.when}
                    </TableCell>

                    <TableCell className="text-muted-foreground text-[11px]">
                      {sourceLabel(row.layer, t)}
                    </TableCell>

                    <TableCell className="text-right">
                      {editing === row.commandId ? (
                        <span className="flex items-center justify-end gap-1">
                          <Button
                            size="sm"
                            disabled={recording.steps.length === 0}
                            onClick={() => {
                              commit(row);
                            }}
                          >
                            {t('shell.keybindings.record.commit')}
                          </Button>
                          <Button size="sm" variant="ghost" onClick={stopEditing}>
                            {t('shell.keybindings.record.cancel')}
                          </Button>
                        </span>
                      ) : (
                        <span className="flex items-center justify-end gap-1">
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => {
                              setEditing(row.commandId);
                              setRecording(beginRecording());
                            }}
                          >
                            {t('shell.keybindings.record.start')}
                          </Button>
                          {row.chord.length > 0 && (
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => {
                                unbind(row);
                              }}
                            >
                              {t('shell.keybindings.remove')}
                            </Button>
                          )}
                          {row.layer === 'user' && (
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => {
                                reset(row);
                              }}
                            >
                              {t('shell.keybindings.reset')}
                            </Button>
                          )}
                        </span>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
                {rows.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={6} className="text-muted-foreground">
                      {t('shell.keybindings.empty')}
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </ScrollArea>
        </div>

        {taken.length > 0 && (
          <p className="text-[12px] text-amber-600">
            {t('shell.keybindings.conflict', { command: taken[0].commandId })}
          </p>
        )}
      </DialogContent>
    </Dialog>
  );
}
