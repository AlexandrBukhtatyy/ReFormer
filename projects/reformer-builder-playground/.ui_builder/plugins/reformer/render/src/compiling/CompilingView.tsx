/**
 * Компилирующая поверхность: код модуля формы транспилируется, линкуется и исполняется
 * в ТОМ ЖЕ realm, что и оболочка.
 *
 * ## Что исполняется
 *
 * Файлы РОЛЕЙ модуля формы — начальные значения, валидация, словарь замечаний, поток шагов,
 * поведение, отправка, реестр (`./module`, `./exports`). Модуль читается от своего корня —
 * родителя папки `schema/`, в которой лежит документ; у документа со свободным именем — из
 * подкаталога, куда модуль кладёт кодоген. Страница модуля и сборка приложения
 * (`application/create.ts`, `application/entry.ts`) не исполняются: форму превью собирает само —
 * из живой схемы редактора, реестра кита, мока и фикстуры, — а из модуля берёт только то, чего в
 * схеме нет.
 *
 * ## Почему в том же realm
 *
 * Ось контракта Э8 — realm, а не «нужен ли компилятор». Рендер в iframe при компиляторе
 * в оболочке дал бы второй экземпляр ядра, а второй экземпляр ломает идентичность сигналов
 * и поиск узла по сигналу. Поэтому исполняющая поверхность обязана быть своей, и коду
 * подставляются уже загруженные модули оболочки — реестром модулей платформы.
 *
 * ## Отказ по источнику виден, а не молчалив
 *
 * Проверку выполняет тот, кто монтирует (см. `../source-guard`), поэтому сюда управление
 * доходит только при разрешении. Обратное — «поверхность проверяет себя сама» — защищало бы
 * ровно её, а точка расширения открыта для чужих вкладов.
 *
 * ## Компиляция и сборка разведены
 *
 * Файлы модуля читаются и транспилируются по документу и версии рабочих копий; форма собирается
 * по схеме. Один эффект на двоих означал бы перекомпиляцию модуля на каждое нажатие
 * клавиши в конструкторе — и, что хуже, падение в «собирается» вместо показанной формы.
 * В живом виде конструктора это видно постоянно: форма там на экране всегда.
 *
 * Отсюда и `pending`: он показывается только на ПЕРВОЙ компиляции. Пустое место во время
 * пересборки — это потеря того, на что человек смотрит, ради того, чего он ещё не просил.
 *
 * ## Деградация частями
 *
 * Битый `validation/form.ts` не лишает превью работающего `behavior/index.ts`: сбои приходят
 * списком и показываются, а форма собирается из того, что исполнилось. «Форма не отрабатывает»
 * без указания виновного — та самая жалоба, ради которой изоляция и делалась.
 *
 * ## Словарь замечаний подключает поверхность
 *
 * В приложении тексты замечаний формы даёт страница модуля:
 * `<ValidationMessagesProvider messages={formMessages}>` вокруг формы. Страницу превью не
 * исполняет — и без своего провайдера форма показывала бы замечания текстами локали (английскими),
 * хотя словарь лежит в модуле рядом. Поэтому провайдер здесь тот же, а словарь — экспорт
 * `formMessages` из `validation/messages.ts`. Модуль без словаря получает провайдер без записей:
 * он ничего не меняет, а дерево остаётся тем же — форма не перемонтируется, когда словарь
 * появился или исчез.
 *
 * Язык формы (`formLocale` того же файла) — так же: страница задаёт его форме `I18nProvider`, и
 * поверхность ставит тот же провайдер ({@link FormLocaleFrame}). Без него русский словарь
 * склонялся бы по языку оболочки («Не больше 3 символа»), а кнопки шагов говорили бы по-английски.
 *
 * ## Итог отправки — полосой над формой
 *
 * В приложении его показывает страница модуля (`onResult` → баннер), а страницу превью не
 * исполняет. Отправка при этом подключена настоящая (`application/submit.ts`), и без своего
 * приёмника итог терялся бы: кнопку нажали — и ничего не произошло. Поэтому приёмник здесь свой:
 * полоса над формой с тем же `data-testid="submit-result"`, что у баннера страницы. Она
 * принадлежит сборке формы, которая итог сообщила: пересборка (правка схемы или кода) её убирает.
 *
 * @module plugins/reformer/render/compiling/CompilingView
 */

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type MouseEvent,
  type ReactNode,
} from 'react';
import { ValidationMessagesProvider } from '@reformer/cdk';
import type { FormLocale } from '@reformer/core/i18n';
import { I18nProvider, useI18n } from '@reformer/core/react';
import { FormRenderer } from '@reformer/renderer-react';
import { ScrollArea } from '@reformer/ui-kit/scroll-area';
import { toDescriptor } from '@reformer/builder-plugin-api';
import type { KitDescriptor, KitNamespace, ResourceId } from '@reformer/builder-plugin-api';
import type { PreviewContext, PreviewProblem, PreviewValues } from '@reformer/builder-plugin-api';
import type { PreviewHost } from '../host';
import { nodeAt } from '../schema/node-token';
import { buildRuntimeBundle, type RuntimeBundle, type Shape } from '../runtime/build';
import { Highlight } from '../ui/Highlight';
import { KitFrame } from '../ui/KitFrame';
import { Notice } from '../ui/Notice';
import {
  formKeyOf,
  useFilesVersion,
  useKitVersion,
  useLiveValidation,
  usePreviewSchema,
  usePreviewSelection,
} from '../ui/hooks';
import type { ComponentRegistry } from '@reformer/renderer-json';
import { createAmbient, type FormFixture } from '../../../core/form-fixture';
import { compileForm } from './compile';
import { loadFixture } from './fixture';
import { kitImportOverrides, mergeOverrides } from './kit-imports';
import {
  appliedArtifacts,
  extractContract,
  runFactories,
  type AppliedArtifact,
  type FormContract,
} from './exports';
import { alignFlow } from './flow';
import { moduleFilesFor, planModule } from './module';
import { attributeProblems, readSidecars } from './read';

