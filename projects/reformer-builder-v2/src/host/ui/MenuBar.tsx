/**
 * Шапка меню: отрисовка дерева, построенного в `./menu`.
 *
 * Здесь нет ни одного правила — ни «что показывать», ни «в каком порядке», ни «доступно ли».
 * Всё это посчитано до React, потому что окружение быстрых тестов — `node`, а состав меню
 * — самая изменчивая часть оболочки: её обязано проверять что-то дешевле браузера.
 *
 * ## Почему `menubar` кита, а не свой попап
 *
 * Меню в шапке — это не список кнопок: у него есть переход между соседними меню наведением,
 * когда одно уже открыто, стрелки, Home/End, набор первых букв, возврат фокуса и ловушка
 * фокуса в подменю. Radix, который тянет `@reformer/ui-kit/menubar`, всё это уже делает,
 * и он уже в сборке — раскладка, вкладки и подсказки оболочки стоят на нём же.
 *
 * ## Заголовок команды — единственный источник имени
 *
 * Пункт рисует то, что вернула модель; она берёт имя у команды. Поэтому переименование
 * команды меняет и палитру, и меню одновременно, а разойтись им негде.
 *
 * @module host/ui/MenuBar
 */

import { useCallback, useEffect, useMemo, useReducer, type ReactElement } from 'react';
import {
  Menubar,
  MenubarCheckboxItem,
  MenubarContent,
  MenubarItem,
  MenubarMenu,
  MenubarSeparator,
  MenubarShortcut,
  MenubarSub,
  MenubarSubContent,
  MenubarSubTrigger,
  MenubarTrigger,
} from '@reformer/ui-kit/menubar';
import type { CommandRegistry } from '../primitives/command';
import type { RootI18nService } from '../services/i18n/i18n';
import { detectPlatformModifier, formatChord, type PlatformModifier } from './keybindings';
import { chordOfCommand, type KeymapService } from './keymap';
import { buildMenuBar, MenuPoint, observeMenuEntries, type MenuEntry, type MenuNode } from './menu';
import { createMenuIssueReporter, formatMenuIssue } from './menu-issues';
import { useCommandSnapshot, useContributions, useLocale } from './usePanels';
import { useWhenContext, type WhenContextStore } from './when-context-store';
import type { ExtensionReader } from './usePanels';

export interface MenuBarProps {
  readonly commands: CommandRegistry;
  readonly extensions: ExtensionReader;
  readonly whenContext: WhenContextStore;
  readonly i18n: RootI18nService;
  /**
   * Встроенные записи оболочки: проекции её собственных реестров (панели, справка).
   *
   * Отдельным входом, а не вкладом: у корневого реестра `contribute` нет вовсе, и «пункт,
   * который Host внёс сам себе» невыразим по построению. Здесь же видно, что таких записей
   * ровно столько, сколько их есть, — они не растворяются среди вкладов плагинов.
   */
  readonly builtin?: readonly MenuEntry[];
  /**
   * Действующая раскладка. Без неё подпись берётся из объявления команды — верно, пока
   * переопределять сочетания нечем.
   */
  readonly keymap?: KeymapService;
  /** Во что разворачивать `mod` в подписях. По умолчанию определяется по платформе. */
  readonly modifier?: PlatformModifier;
}

/** Один узел меню. Отдельным компонентом — из-за рекурсии в подменю. */
function MenuItemNode({
  node,
  modifier,
}: {
  node: MenuNode;
  modifier: PlatformModifier;
}): ReactElement | null {
  if (node.kind === 'separator') return <MenubarSeparator />;

  if (node.kind === 'submenu') {
    return (
      <MenubarSub>
        <MenubarSubTrigger>{node.title}</MenubarSubTrigger>
        <MenubarSubContent>
          {node.items.map((child) => (
            <MenuItemNode key={child.id} node={child} modifier={modifier} />
          ))}
        </MenubarSubContent>
      </MenubarSub>
    );
  }

  const shortcut =
    node.chord === undefined ? null : (
      <MenubarShortcut>{formatChord(node.chord, modifier)}</MenubarShortcut>
    );

  // Переключатель отличается от пункта именно `checked`: у обычного пункта его нет, и
  // рисовать его галочковым вариантом значило бы оставить в каждой строке место под галочку,
  // которой не будет.
  if (node.checked !== undefined) {
    return (
      <MenubarCheckboxItem checked={node.checked} disabled={!node.enabled} onSelect={node.run}>
        {node.title}
        {shortcut}
      </MenubarCheckboxItem>
    );
  }

  return (
    <MenubarItem disabled={!node.enabled} onSelect={node.run}>
      {node.title}
      {shortcut}
    </MenubarItem>
  );
}

