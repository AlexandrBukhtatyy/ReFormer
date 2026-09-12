/**
 * Возможности → ответ «соберётся ли это приложение»: кто что даёт, чего не хватает, кто спорит.
 *
 * Резолвер чистый, как и сосед по каталогу (`./profile-resolver`): на входе объявления частей,
 * на выходе — разбор. Ни одной фабрики он не видит, ни одного плагина не грузит и ни одного
 * `activate` не зовёт. Из-за этого его можно спросить ДО того, как исполнится хоть строчка
 * чужого кода, — а в этом весь смысл: «плагину нужна служба, которой в этой сборке нет» обязано
 * выясняться до загрузки, а не исключением на середине активации.
 *
 * ## Почему отдельно от `profile-resolver`
 *
 * Тот отвечает «какие плагины входят в состав», этот — «хватает ли им друг друга». Вопросы
 * идут подряд и по одним данным, но ответы независимы: состав может быть корректным и
 * несобираемым (плагин просит возможность, которой никто не даёт), а несобираемый состав нельзя
 * исправить, дописав в профиль имя, — нужен другой провайдер.
 *
 * ## Отказ — это ДАННЫЕ, а не исключение
 *
 * `profile-resolver` на неизвестное имя бросает, а этот возвращает результат со списками.
 * Разница не в стиле, а в потребителе. Неизвестное имя плагина — опечатка в конфиге, и она
 * одна; невыполненное требование — это СПИСОК, который надо ПОКАЗАТЬ: в разделе «Плагины»
 * рядом с каждой строкой, по требованию на строку. Исключение здесь потеряло бы всё, кроме
 * первой найденной причины. Бросать или показывать — решает вызывающий: `composer/compose`
 * бросает (состав приложения обязан быть собираемым), каталог проектных плагинов показывает.
 *
 * ## Конфликт: двое на одну возможность
 *
 * Слот службы один (`primitives/service`), поэтому два провайдера одной возможности — это
 * не «выберем посильнее», а вопрос к человеку. Второй регистрирующий получил бы исключение
 * в `activate`, то есть отказ ПОСЛЕ загрузки обоих и с сообщением про токен, а не про состав.
 * Поэтому конфликт ловится здесь и называется по именам плагинов.
 *
 * Снять конфликт можно ВЫБОРОМ ({@link ResolveCapabilitiesOptions.chosen}). Несёт его поле
 * профиля `providers` — данные, как и список плагинов рядом; склеивает по цепочке `extends`
 * `resolveProviders`, подставляет сюда `composer/compose`. Осмысленность выбора (назван ли
 * тот, кто эту возможность объявляет) проверяет он же: резолвер обязан отвечать списками,
 * а не бросать, но профиль пишет человек — и его опечатка должна называться.
 *
 * @module application/resolver/capability-resolver
 */

import {
  meetsRequirement,
  type CapabilityDeclaration,
  type CapabilityProvider,
  type CapabilityRequirement,
} from '@/shell/platform/primitives/capability';

/**
 * Часть приложения глазами резолвера: имя плюс объявления.
 *
 * Одна форма и для встроенного плагина (запись карты состава), и для плагина каталога
 * (манифест). Разъехаться они не могут: поля те же, потому что вопрос тот же.
 */
export interface CapabilityPart {
  /** Идентификатор плагина. */
  readonly id: string;
  readonly provides?: readonly CapabilityDeclaration[];
  readonly requires?: {
    readonly required?: readonly CapabilityRequirement[];
    readonly optional?: readonly CapabilityRequirement[];
  };
}

/** Требование, которое нечем удовлетворить. */
export interface MissingCapability {
  /** Кто требует. */
  readonly by: string;
  readonly requirement: CapabilityRequirement;
  /**
   * Что на самом деле есть под этим идентификатором. Пусто — не даёт никто.
   *
   * Без этого списка сообщение «нужна reformer.kit.catalog@^2» не отвечает на первый же вопрос
   * человека: «а какая есть?». Ответ «1.0.0 от плагина reformer.kits» отличает «поставь новее»
   * от «поставь вообще».
   */
  readonly available: readonly CapabilityProvider[];
}

/** Возможность, которую объявили двое и больше, а выбор не сделан. */
export interface CapabilityConflict {
  readonly id: string;
  readonly providers: readonly CapabilityProvider[];
}

export interface CapabilityResolutionResult {
  /**
   * Кто что даёт — после применения выбора.
   *
   * Именно это уходит в каталог проектных плагинов как «что доступно за его пределами»:
   * список объявлений, а не реестр служб, потому что проверка идёт ДО активации, когда
   * в реестре ещё пусто.
   */
  readonly providers: readonly CapabilityProvider[];
  /** Обязательные требования, которые нечем удовлетворить. Пусто — состав собирается. */
  readonly missing: readonly MissingCapability[];
  /** Возможности с двумя и более провайдерами без сделанного выбора. */
  readonly conflicts: readonly CapabilityConflict[];
  /**
   * Необязательные требования, которые не выполнены, — НЕ отказ, а названная деградация.
   *
   * Отдельным списком, потому что показывать их надо иначе: это не «не соберётся»,
   * а «часть возможностей плагина будет недоступна». Пропусти мы их вовсе — деградация
   * перестала бы быть названной и стала бы просто тишиной.
   */
  readonly degraded: readonly MissingCapability[];
}