/** Идентификатор поверхности. Он же имя источника находок. */
export const COMPILING_SURFACE_ID = 'preview.compiling';

const NO_NAMESPACE: KitNamespace = Object.freeze({});

/**
 * Язык формы — тот, который задаёт ей страница модуля (`formLocale` из `validation/messages.ts`).
 *
 * Провайдер стоит всегда: без своего языка он отдаёт форме язык снаружи, и дерево не меняется,
 * когда язык в словаре появился или исчез, — форма не перемонтируется (тот же довод, что у
 * провайдера словаря).
 */
function FormLocaleFrame({
  locale,
  children,
}: {
  readonly locale: FormLocale | undefined;
  readonly children: ReactNode;
}): ReactNode {
  const outer = useI18n().locale;
  return <I18nProvider locale={locale ?? outer}>{children}</I18nProvider>;
}

function fallbackDescriptor(): KitDescriptor {
  return toDescriptor({ version: '1.0', components: [] });
}

/** Нет файлов — нет и адресов: находки остаются при документе. */
const NO_RESOURCES: ReadonlyMap<string, ResourceId> = new Map();

/** Что дал код модуля. Пересобирается ТОЛЬКО при его правке, но не при правке схемы. */
interface CompiledSources {
  readonly contract: FormContract | null;
  /** Реестр компонентов формы: собран один раз, фабрикой `createRegistry` модуля. */
  readonly registry: ComponentRegistry | undefined;
  /** Начальные значения модуля: один вызов `createInitialValues` на компиляцию. */
  readonly initial: Shape | undefined;
  /** Путь файла от корня модуля → ресурс: адреса для находок сборки формы. */
  readonly resources: ReadonlyMap<string, ResourceId>;
  /**
   * Фикстура формы: данные, подстановки и окружение.
   *
   * Живёт рядом с контрактом, потому что читается тем же эффектом и по тому же поводу —
   * правке файлов, а не схемы.
   */
  readonly fixture: FormFixture | null;
  readonly applied: readonly AppliedArtifact[];
  readonly problems: readonly PreviewProblem[];
  /** Идёт первая компиляция: показывать нечего вовсе. */
  readonly pending: boolean;
}

