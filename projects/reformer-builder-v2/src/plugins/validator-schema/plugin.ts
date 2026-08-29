/**
 * Плагин «валидатор схемы формы»: вклад в точку расширения валидаторов.
 *
 * **Почему это плагин, а не часть Host.** Разбор и проверка схемы формы — предметное знание:
 * что такое `$component`, чем шаг отличается от вкладки, какие пропсы у поля. В платформе оно
 * означало бы, что второй формат (или второй продукт поверх той же платформы) вносится правкой
 * ядра. Граница проверяется линтером: `src/plugins/**` не видит `@/host/*` — только `@/sdk`
 * и `@/lib`.
 *
 * ## Уровень только быстрый
 *
 * `validateAsync` здесь нет, и это не задел на будущее, а факт: вся проверка — синхронный
 * обход дерева и ajv, и на ней стоит гейт ассистента. Дорогой уровень наполнится проверкой
 * типов — она станет первым потребителем пула воркеров, и придёт своим плагином.
 *
 * ## Мета-схема грузится по требованию, а уровень остаётся быстрым
 *
 * `@reformer/renderer-json/validate` — 127 кБ raw / 40 кБ gzip в главном чанке, и платили за них
 * все, включая тех, кто ни одной формы не открыл. Здесь модуль заказывается динамически:
 * при активации плагина и повторно при первом же подходящем документе (`applies`).
 *
 * `validate` при этом ОСТАЁТСЯ СИНХРОННОЙ — контракт точки расширения этого требует, и обойти
 * его `validateAsync`-ом было бы хуже, а не лучше: находки ушли бы вторым источником и под
 * другим именем. Цена названа честно: пока модуль в пути, проход не даёт находок мета-схемы.
 * Окно между активацией плагина и открытием первого документа человеком заведомо длиннее
 * одного динамического импорта, но нулём оно не становится, и притворяться иначе нечем.
 *
 * ## Каталог и правила — параметры, а не импорты
 *
 * Каталог активного кита — состояние приложения (кит переключают), а правила формы живут
 * САЙДКАРОМ: `JsonFormSchema` — закрытый контракт рендерера, положить их внутрь нельзя.
 * `ValidateContext` описывает ОДИН документ и способа прочитать соседний ресурс не даёт,
 * поэтому сайдкар приходит функцией от документа. Это ограничение контракта, а не решение:
 * пока валидатор не умеет читать соседей, склеивать схему с правилами обязан тот, кто их
 * и так держит.
 *
 * @module plugins/validator-schema/plugin
 */

import type { CatalogEntry } from '@/lib/catalog/types';
import type { FormRules } from '@/lib/form-model/rules';
import {
  definePlugin,
  withUsableFixes,
  ValidatorPoint,
  type CommandLookup,
  type DocumentRef,
  type Plugin,
  type QuickFix,
  type ValidatorContribution,
} from '@/sdk';
import { checkForm, type ValidateFormSchema } from './check';
import { SCHEMA_VALIDATOR_ID } from './codes';

/** Идентификатор плагина: пространство имён во всех реестрах. */
export const SCHEMA_VALIDATOR_PLUGIN_ID = 'validator-schema';

export interface SchemaValidatorOptions {
  /**
   * Каталог активного кита. Функция, а не список: кит переключают, и валидатор обязан
   * сравнивать с тем каталогом, который действует СЕЙЧАС, а не с тем, что был на активации.
   */
  readonly catalog: () => readonly CatalogEntry[];
  /** Правила-сайдкар документа, если тот, кто их держит, может их отдать. */
  readonly rules?: (doc: DocumentRef) => FormRules | undefined;
  /** Чем сузить круг документов. По умолчанию — {@link isFormSchemaDocument}. */
  readonly applies?: (doc: DocumentRef) => boolean;
  /**
   * Зарегистрирована ли команда — по ней отбираются быстрые исправления (`@/sdk`.`usableFixes`).
   *
   * **Спрашивается на каждом проходе, а не на активации.** Проход идёт по каждой правке
   * текста, то есть заведомо позже подъёма плагинов, и ответ на нём верен; проверка же на
   * активации сделала бы поведение зависящим от порядка активации плагинов, который объявлен
   * незначимым и закреплён тестом (правило приёмки Э4): валидатор вправе подняться раньше
   * редактора, владеющего командой правки.
   *
   * Необязателен: без реестра команд сверять не с чем, и проход отдаёт исправления как есть —
   * ровно то, что было до этой проверки. Плагин ({@link createSchemaValidatorPlugin}) передаёт
   * его всегда.
   */
  readonly hasCommand?: CommandLookup;
}

/**
 * Умолчание для `applies`: модельный документ с JSON-медиатипом.
 *
 * Самая узкая проверка, доступная синхронно по одному {@link DocumentRef}. Вид `'model'`
 * означает, что за документ ВЗЯЛСЯ провайдер модели, а провайдер схемы формы берётся ровно
 * за схемы формы — он читает содержимое пробой, чего валидатору нельзя. Проверка по одному
 * расширению отдала бы валидатору весь `package.json` в рабочей области.
 */
export function isFormSchemaDocument(doc: DocumentRef): boolean {
  return doc.kind === 'model' && doc.ref.mediaType === 'application/json';
}

/**
 * Отложенная проверка по мета-схеме: держатель одной загрузки и её результата.
 *
 * Состояние живёт в объекте, а НЕ на уровне модуля. Модульный кэш здесь означал бы, что два
 * вклада (тест и приложение, два окна) делят одну ячейку, и порядок тестов начинает влиять
 * на их результат — ровно та болезнь, от которой в v2 избавлен кэш каталога кита.
 *
 * Отказ загрузки не отвергается наружу: пустая ячейка — состояние с определённым поведением
 * (находок мета-схемы нет), а исключение в `applies` уронило бы проход целиком. Повтор при
 * этом не заводится: `applies` зовут на каждый документ, и повторять сорвавшийся запрос
 * с такой частотой значило бы стучаться в сеть без конца.
 */
