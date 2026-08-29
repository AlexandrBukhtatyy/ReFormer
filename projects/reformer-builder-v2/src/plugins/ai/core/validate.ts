/**
 * Строгий гейт валидации выхода агента: обёртка над `validateFormSchema`
 * (`@reformer/renderer-json/validate`, синхронно). Даёт структурную проверку (ajv) + валидацию
 * `componentProps` против props-схем каталога.
 *
 * ## Почему у плагина своя обёртка, а не общая
 *
 * В v1 это был `io/validate.validateSchema` — общий гейт для ручного сохранения, экспорта и
 * агента. В v2 такого слоя нет и не должно быть: проверка схемы формы — предметное знание, и
 * живёт она вкладом в точку расширения валидаторов (`plugins/validator-schema/`). Импортировать
 * её отсюда нельзя — плагины не видят друг друга, — а дублировать целиком незачем: агенту нужен
 * не тот же гейт, а СТРОГИЙ ЕГО РЕЖИМ, которого у ручного сохранения нет вовсе.
 *
 * ## Строгий режим — про машинный вход
 *
 * Мягкая проверка берёт список законных имён компонентов из САМОЙ проверяемой схемы: выдуманное
 * имя проверяет себя же и проходит молча. Для человека это верно (он пишет имена своего проекта),
 * для модели — дыра, ради закрытия которой гейт и существует.
 *
 * Но целиком отбросить имена из схемы нельзя: project-specific компоненты (`RendererFormWizard`
 * из реестра конкретного проекта) законны, а каталогу билдера неизвестны — строгая проверка
 * «только каталог» отвергала бы валидные пользовательские формы. Поэтому источником имён-исключений
 * становится не проверяемая схема, а {@link ValidateOptions.baseline}: то, что у пользователя УЖЕ
 * было. Агент не может протащить новое выдуманное имя, а существующие компоненты продолжают
 * работать.
 *
 * `$dataSource`/`$fn`/`$locale` строгим режимом НЕ покрываются: их имена в standalone знать
 * неоткуда ни в каком режиме, и мягкость там — не дыра, а единственно возможное поведение.
 *
 * ## Чего здесь нет по сравнению с v1
 *
 * Структурного линта (`io/structure-lint`: вкладка без панели, шаг не-контейнером). Его место в
 * v2 — диагностика валидатора схемы, то есть чужой плагин; ассистент получит эти замечания через
 * оркестратор валидации, когда появится мост. До тех пор {@link ValidationResult.warnings}
 * наполняются только осиротевшими правилами — их считает домен, и они доступны честно.
 *
 * ## Сама проверка приходит ПАРАМЕТРОМ, а не импортом
 *
 * `validateFormSchema` живёт в `@reformer/renderer-json/validate` и стоит 120,93 кБ raw /
 * 37,88 кБ gzip. Статический импорт здесь возвращал этот вес в ГЛАВНЫЙ чанк: `renderer-json`
 * и валидатор схемы заказывают тот же модуль динамически, но rollup не может вынести в
 * отдельный чанк то, на что есть хоть одна статическая ссылка, — измерено сборкой, и vite
 * говорит об этом прямым предупреждением. Пока ассистент не был в композиции, ссылка ничего
 * не стоила; с его регистрацией отдельный чанк `validate` исчез.
 *
 * Поэтому функция приходит {@link ValidateOptions.validateForm} — тем же приёмом, что и
 * каталог, и по той же причине: «когда её грузить» — решение владельца, а не проверки.
 * Владелец здесь — плагин ассистента: он заказывает загрузку при активации
 * (`plugin.createValidateFormLoader`), а мост дожидается её перед ходом и перед применением.
 *
 * Поле ОБЯЗАТЕЛЬНОЕ, в отличие от `validateSchema?` у валидатора схемы, и разница не
 * стилистическая. Там отсутствие проверки означает «находок этих фаз не будет» — честная
 * неполнота диагностики. Здесь этот же гейт стоит БАРЬЕРОМ перед записью выхода модели в
 * буфер (`../apply`), и необязательное поле означало бы «барьер молча пропустил всё» —
 * отказ, неотличимый от успеха. Компилятор обязан требовать проверку у каждого, кто её зовёт.
 *
 * Модульного синглтона (`let impl; provideValidator(fn)`) здесь нет намеренно: в v1 таким
 * синглтоном был каталог, и это признано дефектом — порядок активации начинал влиять на
 * поведение, а тесты становились зависимыми от порядка запуска.
 *
 * @module plugins/ai/core/validate
 */