const PENDING: CompiledSources = Object.freeze({
  contract: null,
  registry: undefined,
  initial: undefined,
  resources: NO_RESOURCES,
  fixture: null,
  applied: [],
  problems: [],
  pending: true,
});

/** Загрузчика модулей нет: код модуля не исполнится, но форма по схеме соберётся. */
const NOTHING: CompiledSources = Object.freeze({
  contract: { files: {} },
  registry: undefined,
  initial: undefined,
  resources: NO_RESOURCES,
  fixture: null,
  applied: [],
  problems: [],
  pending: false,
});

/** Итог отправки и сборка формы, которая его сообщила. */
interface SubmitOutcome {
  /** Метка сборки: итог показывается, только пока на экране та же форма. */
  readonly owner: object;
  readonly message: string;
  readonly ok: boolean;
}

/** Собранная форма вместе с меткой, по которой итог отправки узнаёт свою сборку. */
interface BuiltForm {
  readonly bundle: RuntimeBundle;
  readonly owner: object;
}

export interface CompilingViewProps {
  readonly ctx: PreviewContext;
  readonly host: PreviewHost;
}

export function CompilingView({ ctx, host }: CompilingViewProps): ReactNode {
  const t = host.useTranslate();
  const schema = usePreviewSchema(ctx);
  const selection = usePreviewSelection(ctx);
  const kitVersion = useKitVersion(host);
  const filesVersion = useFilesVersion(host);
  const surface = useRef<HTMLDivElement | null>(null);
  const [sources, setSources] = useState<CompiledSources>(PENDING);
  const [outcome, setOutcome] = useState<SubmitOutcome | null>(null);
  /** Форма прошлой сборки — источник значений для следующей (см. `../runtime/carry`). */
  const live = useRef<{ model: { get(): unknown } } | null>(null);

  const modules = host.modules;
  const documentId = ctx.doc.id;
  // Путь документа отвечает на вопрос «где модуль»: его корень — родитель папки `schema/`, там
  // же лежит фикстура (`fixture.ts`), а от имени каталога зависит имя файла потока шагов. У
  // документа со свободным именем модуль ищется в подкаталоге, куда его кладёт кодоген, — это
  // решает чтение (`./read`), а фикстура остаётся рядом с документом.
  const schemaPath = host.documentOf(documentId)?.ref.path ?? '';
  const mock = ctx.mock();

  const kit = useMemo(() => {
    // Счётчик читается намеренно: кит приходит ФУНКЦИЯМИ порта, и только он связывает
    // пересборку со сменой активного кита.
    void kitVersion;
    return {
      catalog: host.catalog(),
      descriptor: host.kit() ?? fallbackDescriptor(),
      namespace: host.kitNamespace() ?? NO_NAMESPACE,
    };
  }, [host, kitVersion]);

  // Пакет кита плагина — его namespace (см. `./kit-imports`). Карта стабильна, пока кит и его
  // namespace те же: у встроенного кита она пуста всегда и компиляцию не трогает.
  const kitImports = useMemo(() => {
    void kitVersion;
    return kitImportOverrides({
      origin: host.kitOrigin(),
      descriptor: host.kit(),
      namespace: host.kitNamespace(),
    });
  }, [host, kitVersion]);

  // Код модуля: от схемы НЕ зависит вовсе. Его правят в соседних вкладках, и об этом сообщает
  // `filesVersion`, а не изменение модели документа.
  useEffect(() => {
    if (modules === undefined) {
      setSources(NOTHING);
      return;
    }

    // Отменяем не работу, а ПРИМЕНЕНИЕ результата: компиляция уже запущена, остановить её
    // нечем, но опоздавший результат обязан быть отброшен — иначе он затрёт свежий.
    let cancelled = false;
    // В «собирается» падаем только с пустого места: пересборка модуля не должна убирать
    // с экрана форму, которая уже показана.
    setSources((previous) => (previous.contract === null ? PENDING : previous));

    void (async () => {
      // Фикстура исполняется ПЕРВОЙ и отдельным графом: её подстановки нужны файлам модуля,
      // а общий граф исполнил бы `api/index.ts` дважды — один раз для неё, другой для формы.
      const loaded = await loadFixture(host, modules, documentId, schemaPath);
      const isolation = {
        // Пакет кита плагина и подстановки фикстуры — одной картой; фикстура побеждает.
        overrides: mergeOverrides(kitImports, loaded.fixture?.modules),
        ambient: createAmbient(loaded.fixture),
      };

      const read = await readSidecars(host, documentId, schemaPath);
      // План строится по СПИСКУ каталога, а не по прочитанному: файл роли, который не прочитался,
      // всё равно говорит, что модуль разложен по ролям, — и корень тогда не исполняется.
      // Раскладка — по тому месту, откуда модуль прочитан: у документа со свободным именем это
      // может быть подкаталог кодогена, где документ лежит в `schema/`.
      const plan = planModule(read.resources.keys(), moduleFilesFor(schemaPath, read.detached));
      const compiled = await compileForm(read.files, modules, isolation, plan);
      if (cancelled) return;

      const contract = extractContract(compiled.modules, plan);
      // Фабрики модуля — раз на компиляцию: правка схемы форму пересобирает, а реестр и
      // начальные значения остаются теми же объектами.
      const values = runFactories(contract);
      const problems: PreviewProblem[] = [
        ...loaded.problems,
        ...read.problems,
        ...compiled.problems,
        ...values.problems,
      ];

      setSources({
        contract,
        registry: values.registry,
        initial: values.initial,
        resources: read.resources,
        fixture: loaded.fixture,
        applied: appliedArtifacts(contract),
        // Адрес файла — чтобы находка ушла в свод диагностик туда, где чинить, а не на схему.
        problems: attributeProblems(problems, read.resources),
        pending: false,
      });
    })();

    return () => {
      cancelled = true;
    };
  }, [host, documentId, schemaPath, modules, filesVersion, kitImports]);

  // Форма: синхронная сборка по схеме и уже исполненному коду модуля. Правка схемы доходит
  // сюда и никуда больше — компилятор она не трогает.
  const built = useMemo<BuiltForm | null>(() => {
    const contract = sources.contract;
    if (schema === null || contract === null) return null;
    const carry = (live.current?.model.get() as PreviewValues | undefined) ?? ctx.values();
    const owner = {};
    const { behaviorRules, wireSubmit } = contract;
    const bundle = buildRuntimeBundle({
      schema,
      catalog: kit.catalog,
      descriptor: kit.descriptor,
      namespace: kit.namespace,
      mock,
      fixture: sources.fixture,
      extraRegistry: sources.registry,
      initialOverride: sources.initial,
      behavior: contract.behavior,
      // Обе половины есть — поведение складывается как в сборке приложения: правила и отправка.
      // Нет хотя бы одной — остаётся готовое `formBehavior`, без отправки.
      ...(behaviorRules !== undefined && wireSubmit !== undefined
        ? {
            moduleBehavior: {
              rules: behaviorRules,
              wireSubmit,
              onResult: (message: string, ok: boolean) => {
                setOutcome({ owner, message, ok });
              },
            },
          }
        : {}),
      validation: contract.validation,
      // Шаги — из живой схемы, правила шагов — из потока модуля (см. `./flow`).
      flow: alignFlow(contract.flow, schema),
      renderBehavior: contract.renderBehavior,
      files: contract.files,
      carry,
    });
    return { bundle, owner };
  }, [schema, kit, mock, sources, ctx]);
  const bundle = built?.bundle ?? null;
  // Итог чужой сборки не показывается: форму пересобрали, и он относится к прежней.
  const shown = outcome !== null && outcome.owner === built?.owner ? outcome : null;

  useLiveValidation(bundle?.form ?? null);

  useEffect(() => {
    live.current = bundle?.form ?? null;
    // Панель модели читает и правит ЭТУ форму. Публикуем после сборки и снимаем на
    // размонтировании: наблюдателю нечего показывать, когда поверхности нет.
    ctx.publishForm?.(bundle?.form ?? null);
    return () => {
      ctx.publishForm?.(null);
    };
  }, [bundle, ctx]);

  useEffect(() => {
    // Размонтирование — последний момент, когда модель ещё жива.
    return () => {
      const form = live.current;
      if (form !== null) ctx.keepValues(form.model.get() as PreviewValues);
    };
  }, [ctx]);

  const problems = useMemo(
    // Находки сборки названы путём файла модуля — адрес им приписывается тот же, что находкам
    // компиляции: подчеркнуть надо файл, а не схему.
    () => [...sources.problems, ...attributeProblems(bundle?.problems ?? [], sources.resources)],
    [sources.problems, sources.resources, bundle]
  );

  useEffect(() => {
    ctx.report(COMPILING_SURFACE_ID, problems);
  }, [ctx, problems]);

  const onClick = useCallback(
    (event: MouseEvent<HTMLDivElement>) => {
      const root = surface.current;
      if (root === null) return;
      const el = event.target as Element;
      // Полоса прокрутки лежит внутри той же `ScrollArea`, по которой ловится клик, поэтому
      // тычок в неё дошёл бы сюда как промах по форме и снял бы выделение прямо в момент
      // перетаскивания ползунка. Прокрутка — не выбор узла и не отказ от него.
      if (el.closest('[data-slot="scroll-area-scrollbar"]') !== null) return;
      const id = nodeAt(el, root);
      ctx.select(id === null ? [] : [id]);
    },
    [ctx]
  );

  if (modules === undefined) {
    return (
      <Notice tone="warning" title={t('empty.no-loader')} detail={t('empty.no-loader.detail')} />
    );
  }
  if (schema === null) {
    return <Notice title={t('empty.no-schema')} detail={t('empty.no-schema.detail')} />;
  }
  // Пустое место показывается только на ПЕРВОЙ компиляции: дальше прошлая форма остаётся
  // на экране, пока не готова новая.
  if (sources.pending) {
    return <Notice title={t('empty.compiling')} />;
  }
  if (bundle === null || bundle.form === null) {
    return <Notice tone="warning" title={t('empty.build-failed')} detail={problems[0]?.message} />;
  }

  // Полоса «сайдкары такие-то, проблем столько-то» убрана. Она отвечала на вопрос панели
  // превью — «что вообще подцепилось», — а панели больше нет: поверхность монтируют в тело
  // редактора, где та же строка отнимает высоту у формы на каждой вкладке. Число находок
  // без их текста всё равно ничего не давало: разбирать их надо в панели проблем, куда они
  // пока не доезжают (см. задачу о находках сборки).
  //
  // Полоса итога отправки — другое: она появляется только после нажатия «Отправить» и лежит
  // СНАРУЖИ области формы, чтобы щелчок по ней не был промахом по форме и не снимал выделение.
  return (
    <div className="flex h-full flex-col">
      {shown === null ? null : (
        <div
          role="status"
          data-testid="submit-result"
          data-ok={shown.ok ? 'true' : 'false'}
          className={
            'flex-none border-b px-4 py-1.5 text-[12px] ' +
            (shown.ok
              ? 'border-emerald-500/40 bg-emerald-500/10 text-foreground'
              : 'border-amber-400/60 bg-amber-400/10 text-foreground')
          }
        >
          {shown.message}
        </div>
      )}
      <ScrollArea ref={surface} className="min-h-0 flex-1" onClick={onClick}>
        {/* Отступ лежит на содержимом, а не на `ScrollArea`: на корне он оставил бы полосу
            прокрутки внутри поля, а нижний отступ перестал бы уезжать вместе с формой. */}
        <div className="p-4">
          <Highlight selection={selection} />
          <KitFrame frame={host.kitFrame()}>
            {/* Язык формы и словарь замечаний модуля — теми же провайдерами, которыми их
                подключает страница. Внутри рамки кита: записи формы ложатся поверх того, что
                дал кит, а язык формы — поверх языка оболочки. */}
            <FormLocaleFrame locale={sources.contract?.locale}>
              <ValidationMessagesProvider messages={sources.contract?.messages}>
                {/* Реестр уже в бандле: дерево, обёртку поля и границу ошибок схемы сборка взяла
                    из него. */}
                <FormRenderer key={formKeyOf(bundle.form)} form={bundle.form} />
              </ValidationMessagesProvider>
            </FormLocaleFrame>
          </KitFrame>
        </div>
      </ScrollArea>
    </div>
  );
}
