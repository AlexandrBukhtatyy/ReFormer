/**
 * Палитра команд — всё, что в ней является правилом, а не отрисовкой.
 *
 * Реестр команд без палитры остаётся служебным механизмом: команды есть, а вызвать их
 * человеку нечем. Палитра делает его сразу полезным и стоит немного — список, фильтр,
 * `enabled(ctx)`, `titleKey` через `t()`. Она же общая поверхность с ассистентом: то, что
 * вызывается из палитры, ассистент вызывает **той же** командой через тот же `execute`.
 *
 * ## Одного реестра команд мало
 *
 * «Открыть форму» — это не команда, а список форм, известный только в рантайме. Поэтому
 * палитра принимает поставщиков пунктов ({@link PaletteItemsPoint}), и из этого следуют два
 * правила, без которых палитра станет источником тормозов:
 *
 * - **Статические команды показываются сразу, динамические доливаются.** Медленный поставщик
 *   не имеет права задерживать открытие палитры — поэтому статическая часть считается
 *   синхронно ({@link commandPaletteItems}), а динамическая приходит отдельно и позже
 *   ({@link createPaletteQueryRunner}).
 * - **Запросы отменяемы и с задержкой.** Ввод символа не должен рождать обращение к источнику
 *   на каждое нажатие.
 *
 * ## Готовая строка рядом с ключом
 *
 * {@link PaletteItem} принимает и `titleKey`, и `title`. Это намеренное послабление, а не
 * недосмотр: имена файлов и форм не переводятся, и заставлять их проходить через словарь
 * значило бы регистрировать сообщение на каждый файл проекта.
 *
 * ## Что здесь и чего здесь нет
 *
 * Есть: слияние, фильтрация, упорядочивание, отмена устаревшего запроса. Нет: React, DOM,
 * i18n-сервиса. Перевод приходит функцией `translate`, потому что окружение тестов — `node`,
 * а правило «пункт с `title` не переводится» проверяется без словаря.
 *
 * @module host/ui/palette
 */

import type { CommandContribution } from '@/shell/platform/primitives/command';
import type { Disposable } from '@/shell/platform/primitives/disposable';
import { defineExtensionPoint } from '@/shell/platform/primitives/extension-point';
import type { WhenContext } from '@/shell/platform/primitives/when-context';

/**
 * Пункт палитры.
 *
 * `titleKey` **либо** `title`: первое — для того, что переводится, второе — для динамических
 * данных. Указаны оба — выигрывает `title`: готовая строка уже содержит то, что человек
 * ожидает увидеть, а ключ рядом с ней означает, что вносящий не решил, и молча предпочесть
 * перевод значило бы показать не тот текст.
 */
export interface PaletteItem {
  /** Уникален в пределах палитры. Служит React-ключом и адресом при слиянии. */
  readonly id: string;
  /** Ключ i18n — либо он… */
  readonly titleKey?: string;
  /** …либо готовая строка для динамических данных (имя файла). */
  readonly title?: string;
  /** Пояснение справа: путь, раздел, сочетание клавиш. Участвует в поиске. */
  readonly detail?: string;
  readonly run: () => unknown | Promise<unknown>;
  /** Меньше — выше. По умолчанию `0`. */
  readonly order?: number;
}

/**
 * Поставщик динамических пунктов.
 *
 * `provide` получает запрос и контекст и вправе отвечать асинхронно. Отмены в сигнатуре нет
 * намеренно: поставщик не обязан уметь прерываться, а устаревший ответ отбрасывает вызывающий
 * (см. {@link createPaletteQueryRunner}). Требовать `AbortSignal` от каждого поставщика значило
 * бы усложнить простой случай ради того, что и так решается на стороне палитры.
 */
export interface PaletteItemProvider {
  readonly id: string;
  provide(query: string, ctx: WhenContext): PaletteItem[] | Promise<PaletteItem[]>;
}

/** Точка расширения динамических пунктов палитры. */
export const PaletteItemsPoint = defineExtensionPoint<PaletteItemProvider>('palette.items');

/**
 * Пункт, готовый к показу: заголовок уже строка, порядок уже число.
 *
 * Разрешение вынесено из отрисовки, потому что по заголовку идёт **поиск**: фильтровать
 * по `titleKey` значило бы искать по идентификаторам сообщений, а не по тому, что человек
 * видит на экране.
 */
export interface ResolvedPaletteItem {
  readonly id: string;
  readonly title: string;
  readonly detail?: string;
  readonly order: number;
  readonly run: () => unknown | Promise<unknown>;
}

/** Перевод ключа. Функция, а не сервис: правилу нужен результат, а не источник. */
/**
 * Перевод ключа. Второй параметр — владелец ключа, если он известен.
 *
 * Он нужен потому, что ключ сам по себе не говорит, в чьём словаре его искать: `титул`
 * команды плагина лежит в пространстве имён этого плагина, а команды оболочки — в словаре
 * Host. Без владельца палитра разрешала бы всё словарём Host и показывала бы маркер промаха
 * на каждой команде плагина.
 */
export type TranslateKey = (key: string, owner?: { readonly pluginId?: string }) => string;

