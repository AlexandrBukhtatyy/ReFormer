/**
 * Строка состояния: собственные индикаторы Host и вклады слота `statusbar`.
 *
 * ## Почему вклады, а не поля компонента
 *
 * Активный кит и режим превью появятся позже, и добавляться они обязаны **вкладом**, а не
 * ещё одной строчкой в этом файле. Иначе строка состояния повторит судьбу обработчика клавиш
 * v1: место, куда каждая новая возможность дописывает по условию, пока разобрать его обратно
 * уже нельзя. Слот `statusbar` для этого уже есть в наборе Host, и панель в него вносится
 * тем же `PanelPoint`, что и в любой другой слот, — со своим `when` и своим `order`.
 *
 * Собственных индикаторов у Host ровно столько, сколько принадлежит платформе: состояние
 * рабочей области и активная локаль. Всё, что знает предметную область, приходит вкладом.
 *
 * ## Почему ячейка — `span`, а не `Badge` кита
 *
 * Интерфейс билдера строится на компонентах кита, и это правило; здесь — исключение,
 * и вот его причина. Ячейка строки состояния — это **окрашенный текст**: «проект не открыт»,
 * «RU», «3 ошибки». `Badge` кита — пилюля с фоном, рамкой и скруглением, то есть метка НА
 * чём-то. Строка состояния целиком состоит из таких ячеек, и превратив их в пилюли, мы
 * получили бы не «то же самое на ките», а другой элемент интерфейса: ряд плашек вместо
 * полосы состояния. Кит не предлагает компонента для окрашенного текста — `typography`
 * задаёт шкалу текста статьи, — поэтому здесь остаётся `span` и таблица тонов.
 *
 * Значимость при этом всё равно не решается в разметке: тон приходит из правила
 * (`./status`), а {@link TONE_CLASS} — единственное место, где он превращается в цвет.
 *
 * ## Что осталось непокрытым тестом
 *
 * Только сборка: какие классы у ячейки и в каком порядке идут вклады. Правило «что показывать
 * при таком состоянии» живёт в `./status` и проверяется без React — окружение тестов `node`,
 * DOM там нет.
 *
 * @module host/ui/StatusBar
 */

import { useCallback, useSyncExternalStore, type ReactElement } from 'react';
import type { RootI18nService } from '@/shell/platform/services/i18n/i18n';
import {
  describeWorkspaceStatus,
  chordIndicator,
  localeIndicator,
  type StatusIndicator,
  type StatusTone,
  type WorkspaceStatusSnapshot,
  type WorkspaceStatusSource,
} from './status';
import type { ChordState } from './chords';
import { useChord, useLocale, usePanels, type ExtensionReader } from './usePanels';
import type { WhenContextStore } from './when-context-store';

/**
 * Подписывает компонент на итог по рабочей области.
 *
 * Тот же переходник `useSyncExternalStore`, что у контекста применимости и у настроек, и та же
 * оговорка: `get()` источника обязан возвращать стабильную ссылку между изменениями, иначе
 * React уходит в бесконечную перерисовку.
 */
function useWorkspaceStatus(source: WorkspaceStatusSource): WorkspaceStatusSnapshot {
  const subscribe = useCallback(
    (onStoreChange: () => void) => {
      const subscription = source.subscribe(onStoreChange);
      return () => {
        subscription.dispose();
      };
    },
    [source]
  );
  const getSnapshot = useCallback(() => source.get(), [source]);
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}

/**
 * Цвет ячейки по её значимости.
 *
 * Отдельной таблицей, а не условием в разметке: значимость приходит из правила (`./status`),
 * и набор её значений обязан быть перечислен один раз — иначе новый тон добавится в правило
 * и молча отрисуется цветом по умолчанию.
 */
const TONE_CLASS: Readonly<Record<StatusTone, string>> = {
  default: 'text-muted-foreground',
  accent: 'text-foreground',
  warning: 'text-amber-600 dark:text-amber-500',
  danger: 'text-destructive',
};

function IndicatorCell({
  indicator,
  text,
}: {
  indicator: StatusIndicator;
  text: string;
}): ReactElement {
  return (
    <span data-status-indicator={indicator.id} className={TONE_CLASS[indicator.tone]}>
      {text}
    </span>
  );
}

/** Платформа в объёме, который нужен строке состояния. */
export interface StatusBarProps {
  readonly extensions: ExtensionReader;
  readonly whenContext: WhenContextStore;
  readonly i18n: RootI18nService;
  readonly status: WorkspaceStatusSource;
  /**
   * Ожидание второй ступени аккорда. Без него ячейка не появляется вовсе — законная
   * сборка, а не поломка: аккорды это возможность оболочки, а не её обязанность.
   */
  readonly chords?: ChordState;
}

export function StatusBar({
  extensions,
  whenContext,
  i18n,
  status,
  chords,
}: StatusBarProps): ReactElement {
  const chord = useChord(chords);
  // Локаль здесь нужна и как повод перерисоваться, и как значение: она сама выводится
  // в строке состояния — это единственное место, где человек видит, на каком языке
  // работает инструмент.
  const locale = useLocale(i18n);
  const snapshot = useWorkspaceStatus(status);
  const panels = usePanels(extensions, whenContext, 'statusbar');

  // Ожидание аккорда идёт ПЕРВЫМ: пока оно есть, это самое важное в строке — приложение
  // ждёт от человека следующего нажатия, и он должен это видеть, не выискивая.
  const waiting = chordIndicator(chord.labels);
  const indicators = [
    ...(waiting === null ? [] : [waiting]),
    ...describeWorkspaceStatus(snapshot),
    localeIndicator(locale),
  ];

  return (
    <>
      {indicators.map((indicator) => (
        <IndicatorCell
          key={indicator.id}
          indicator={indicator}
          text={i18n.t(indicator.messageKey, indicator.params)}
        />
      ))}
      {panels.length > 0 && (
        <div className="flex flex-1 items-center justify-end gap-3">
          {panels.map((entry) => {
            const { Body, id } = entry.value;
            return <Body key={entry.id} panelId={id} />;
          })}
        </div>
      )}
    </>
  );
}
