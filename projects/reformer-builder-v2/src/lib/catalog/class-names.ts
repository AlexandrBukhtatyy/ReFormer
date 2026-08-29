/**
 * Словарь CSS-классов активного кита для редактора `className` в инспекторе.
 *
 * Источник — блок `kit.styles.classNames` каталога (см. `@reformer/ui-kit`
 * `src/styles/class-catalog.ts`). Своего списка билдер НЕ держит: имена семантических токенов
 * (`bg-muted`, `text-foreground`) знает только дизайн-система, а для кита со `styles.mode:
 * 'standalone'` Tailwind-подсказки были бы просто неверны. Кит словаря не прислал — подсказок нет,
 * поле остаётся обычным свободным вводом.
 *
 * Кит может ограничить, ЧЕМ разрешено стилизовать конкретный компонент (`classGroups` записи или
 * `classGroupsByRole`): типовой случай — полю формы доступны только отступы, потому что его вид
 * задаёт дизайн-система. Разрешение уже посчитано в `lib/kits/descriptor` и лежит в
 * `KitDescriptor.classGroupPolicy`.
 *
 * ЧТО ИЗМЕНИЛОСЬ ПРОТИВ v1. Там дескриптор брался из `kits/active` — module-level состояния,
 * которое клала сборка каталога. Из-за этого функции приходилось начинать с холостого вызова
 * `getCatalog()` («прогреть, чтобы под нами лежал настоящий дескриптор, а не фолбэк»), а мемо
 * жило в одной глобальной Map и требовало `resetClassNamesCache()` при подмене кита.
 *
 * Здесь дескриптор — ПАРАМЕТР. Прогрев не нужен (нечего ждать), сброса тоже: мемо привязано к
 * самому дескриптору через `WeakMap`, поэтому у разных китов кэши разные по построению и
 * рассинхронизироваться не могут.
 *
 * @module reformer-builder/lib/catalog/class-names
 */

import type { KitDescriptor } from '../kits/types';

/**
 * Мемо, привязанное к дескриптору: словарь и политика внутри одного дескриптора неизменны, а
 * смена кита даёт новый объект — и, значит, новый кэш. `WeakMap` не держит дескриптор живым.
 */
const cache = new WeakMap<KitDescriptor, Map<string, string[]>>();

/**
 * Ключ мемо для словаря БЕЗ сужения политикой ({@link knownClassNames}). Скобки делают его
 * недостижимым для имени компонента — те приходят из каталога и скобок не содержат.
 */
const ALL_CLASSES_KEY = '(all)';

/** Мемо-таблица дескриптора (заводится при первом обращении). */
function cacheFor(descriptor: KitDescriptor): Map<string, string[]> {
  let map = cache.get(descriptor);
  if (!map) {
    map = new Map();
    cache.set(descriptor, map);
  }
  return map;
}

/**
 * Классы, которыми кит разрешает стилизовать компонент: плоский список в курируемом порядке групп,
 * дубли между группами схлопнуты (класс — React-ключ в выпадашке).
 *
 * Пустой список означает «подсказывать нечего» — и когда кит словаря не прислал, и когда он явно
 * запретил все группы (`classGroups: []`). Для поля это одно и то же: оно остаётся свободным вводом.
 */
export function classNamesFor(descriptor: KitDescriptor, componentName: string): string[] {
  const memo = cacheFor(descriptor);
  const hit = memo.get(componentName);
  if (hit) return hit;

  const { styles, classGroupPolicy } = descriptor;
  const allowed = classGroupPolicy.get(componentName);
  const groups = allowed ? styles.classNames.filter((g) => allowed.has(g.id)) : styles.classNames;

  const flat = Array.from(new Set(groups.flatMap((g) => g.classes)));
  memo.set(componentName, flat);
  return flat;
}

/**
 * ВЕСЬ словарь активного кита, без сужения политикой групп — «что кит вообще умеет отрисовать».
 *
 * Отличие от {@link classNamesFor} существенно: та отвечает на вопрос «что ПРЕДЛАГАТЬ для этого
 * компонента» (полю формы — только отступы), а этот — «какие классы точно попадут в CSS». Словарь
 * уезжает в safelist сборки (`scripts/gen-kit-safelist.mjs`), поэтому он же и есть список
 * гарантированно живых классов; всё вне его Tailwind сгенерирует, только если встретил в коде.
 *
 * Пустой список = кит словаря не прислал; тогда проверять нечего (см. {@link unknownClasses}).
 */
export function knownClassNames(descriptor: KitDescriptor): string[] {
  const memo = cacheFor(descriptor);
  const hit = memo.get(ALL_CLASSES_KEY);
  if (hit) return hit;

  const flat = Array.from(new Set(descriptor.styles.classNames.flatMap((g) => g.classes)));
  memo.set(ALL_CLASSES_KEY, flat);
  return flat;
}

/**
 * Классы значения, которых нет в словаре кита — кандидаты «не отрисуется в превью». Порядок
 * сохраняется, дубли схлопнуты.
 *
 * Это ПОДСКАЗКА, а не запрет: класс вне словаря работает, если встречается в исходниках билдера
 * или кита (`sm:max-w-lg` из компонентов кита — рабочий), а произвольные значения
 * (`grid-cols-[1fr_2fr]`) словарём не покрываются в принципе. Поэтому формулировка в UI —
 * «может не отрисоваться», и ввод остаётся свободным.
 *
 * Пустой словарь (кит его не прислал) отключает проверку целиком: иначе инспектор пометил бы
 * подозрительным вообще всё.
 */
export function unknownClasses(all: readonly string[], value: string): string[] {
  if (!all.length) return [];
  const known = new Set(all);
  return Array.from(new Set(value.split(/\s+/).filter(Boolean))).filter((t) => !known.has(t));
}

/**
 * Подсказки по токену под кареткой: подстрочный фильтр минус уже использованные классы.
 * Пустой токен списка не даёт — иначе выпадашка открывалась бы на каждый фокус пустого поля.
 *
 * Вынесено из компонента, чтобы поведение покрывалось node-тестом (jsdom в билдере не настроен).
 */
export function suggestClasses(
  all: readonly string[],
  token: string,
  used: ReadonlySet<string>,
  limit: number
): string[] {
  const needle = token.toLowerCase();
  if (!needle) return [];
  const out: string[] = [];
  for (const c of all) {
    // `c === token` оставляет в списке класс, который пользователь дописывает прямо сейчас.
    if (c.toLowerCase().includes(needle) && (c === token || !used.has(c))) out.push(c);
    if (out.length === limit) break;
  }
  return out;
}