/**
 * Приводит пункт к готовому виду.
 *
 * Нет ни `title`, ни `titleKey` — заголовком становится идентификатор. Пустая строка была бы
 * хуже: пункт остался бы в списке, но кликать было бы не по чему, и найти виновника
 * пришлось бы чтением всех поставщиков сразу.
 */
export function resolvePaletteItem(
  item: PaletteItem,
  translate: TranslateKey
): ResolvedPaletteItem {
  const title = item.title ?? (item.titleKey === undefined ? item.id : translate(item.titleKey));
  return {
    id: item.id,
    title,
    detail: item.detail,
    order: item.order ?? 0,
    run: item.run,
  };
}

/** Как строится подпись команды справа. Обычно — её сочетание клавиш. */
export interface CommandItemsOptions {
  readonly translate: TranslateKey;
  /** Запуск команды. Всегда через реестр — общая дверь с ассистентом. */
  readonly execute: (commandId: string) => unknown | Promise<unknown>;
  /** Подпись справа. Отсутствие означает «без подписи». */
  readonly detail?: (command: CommandContribution) => string | undefined;
  /** Куда сообщать об упавшем предикате `enabled`. */
  readonly onError?: (error: unknown, commandId: string) => void;
}

/**
 * Статическая часть палитры: команды реестра, применимые в текущем контексте.
 *
 * Неприменимые не показываются, а не показываются серыми. Причина не косметическая: палитра
 * ищется набором, и строка, которая находится, но не запускается, обучает человека неверному —
 * он запоминает, что команда «не работает», вместо того чтобы понять, что она сейчас неуместна.
 *
 * Упавший предикат считается запретом — та же политика, что в реестре и в диспетчере.
 */
export function commandPaletteItems(
  commands: readonly CommandContribution[],
  ctx: WhenContext,
  options: CommandItemsOptions
): readonly ResolvedPaletteItem[] {
  const items: ResolvedPaletteItem[] = [];
  for (const command of commands) {
    if (command.enabled !== undefined) {
      let enabled: boolean;
      try {
        enabled = command.enabled(ctx) === true;
      } catch (error) {
        options.onError?.(error, command.id);
        enabled = false;
      }
      if (!enabled) continue;
    }
    items.push({
      id: command.id,
      title: options.translate(command.titleKey, command),
      detail: options.detail?.(command),
      order: 0,
      run: () => options.execute(command.id),
    });
  }
  return items;
}

/**
 * Сливает статическую часть с динамической. При совпадении идентификаторов побеждает первая.
 *
 * Порядок аргументов и есть правило: команда реестра — то, за что отвечает Host, а поставщик
 * пунктов может отдать что угодно, в том числе по ошибке повторить идентификатор команды.
 * Молчаливая подмена команды пунктом из внешнего источника — не то, что должно случаться
 * от опечатки.
 */
export function mergePaletteItems(
  staticItems: readonly ResolvedPaletteItem[],
  dynamicItems: readonly ResolvedPaletteItem[]
): readonly ResolvedPaletteItem[] {
  const seen = new Set<string>();
  const merged: ResolvedPaletteItem[] = [];
  for (const item of [...staticItems, ...dynamicItems]) {
    if (seen.has(item.id)) continue;
    seen.add(item.id);
    merged.push(item);
  }
  return merged;
}

/**
 * Разряды совпадения. Меньше — выше в списке.
 *
 * Разряд, а не «очки»: три различимых случая («начинается с запроса», «содержит запрос»,
 * «нашлось только в пояснении») человек воспринимает как порядок, а непрерывная оценка
 * от неё неотличима, зато невоспроизводима глазом и не проверяется тестом.
 */
const RANK_TITLE_PREFIX = 0;
const RANK_TITLE_MATCH = 1;
const RANK_DETAIL_MATCH = 2;
const RANK_NONE = -1;

function normalizeForSearch(value: string): string {
  return value.trim().toLowerCase();
}

/**
 * Разбивает запрос на слова.
 *
 * Слова ищутся по «и», а не по «или»: `сохр всё` обязано находить «Сохранить всё», а не
 * всё, где встретилось «всё». Порядок слов при этом не важен — человек не помнит, как
 * называется команда, он помнит два слова из неё.
 */
export function queryTokens(query: string): readonly string[] {
  return normalizeForSearch(query)
    .split(/\s+/u)
    .filter((token) => token !== '');
}

/**
 * Разряд совпадения пункта с запросом или {@link RANK_NONE}, если не совпал.
 *
 * Совпадение — подстрока, а не подпоследовательность. Нечёткий поиск выдаёт «Удалить проект»
 * на запрос `дп`, и объяснить человеку, почему оно там, невозможно; подстрока предсказуема
 * и проверяется тестом, а не глазом.
 */
export function matchRank(item: ResolvedPaletteItem, query: string): number {
  const tokens = queryTokens(query);
  if (tokens.length === 0) return RANK_TITLE_PREFIX;

  const title = normalizeForSearch(item.title);
  const detail = item.detail === undefined ? '' : normalizeForSearch(item.detail);
  const haystack = detail === '' ? title : `${title} ${detail}`;

  if (!tokens.every((token) => haystack.includes(token))) return RANK_NONE;
  if (!tokens.every((token) => title.includes(token))) return RANK_DETAIL_MATCH;
  return title.startsWith(tokens[0]) ? RANK_TITLE_PREFIX : RANK_TITLE_MATCH;
}