import type { JsonFormSchema } from '@reformer/renderer-json';
import type { validateFormSchema } from '@reformer/renderer-json/validate';
import type { PropsSchema } from '@reformer/ui-kit/meta';
import type { CatalogEntry } from '@/lib/catalog/types';
import { collectOperatorNames } from '@/lib/form-model/query';
import { ruleWarnings } from '@/lib/form-model/rules-integrity';
import type { FormRules } from '@/lib/form-model/rules';

/**
 * Имена, которые схема вправе называть помимо каталога: враппер поля, граница async и `List` —
 * обёртка display-списка, которой схемы адресуют array-узлы.
 *
 * Это КЛЮЧИ РЕЕСТРА рендерера, а не имена экспортов кита, поэтому они не меняются со сменой кита
 * и списком здесь законны. В каталог палитры они не входят намеренно: вставлять инфраструктурные
 * обёртки агент не должен, а встретить их в чужой схеме — может.
 */
const INFRA_NAMES: readonly string[] = ['FormField', 'AsyncBoundary', 'List'];

/**
 * Проверка схемы по мета-схеме form-DSL — то, что гейт получает параметром.
 *
 * Тип берётся у самой функции (`typeof`), а не переписывается: две копии одной сигнатуры
 * разъехались бы на первом же её изменении, а импорт ТИПА стирается на сборке — значит стоит
 * ноль байт и не тянет за собой ни модуль, ни ajv.
 */
export type ValidateFormSchema = typeof validateFormSchema;

/**
 * Заказ загрузки проверки. Обязан быть идемпотентным: его зовут на каждый ход и на каждое
 * применение, а грузить модуль второй раз незачем.
 */
export type LoadValidateForm = () => Promise<ValidateFormSchema>;

/** Результат валидации. */
export interface ValidationResult {
  valid: boolean;
  errors: string[];
  /**
   * Замечания, не влияющие на `valid`: правило, указывающее в никуда (на удалённое поле или
   * несуществующий селектор). В рантайме такое правило не делает ничего и молча — узнать о нём
   * иначе негде, поэтому оно сообщается, но правку не блокирует.
   */
  warnings: string[];
}

/** Опции гейта. */
export interface ValidateOptions {
  /** Каталог активного кита: props-схемы и словарь законных имён. */
  catalog: readonly CatalogEntry[];
  /**
   * Схема, которая была у пользователя ДО правки. Её имена компонентов считаются законными наравне
   * с каталогом — см. заметку о строгом режиме в шапке модуля. Без неё законен только каталог, и
   * это случай генерации с нуля.
   */
  baseline?: JsonFormSchema;
  /** Правила формы — чтобы заодно сказать об осиротевших. */
  rules?: FormRules;
  /**
   * Проверка по мета-схеме form-DSL. Обязательна — см. «Сама проверка приходит ПАРАМЕТРОМ»
   * в шапке модуля: этот гейт стоит барьером перед записью, и молча пропускающего барьера
   * быть не должно.
   */
  validateForm: ValidateFormSchema;
}

/**
 * Карта «имя → props-схема» для проверки `componentProps`.
 *
 * Берётся из КАТАЛОГА (у field-записей `propsSchema` — враппер вместе с вариантом), иначе сырой
 * вариант не знает про `label`/`required` и валидатор ложно ругается «unknown property label».
 *
 * Кэш по ссылке на каталог: каталог собирается один раз на кит, а `Object.fromEntries` по трёмстам
 * записям на каждой правке пакета — заметная доля стоимости гейта.
 */
const propSchemasCache = new WeakMap<object, Record<string, PropsSchema>>();

function catalogPropSchemas(catalog: readonly CatalogEntry[]): Record<string, PropsSchema> {
  const known = propSchemasCache.get(catalog);
  if (known !== undefined) return known;
  const built = Object.fromEntries(catalog.map((e) => [e.name, e.propsSchema]));
  propSchemasCache.set(catalog, built);
  return built;
}

/** Провалидировать схему, полученную от модели. */
export function validateSchema(schema: JsonFormSchema, opts: ValidateOptions): ValidationResult {
  const ops = collectOperatorNames(schema);
  const allowedFromBaseline = opts.baseline ? collectOperatorNames(opts.baseline).components : [];
  const result = opts.validateForm(schema, {
    componentNames: [
      ...new Set([...allowedFromBaseline, ...opts.catalog.map((e) => e.name), ...INFRA_NAMES]),
    ],
    dataSourceNames: ops.dataSources,
    fnNames: ops.fns,
    localeKeys: ops.locales,
    propSchemas: catalogPropSchemas(opts.catalog),
  });
  return {
    valid: result.valid,
    errors: result.errors,
    warnings: opts.rules ? ruleWarnings(schema, opts.rules) : [],
  };
}