/**
 * Перерисовка шапки по сигналу вклада — тот же хук, что у ряда действий над документом.
 *
 * `useReducer`, а не `useSyncExternalStore`: у сигнала нет снимка, и счётчик заводился бы
 * ради того, чтобы его не читать.
 */
function useMenuRevision(entries: readonly MenuEntry[]): void {
  const [, bump] = useReducer((revision: number) => revision + 1, 0);
  useEffect(() => {
    const subscription = observeMenuEntries(entries, bump);
    return () => {
      subscription.dispose();
    };
  }, [entries]);
}

export function MenuBar({
  commands,
  extensions,
  whenContext,
  i18n,
  builtin,
  keymap,
  modifier,
}: MenuBarProps): ReactElement {
  const contributions = useContributions(extensions, MenuPoint);
  // Вклад вправе сказать «спроси меня заново»: его предикаты могут зависеть от состояния,
  // о котором шапка не знает (режим показа документа, состояние плагина).
  useMenuRevision(contributions);
  // Подписка на реестр команд — как повод перерисоваться: пункты ссылаются на команды,
  // а те появляются позже первого кадра (эффекты палитры и справки, активация плагинов).
  useCommandSnapshot(commands);
  const ctx = useWhenContext(whenContext);
  // Локаль не нужна как значение — нужна как повод перерисоваться: `t()` сам по себе
  // не является React-состоянием, и без подписки шапка осталась бы на прежнем языке.
  useLocale(i18n);
  const platformModifier = useMemo(() => modifier ?? detectPlatformModifier(), [modifier]);

  // Отчётчик привязан к реестру, а не к кадру: он копит промахи и печатает их один раз,
  // перепроверив, что команда так и не появилась. Пересоздание на каждой перерисовке
  // сбрасывало бы дедупликацию, и одна опечатка печаталась бы бесконечно.
  const reportIssue = useMemo(
    () =>
      createMenuIssueReporter({
        hasCommand: (commandId) => commands.get(commandId) !== undefined,
        log: (issue) => {
          console.error(formatMenuIssue(issue), issue.error ?? '');
        },
      }),
    [commands]
  );

  const execute = useCallback(
    (commandId: string, args?: unknown) => {
      // Контекст берётся текущий, а не тот, при котором меню строилось: между построением
      // и щелчком человек мог сменить вкладку, и запускать команду по устаревшему состоянию
      // значило бы применить её не к тому документу.
      void commands.execute(commandId, args).catch((error: unknown) => {
        console.error(`[shell] команда «${commandId}» из меню отказала`, error);
      });
    },
    [commands]
  );

  // Без мемоизации, и это решение, а не упущение. Заголовки переводятся ВНУТРИ построения,
  // поэтому в зависимостях должна была бы стоять локаль — а она в самом вычислении не
  // упоминается, и список зависимостей стал бы ложью, которую линтер справедливо ловит.
  // Цена честности мала: дерево — десятки записей с дешёвыми предикатами, а перерисовка
  // шапки случается от смены вкладки, а не в кадре анимации.
  const bar = buildMenuBar({
    entries: [...(builtin ?? []), ...contributions],
    ctx,
    commands,
    // Заголовок разрешается словарём ВЛАДЕЛЬЦА — команды или вклада. Иначе `command.save`
    // двух плагинов означал бы одну строку на двоих, а ключ Host искался бы в словаре
    // плагина и показывал маркер промаха.
    translate: (key, owner) =>
      owner?.pluginId === undefined ? i18n.t(key) : i18n.forPlugin(owner.pluginId).t(key),
    execute,
    // Подпись обязана показывать то, что сработает, а не то, что объявлено: после
    // переназначения человеком объявленное у команды сочетание перестаёт быть правдой.
    ...(keymap === undefined
      ? {}
      : { chordOf: (id: string) => chordOfCommand(keymap.index(), id) }),
    onIssue: reportIssue,
  });

  return (
    <Menubar className="h-7 gap-0.5 border-0 bg-transparent p-0 shadow-none">
      {bar.map((menu) => (
        <MenubarMenu key={menu.id} value={menu.id}>
          <MenubarTrigger
            disabled={!menu.enabled}
            className="px-2 py-1 text-[12.5px] font-normal disabled:opacity-50"
          >
            {menu.title}
          </MenubarTrigger>
          <MenubarContent align="start">
            {menu.items.map((node) => (
              <MenuItemNode key={node.id} node={node} modifier={platformModifier} />
            ))}
          </MenubarContent>
        </MenubarMenu>
      ))}
    </Menubar>
  );
}