export interface ResolveCapabilitiesOptions {
  /** Части состава: встроенные из карты, проектные из манифестов. */
  readonly parts: readonly CapabilityPart[];
  /**
   * Выбор провайдера: идентификатор возможности → идентификатор плагина.
   *
   * Снимает конфликт и ОТБРАСЫВАЕТ остальных: невыбранный провайдер исчезает из `providers`
   * целиком, иначе выбор не значил бы ничего — требование всё равно удовлетворялось бы
   * отвергнутым. Выбор, называющий плагина, который эту возможность не объявляет, конфликт
   * не снимает: молчаливое «тогда оставим как есть» пряталось бы ровно до первого запуска.
   */
  readonly chosen?: Readonly<Record<string, string>>;
}

/**
 * Разбирает состав по возможностям.
 *
 * Порядок внутри `providers` — порядок частей: он ничего не значит для поведения (выбор
 * провайдера делается явно, а не «первым победил»), но делает вывод воспроизводимым.
 */
export function resolveCapabilities(
  options: ResolveCapabilitiesOptions
): CapabilityResolutionResult {
  const declared: CapabilityProvider[] = [];
  for (const part of options.parts) {
    for (const item of part.provides ?? []) {
      declared.push({ id: item.id, version: item.version, by: part.id });
    }
  }

  const byCapability = new Map<string, CapabilityProvider[]>();
  for (const provider of declared) {
    const list = byCapability.get(provider.id);
    if (list === undefined) byCapability.set(provider.id, [provider]);
    else list.push(provider);
  }

  const conflicts: CapabilityConflict[] = [];
  const providers: CapabilityProvider[] = [];
  for (const [id, candidates] of byCapability) {
    if (candidates.length === 1) {
      providers.push(candidates[0]);
      continue;
    }
    const chosenBy = options.chosen?.[id];
    const winner = candidates.find((candidate) => candidate.by === chosenBy);
    if (winner === undefined) {
      // Выбора нет или он называет не того — конфликт. Провайдеров при этом не оставляем
      // ни одного: «возьмём любого» сделало бы состав приложения зависимым от порядка карты,
      // а это ровно то свойство, которого мы избегаем везде.
      conflicts.push({ id, providers: [...candidates] });
      continue;
    }
    providers.push(winner);
  }

  const missing: MissingCapability[] = [];
  const degraded: MissingCapability[] = [];
  for (const part of options.parts) {
    const check = (requirement: CapabilityRequirement, into: MissingCapability[]): void => {
      // Себя провайдером не считаем: требовать собственную возможность значит удовлетворять
      // требование обещанием.
      const others = providers.filter((provider) => provider.by !== part.id);
      if (others.some((provider) => meetsRequirement(provider, requirement))) return;
      into.push({
        by: part.id,
        requirement,
        available: others.filter((provider) => provider.id === requirement.id),
      });
    };

    for (const requirement of part.requires?.required ?? []) check(requirement, missing);
    for (const requirement of part.requires?.optional ?? []) check(requirement, degraded);
  }

  return Object.freeze({
    providers: Object.freeze(providers),
    missing: Object.freeze(missing),
    conflicts: Object.freeze(conflicts),
    degraded: Object.freeze(degraded),
  });
}

/**
 * Разбор → текст для человека. Пустая строка означает «претензий нет».
 *
 * Здесь, а не у каждого потребителя: показывать это будут трое (сборка состава бросает
 * с этим текстом, список плагинов рисует строку, консоль пишет предупреждение), и три копии
 * формулировки разъехались бы на первой же правке.
 */
export function describeCapabilityProblems(result: CapabilityResolutionResult): string {
  const lines: string[] = [];
  for (const item of result.conflicts) {
    lines.push(
      `возможность «${item.id}» объявляют ${item.providers.map((p) => `«${p.by}»`).join(', ')}, ` +
        'а слот службы один. Выберите провайдера явно'
    );
  }
  for (const item of result.missing) {
    const actual =
      item.available.length === 0
        ? 'её не предоставляет никто'
        : `доступно: ${item.available.map((p) => `${p.version} (плагин «${p.by}»)`).join(', ')}`;
    lines.push(
      `плагину «${item.by}» нужна возможность «${item.requirement.id}» ` +
        `версии ${item.requirement.range} — ${actual}`
    );
  }
  return lines.join('; ');
}
