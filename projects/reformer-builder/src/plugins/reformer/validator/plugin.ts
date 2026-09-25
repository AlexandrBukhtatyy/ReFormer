/**
 * Плагин «валидатор схемы формы»: вклад в точку расширения валидаторов.
 *
 * **Почему это плагин, а не часть Host.** Разбор и проверка схемы формы — предметное знание:
 * что такое `$component`, чем шаг отличается от вкладки, какие пропсы у поля. В платформе оно
 * означало бы, что второй формат (или второй продукт поверх той же платформы) вносится правкой
 * ядра. Граница проверяется линтером: `src/plugins/**` не видит `@/shell/*` — только `@reformer/builder-plugin-api`
 * и пакеты стеков.
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
 * одного динамического импорта, но нулём оно не становится. Поэтому прибытие модуля объявлено
 * сменой входа (`onDidChangeInputs`): документ, проверенный без мета-схемы, оркестратор
 * перепроверяет сам, когда модуль доедет, — не дожидаясь правки.
 *
 * ## Каталог берётся ВОЗМОЖНОСТЬЮ, правила — параметром
 *
 * Каталог активного кита — состояние приложения (кит переключают), и приходит он из реестра
 * служб по возможности `reformer.kit.catalog` (`KitsCapability` SDK), а не параметром от
 * композиции. Служба нейтральна и отдаёт СЫРОЙ каталог кита; записи, с которыми сверяется
 * `$component(...)`, — ReFormer-проекция (`projectCatalog`): каталог кита плюс синтетика билдера.
 *
 * Смена кита — смена входа проверки: валидатор сообщает о ней оркестратору
 * (`onDidChangeInputs`), и тот перепроверяет открытые схемы. Без этого документ, открытый раньше,
 * чем доехал каталог, до первой правки проверялся с пустым каталогом (ReFormer-3ybp).
 *
 * В манифесте кит записан НЕОБЯЗАТЕЛЬНЫМ требованием, и это названная деградация, а не
 * забытое требование: без кита валидатор проверяет структуру схемы и молчит о компонентах —
 * сверять их не с чем. Состав без китов законен, и отказывать ему в проверке структуры
 * было бы хуже, чем проверить её одну.
 *
 * Правила формы живут САЙДКАРОМ: `JsonFormSchema` — закрытый контракт рендерера, положить
 * их внутрь нельзя.
 * `ValidateContext` описывает ОДИН документ и способа прочитать соседний ресурс не даёт,
 * поэтому сайдкар приходит функцией от документа. Это ограничение контракта, а не решение:
 * пока валидатор не умеет читать соседей, склеивать схему с правилами обязан тот, кто их
 * и так держит.
 *
 * @module plugins/reformer/validator/plugin
 */

import manifest from './manifest.json';
import { projectCatalog, type CatalogEntry } from '@reformer/builder-stack-reformer/catalog';
import type { FormRules } from '@reformer/builder-stack-reformer/form-model';
import {
  definePlugin,
  KitsCapability,
  withUsableFixes,
  ValidatorPoint,
  type CapabilityAccess,
  type CommandLookup,
  type Disposable,
  type DocumentRef,
  type Plugin,
  type QuickFix,
  type ValidatorContribution,
} from '@reformer/builder-plugin-api';
import { isFormSchemaDocument as isStackFormSchemaDocument } from '@reformer/builder-stack-reformer/form-model';
import { checkForm, type ValidateFormSchema } from './check';
import { SCHEMA_VALIDATOR_ID } from './codes';

/** Идентификатор плагина: пространство имён во всех реестрах. */
export const SCHEMA_VALIDATOR_PLUGIN_ID = manifest.id;

/** Пустой каталог: одна замороженная ссылка вместо нового массива на каждый проход. */
const NO_CATALOG: readonly CatalogEntry[] = Object.freeze([]);