export interface DeferredSchemaCheck {
  /** Загруженная проверка или `undefined`, если её ещё (или уже) нет. */
  get(): ValidateFormSchema | undefined;
  /** Заказать загрузку. Идемпотентна и никогда не отвергается. */
  load(): Promise<void>;
}

export function createDeferredSchemaCheck(
  loader: () => Promise<{ validateFormSchema: ValidateFormSchema }> = () =>
    import('@reformer/renderer-json/validate')
): DeferredSchemaCheck {
  let loaded: ValidateFormSchema | undefined;
  let started: Promise<void> | undefined;
  return {
    get: () => loaded,
    load() {
      // Загрузчик зовётся синхронно (тело до первого `await` — тот же такт), поэтому
      // «загрузка заведена» становится правдой сразу после вызова.
      started ??= (async (): Promise<void> => {
        loaded = (await loader()).validateFormSchema;
      })().catch((error: unknown) => {
        console.error('[validator-schema] проверка по мета-схеме не загрузилась', error);
      });
      return started;
    },
  };
}

/**
 * Жалоба на исправление, которому нечем исполниться, — по одному разу на идентификатор.
 *
 * Дедупликация обязательна, а не аккуратна: проход идёт на каждой правке текста, и без неё
 * несуществующая команда печатала бы строку на каждый набранный символ — то есть предупреждение
 * утонуло бы в самом себе. Память живёт в замыкании вклада, а не на уровне модуля: два вклада
 * (тест и приложение, два окна) не должны делить одну ячейку — тот же довод, что у отложенной
 * загрузки мета-схемы выше.
 */
function createUnavailableFixReporter(): (fix: QuickFix) => void {
  const reported = new Set<string>();
  return (fix) => {
    if (reported.has(fix.commandId)) return;
    reported.add(fix.commandId);
    console.warn(
      `[validator-schema] быстрое исправление «${fix.titleKey}» названо командой ` +
        `«${fix.commandId}», которой нет в реестре: исправление не предлагается. ` +
        'Либо команду не зарегистрировал её владелец, либо в идентификаторе опечатка'
    );
  };
}

/** Вклад валидатора — отдельно от плагина, чтобы тест звал его без реестров. */
export function createSchemaValidator(
  options: SchemaValidatorOptions,
  deferred: DeferredSchemaCheck = createDeferredSchemaCheck()
): ValidatorContribution {
  const applies = options.applies ?? isFormSchemaDocument;
  const reportUnavailable = createUnavailableFixReporter();
  return {
    id: SCHEMA_VALIDATOR_ID,
    applies(doc) {
      const mine = applies(doc);
      // Подходящий документ появился — значит проверка вот-вот понадобится. Дешевле места
      // для заказа нет: `applies` синхронна, зовётся раньше `validate` и уже знает ответ.
      if (mine) void deferred.load();
      return mine;
    },
    validate(ctx) {
      const found = checkForm(
        { resource: ctx.doc.id, text: ctx.text(), model: ctx.model() },
        {
          catalog: options.catalog(),
          rules: options.rules?.(ctx.doc),
          ...(deferred.get() !== undefined ? { validateSchema: deferred.get()! } : {}),
        }
      );
      // Отбор ЗДЕСЬ, а не у того, кто рисует: находки уходят в службу диагностик, а оттуда —
      // в четыре разных места сразу, и проверять «команда есть?» в каждом значило бы завести
      // четыре копии одного условия. Показывающему остаётся та же проверка перед вызовом —
      // между публикацией и нажатием плагин могут выключить, — но кнопки-обманки она уже
      // не породит.
      const hasCommand = options.hasCommand;
      if (hasCommand === undefined) return found;
      return withUsableFixes(found, hasCommand, { onUnavailable: reportUnavailable });
    },
  };
}

/**
 * Плагин валидатора.
 *
 * `activate` только регистрирует — как и требует контракт плагина. Команды быстрых исправлений
 * здесь НЕ регистрируются: `QuickFix` называет команду, а владеет ею тот, кто умеет править
 * документ, — редактор схемы. В этом и смысл пары «код + команда»: ассистент чинит той же
 * командой, которой чинит человек из палитры, а не вторым, только для машин написанным путём.
 *
 * Отсюда же и единственное, что `activate` добавляет к настройкам: доступ к реестру команд,
 * чтобы проход мог отобрать исправления, которым есть чем исполниться. Сам реестр СПРАШИВАЕТСЯ
 * на каждом проходе, а не читается сейчас, — см. {@link SchemaValidatorOptions.hasCommand}.
 */
export function createSchemaValidatorPlugin(options: SchemaValidatorOptions): Plugin {
  return definePlugin({
    id: SCHEMA_VALIDATOR_PLUGIN_ID,
    activate(ctx) {
      const deferred = createDeferredSchemaCheck();
      const withCommands: SchemaValidatorOptions = {
        ...options,
        hasCommand: options.hasCommand ?? ((id) => ctx.commands.get(id) !== undefined),
      };
      ctx.subscriptions.push(
        ctx.extensions.contribute(ValidatorPoint, createSchemaValidator(withCommands, deferred), {
          id: SCHEMA_VALIDATOR_ID,
        })
      );
      // Заказ, а не ожидание: `activate` только регистрирует, и держать на себе сеть ей нельзя.
      // Модуль едет параллельно оболочке и успевает задолго до первого открытого документа.
      void deferred.load();
    },
  });
}