/**
 * Отбирает и упорядочивает пункты под запрос.
 *
 * Порядок: разряд совпадения, затем `order` пункта, затем заголовок по алфавиту локали.
 * Последняя ступень существует ради устойчивости: без неё пункты с равными разрядом
 * и порядком выстраивались бы так, как их вернули поставщики, то есть по-разному от запроса
 * к запросу, и стрелка вниз попадала бы каждый раз в другое.
 *
 * `locale` влияет только на сравнение строк; отбор от неё не зависит.
 */
export function filterPaletteItems(
  items: readonly ResolvedPaletteItem[],
  query: string,
  locale?: string
): readonly ResolvedPaletteItem[] {
  const ranked: { readonly item: ResolvedPaletteItem; readonly rank: number }[] = [];
  for (const item of items) {
    const rank = matchRank(item, query);
    if (rank !== RANK_NONE) ranked.push({ item, rank });
  }
  ranked.sort((a, b) => {
    if (a.rank !== b.rank) return a.rank - b.rank;
    if (a.item.order !== b.item.order) return a.item.order - b.item.order;
    return a.item.title.localeCompare(b.item.title, locale);
  });
  return ranked.map((entry) => entry.item);
}

/** Дескриптор таймера. Непрозрачен: в браузере это число, в `node` — объект. */
export type TimerHandle = unknown;

export interface PaletteQueryRunnerOptions {
  /**
   * Задержка перед обращением к поставщикам, мс.
   *
   * Не «оптимизация ощущений»: поставщик может ходить в источник, а набор запроса из шести
   * символов породил бы шесть обращений, из которых нужно последнее. Значение по умолчанию —
   * ниже порога, на котором задержка замечается, и выше длительности одного нажатия.
   */
  readonly delayMs?: number;
  readonly schedule?: (fn: () => void, ms: number) => TimerHandle;
  readonly cancelScheduled?: (handle: TimerHandle) => void;
  /** Отказавший поставщик не роняет палитру, но и не исчезает бесследно. */
  readonly onError?: (error: unknown, providerId: string) => void;
}

/** Задержка по умолчанию. */
const DEFAULT_DELAY_MS = 120;

export interface PaletteQueryRunner extends Disposable {
  /** Планирует запрос. Предыдущий, ещё не доставленный, отменяется. */
  request(providers: readonly PaletteItemProvider[], query: string, ctx: WhenContext): void;
  /** Отменяет запланированное и делает уже начатое неактуальным. */
  cancel(): void;
}

/**
 * Опрашивает поставщиков с задержкой и отменой устаревшего.
 *
 * Отмена — по номеру запроса, а не по прерыванию работы поставщика: `provide` не обязан
 * уметь прерываться, а результат, пришедший на предыдущий запрос, всё равно нельзя показывать.
 * Номер растёт при каждом новом запросе и при {@link PaletteQueryRunner.cancel}, поэтому
 * «ответ пришёл после того, как палитру закрыли» и «ответ пришёл после следующего запроса» —
 * один и тот же случай, обработанный одной проверкой.
 *
 * Пустой набор поставщиков доставляется **синхронно и пустым**: иначе закрытие палитры
 * оставляло бы динамическую часть от прошлого открытия.
 *
 * Планировщик принимается параметром, потому что окружение тестов — `node`, и проверять
 * задержку настоящими таймерами значило бы платить за каждый прогон её длительностью.
 */
export function createPaletteQueryRunner(
  deliver: (items: readonly PaletteItem[]) => void,
  options: PaletteQueryRunnerOptions = {}
): PaletteQueryRunner {
  const delayMs = options.delayMs ?? DEFAULT_DELAY_MS;
  const schedule = options.schedule ?? ((fn, ms): TimerHandle => setTimeout(fn, ms));
  const cancelScheduled =
    options.cancelScheduled ??
    ((handle: TimerHandle): void => {
      clearTimeout(handle as ReturnType<typeof setTimeout>);
    });

  let seq = 0;
  let pending: TimerHandle | null = null;

  const cancel = (): void => {
    seq += 1;
    if (pending !== null) {
      cancelScheduled(pending);
      pending = null;
    }
  };

  return {
    request(providers, query, ctx): void {
      cancel();
      if (providers.length === 0) {
        deliver([]);
        return;
      }

      const token = seq;
      pending = schedule(() => {
        pending = null;
        const lists = providers.map(async (provider) => {
          try {
            return await provider.provide(query, ctx);
          } catch (error) {
            options.onError?.(error, provider.id);
            return [];
          }
        });
        void Promise.all(lists).then((resolved) => {
          // Запрос устарел: пришёл следующий или палитру закрыли. Показывать нельзя.
          if (token !== seq) return;
          deliver(resolved.flat());
        });
      }, delayMs);
    },

    cancel,

    dispose(): void {
      cancel();
    },
  };
}