export interface SchemaValidatorOptions {
  /**
   * Каталог активного кита. Функция, а не список: кит переключают, и валидатор обязан
   * сравнивать с тем каталогом, который действует СЕЙЧАС, а не с тем, что был на активации.
   *
   * Необязателен: плагин берёт каталог из реестра служб (`reformer.kit.catalog`), и это его
   * штатный путь. Параметр остаётся для теста вклада в одиночку — там реестра нет вовсе.
   */
  readonly catalog?: () => readonly CatalogEntry[];
  /** Правила-сайдкар документа, если тот, кто их держит, может их отдать. */
  readonly rules?: (doc: DocumentRef) => FormRules | undefined;
  /** Чем сузить круг документов. По умолчанию — {@link isFormSchemaDocument}. */
  readonly applies?: (doc: DocumentRef) => boolean;
  /**
   * Зарегистрирована ли команда — по ней отбираются быстрые исправления (`@reformer/builder-plugin-api`.`usableFixes`).
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
  /**
   * Подписка на смену каталога — вход проверки помимо документа
   * ({@link ValidatorContribution.onDidChangeInputs}). По ней оркестратор перепроверяет
   * открытые схемы, когда кит сменился или его каталог доехал позже документа.
   *
   * Необязательна по той же причине, что и {@link catalog}: плагин следит за службой китов сам,
   * а тесту вклада в одиночку следить не за чем.
   */
  readonly onDidChangeInputs?: (cb: () => void) => Disposable;
}

/**
 * Умолчание для `applies`: документ, который разобрал провайдер схемы формы.
 *
 * Самая узкая проверка, доступная синхронно по одному {@link DocumentRef}. Провайдер схемы
 * берётся ровно за схемы формы — он читает содержимое пробой, чего валидатору нельзя. Прежняя
 * проверка «модельный документ с JSON-медиатипом» отдала бы валидатору форму ЛЮБОГО стека:
 * `.json` бывает схемой не только ReFormer, и валидатор находил бы в чужой форме «ошибки».
 */
export function isFormSchemaDocument(doc: DocumentRef): boolean {
  return isStackFormSchemaDocument(doc);
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

/** Подписка, которую снимают сколько угодно раз, а действует снятие один. */
function once(release: () => void): Disposable {
  let released = false;
  return {
    dispose() {
      if (released) return;
      released = true;
      release();
    },
  };
}

/**
 * Следит за каталогом активного кита: и за сменой кита, и за появлением самой службы.
 *
 * Подписки на службу, взятую в момент вызова, мало: плагин китов вправе подняться позже
 * валидатора (порядок активации незначим), а его выключают и включают. Поэтому наблюдается
 * ВОЗМОЖНОСТЬ, и подписка на смену кита переезжает к каждому новому владельцу.
 *
 * Первое значение `observe` приходит сразу и сменой не считается: документ только что
 * проверен именно с ним.
 */
function followKitCatalog(capabilities: CapabilityAccess, cb: () => void): Disposable {
  let kit: Disposable | undefined;
  let initial = true;
  const observed = capabilities.observe(KitsCapability, (kits) => {
    kit?.dispose();
    kit = kits?.onDidChange(cb);
    if (!initial) cb();
  });
  initial = false;
  return once(() => {
    observed.dispose();
    kit?.dispose();
  });
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
    onDidChangeInputs(cb) {
      // Мета-схема — тоже вход: документ, проверенный, пока модуль был в пути, получает её
      // находки, когда модуль доедет, а не на следующем нажатии клавиши. Уже доехавшая
      // подписки не требует — иначе каждый новый документ проверялся бы лишний раз.
      let live = true;
      if (deferred.get() === undefined) {
        void deferred.load().then(() => {
          if (live && deferred.get() !== undefined) cb();
        });
      }
      const external = options.onDidChangeInputs?.(cb);
      return once(() => {
        live = false;
        external?.dispose();
      });
    },
    validate(ctx) {
      const found = checkForm(
        { resource: ctx.doc.id, text: ctx.text(), model: ctx.model() },
        {
          catalog: options.catalog?.() ?? NO_CATALOG,
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
        // Служба СПРАШИВАЕТСЯ на каждом проходе, а не читается сейчас, и по той же причине,
        // что реестр команд ниже: кит переключают, а плагин китов вправе подняться позже —
        // порядок активации объявлен незначимым. Захваченный здесь каталог был бы каталогом
        // на момент активации, то есть пустым.
        catalog:
          options.catalog ??
          ((): readonly CatalogEntry[] => {
            const kits = ctx.services.get(KitsCapability);
            return kits === undefined ? NO_CATALOG : projectCatalog(kits.catalogJson()).entries;
          }),
        hasCommand: options.hasCommand ?? ((id) => ctx.commands.get(id) !== undefined),
        // Следить за службой китов есть смысл, только когда каталог берётся из неё. Подписка
        // заводится оркестратором на открытии документа, а не здесь: `activate` только
        // регистрирует.
        ...(options.onDidChangeInputs === undefined && options.catalog === undefined
          ? { onDidChangeInputs: (cb: () => void) => followKitCatalog(ctx.capabilities, cb) }
          : {}),
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
