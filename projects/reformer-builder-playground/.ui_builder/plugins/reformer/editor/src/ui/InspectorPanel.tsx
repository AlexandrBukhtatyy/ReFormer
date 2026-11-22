/**
 * Инспектор свойств выделенного узла.
 *
 * Список полей и их порядок целиком приходят из каталога ({@link inspectorModelFor}): своего
 * представления о том, что бывает у компонента, у инспектора нет. Здесь остаётся отрисовка
 * и правка — каждая правка это операция `set-prop`, то есть та же дверь, через которую узел
 * правит ассистент.
 *
 * ## Пустая строка удаляет свойство
 *
 * Не пишет `""`. Свойство, которого в `componentProps` нет, и свойство, равное пустой строке,
 * — разные состояния файла: первое означает «умолчание кита», второе — «пусто». Стереть текст
 * в поле человек хочет для первого.
 *
 * ## Правится один узел
 *
 * При множественном выделении инспектор говорит об этом словами и полей не показывает.
 * Правка «всем сразу» — отдельная работа со своими правилами (что делать с разными значениями
 * одного ключа), и притворяться, что правится первый, значило бы менять не то, на что смотрят.
 *
 * ## Выбор — всегда список
 *
 * Флажков и радиокнопок в панели нет. Одно значение из нескольких — список с единичным
 * выбором; булевы свойства секции — один список с мультивыбором, где выбранное и есть
 * включённое (`sectionRows` модели). Десяток булевых свойств флажками растягивал бы панель
 * на десять строк, а списком это одна строка, в которой видно сразу всё включённое.
 *
 * Привязка к модели — тоже список кита, но с вводом своего значения (`Combobox` в режиме
 * `creatable`): путь — свободный текст, и новый объявляется ровно здесь, а список предлагает
 * уже объявленные. Раньше это было поле ввода с родным `datalist`: стрелку и выпадающий список
 * рисовал браузер, и рядом со списками кита поле выглядело чужим. Заодно правка привязки стала
 * одной операцией на выбор, а не операцией на каждую букву — недописанный путь в документ
 * больше не попадает.
 *
 * Крестика очистки у привязки нет. Узел без привязки модель считает контейнером, а контейнеру
 * строка привязки не положена: снятая привязка унесла бы строку целиком, и вернуть её из панели
 * было бы нечем. Так вело себя и поле ввода, стоило стереть в нём текст до конца.
 *
 * ## Подпись слева, поле справа
 *
 * Свойство — одна строка: подпись в левой колонке, контрол в правой. Столбиком (подпись над
 * полем) панель была вдвое выше, и десяток свойств компонента не помещался в док без
 * прокрутки; строкой их видно сразу, а взгляд идёт по ровной колонке подписей, как в любом
 * инспекторе свойств.
 *
 * Колонка подписей — доля ширины панели с потолком ({@link ROW_CLASS}): в узком доке подпись
 * и поле делят место почти поровну, в широком лишнее достаётся полю. Подпись в одну строку
 * и обрезается многоточием — полный текст остаётся подсказкой браузера: перенос сделал бы
 * строки разной высоты и сломал колонку. Верх строки — по первой строке контрола, а не
 * по центру: список флагов растёт вниз, и подпись у его середины читалась бы как подпись
 * чего-то другого.
 *
 * Те же строки — у панели экспорта формы (`plugins/reformer/codegen`): панели стоят в одном
 * доке, и разный шаг полей в соседних вкладках выглядел бы ошибкой вёрстки. Класс строки
 * повторён там дословно, а не вынесен в ядро домена: таблицу стилей плагина собирает сканер
 * его собственных исходников, и класс, пришедший из чужого каталога, остался бы без правила.
 *
 * ## Подсказка — значком у подписи
 *
 * Не строкой под полем. Описания пропсов в каталоге кита длинные, и под каждым полем они
 * растягивали бы панель в несколько раз — а читают их один раз. Значок (i) тот же, что рисует
 * `labelTooltip` у полей форм ReFormer, и так же устроена панель свойств RJSF: обе панели
 * стоят в одном доке и обязаны читаться одинаково.
 *
 * @module plugins/reformer/editor/ui/InspectorPanel
 */

import { useId, type ReactElement } from 'react';
import { useI18n } from '@reformer/core/react';
import { Badge } from '@reformer/ui-kit/badge';
import { Combobox } from '@reformer/ui-kit/combobox';
import { Empty, EmptyHeader, EmptyTitle } from '@reformer/ui-kit/empty';
import { InfoHint } from '@reformer/ui-kit/info-hint';
import { Input } from '@reformer/ui-kit/input';
import { Label } from '@reformer/ui-kit/label';
import { ScrollArea } from '@reformer/ui-kit/scroll-area';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectMulti,
  SelectTrigger,
  SelectValue,
} from '@reformer/ui-kit/select';
import { Separator } from '@reformer/ui-kit/separator';
import {
  flagOn,
  flagValue,
  inspectorModelFor,
  sectionRows,
  type InspectorField,
} from '../palette/inspector-model';
import { setBindingOp, setPropOp, setTextOp } from '../model/ops';
import { useActiveSession, useSessionState } from './useSession';
import type { NodeId, SchemaEditorHost, Translate } from '../host';
import type { SchemaSession } from '../session/sessions';
import type { SessionRegistry } from '../session/sessions';
import { useCatalog } from './useCatalog';

export interface InspectorPanelProps {
  readonly host: SchemaEditorHost;
  readonly registry: SessionRegistry;
}

export function InspectorPanel({ host, registry }: InspectorPanelProps): ReactElement {
  const t = host.useTranslate();
  const catalog = useCatalog(host);
  const session = useActiveSession(registry);
  const state = useSessionState(registry, session);
  const model = state?.model ?? null;
  const selection = state?.selection ?? [];
  const inspector = model === null ? null : inspectorModelFor(model, catalog, selection);

  if (session === null || model === null || selection.length === 0) {
    return <Message title={t('inspector.empty')} />;
  }
  if (selection.length > 1) {
    return <Message title={t('inspector.multi', { count: selection.length })} />;
  }
  if (inspector === null) {
    return <Message title={t('inspector.empty')} />;
  }

  return (
    <ScrollArea className="min-h-0 flex-1">
      <div className="flex flex-col gap-3 p-2">
        <div className="flex justify-between items-center gap-2">
          <span className="truncate text-[12px] font-medium">{inspector.title}</span>
          {inspector.component !== null && (
            <Badge variant="outline" className="text-[10px]">
              {inspector.component}
            </Badge>
          )}
        </div>

        {inspector.bindable && (
          <Field label={t('inspector.binding')} hint={t('inspector.binding.hint')} t={t}>
            {(control) => (
              <Combobox
                {...control}
                data-testid="inspector-binding"
                value={inspector.binding}
                options={inspector.bindingOptions.map((path) => ({ value: path, label: path }))}
                // Привязка — свободный текст: новый путь объявляется ровно здесь. Поэтому
                // список с вводом своего значения, а не выбор из готовых.
                creatable
                placeholder={t('inspector.binding.none')}
                searchPlaceholder={t('inspector.binding.search')}
                emptyText={t('inspector.binding.empty')}
                className="h-7 text-[12px]"
                onChange={(next) => {
                  // Щелчок по уже выбранному пути — не правка: пустой шаг в истории ни к чему.
                  if (next === null || next === inspector.binding) return;
                  session.apply(setBindingOp(inspector.nodeId, next));
                }}
              />
            )}
          </Field>
        )}

        {inspector.text !== null &&
          (inspector.text.editable ? (
            <Field label={t('inspector.text')} hint={t('inspector.text.hint')} t={t}>
              {(control) => (
                <Input
                  {...control}
                  value={inspector.text?.value ?? ''}
                  className="h-7 text-[12px]"
                  onChange={(event) => {
                    session.apply(setTextOp(inspector.nodeId, event.target.value));
                  }}
                />
              )}
            </Field>
          ) : (
            // Несколько текстовых частей: показываем содержимое, но не притворяемся, что
            // знаем, какую из них человек имел в виду.
            <Field label={t('inspector.text')} hint={t('inspector.readonly')} t={t}>
              {(control) => (
                <Input
                  {...control}
                  value={inspector.text?.value ?? ''}
                  readOnly
                  className="h-7 text-[12px]"
                />
              )}
            </Field>
          ))}

        {!inspector.known && (
          <p className="text-muted-foreground text-[11px]">
            {t('inspector.unknown', { name: inspector.component ?? '—' })}
          </p>
        )}

        {inspector.sections.map((section) => (
          <div key={section.group} className="flex flex-col gap-2">
            <Separator />
            <span className="text-muted-foreground text-[11px] font-medium uppercase">
              {t(`group.${section.group}`)}
            </span>
            {sectionRows(section).map((row) =>
              row.kind === 'flags' ? (
                <FlagsField
                  key="flags"
                  fields={row.fields}
                  nodeId={inspector.nodeId}
                  session={session}
                  t={t}
                />
              ) : (
                <PropField
                  key={row.field.key}
                  field={row.field}
                  nodeId={inspector.nodeId}
                  session={session}
                  t={t}
                />
              )
            )}
          </div>
        ))}
      </div>
    </ScrollArea>
  );
}

/** Пустое состояние в единственном виде — чтобы разные «пусто» отличались только текстом. */
function Message({ title }: { title: string }): ReactElement {
  return (
    <Empty className="flex-1 border-0">
      <EmptyHeader>
        <EmptyTitle className="text-sm font-medium">{title}</EmptyTitle>
      </EmptyHeader>
    </Empty>
  );
}

/**
 * Строка свойства: колонка подписи и колонка контрола.
 *
 * Подписи отдано 45% ширины, но не больше девяти `rem`: «Привязка к модели» со значком
 * подсказки в док по умолчанию помещается целиком, а расширенный док отдаёт место полю.
 * `minmax(0, …)` у обеих колонок — чтобы длинное значение не раздвигало сетку за край панели.
 */
const ROW_CLASS = 'grid grid-cols-[minmax(0,min(45%,9rem))_minmax(0,1fr)] items-start gap-x-2';

/** Высота строки подписи — высота однострочного контрола: текст встаёт напротив его текста. */
const LABEL_CLASS = 'flex min-h-7 min-w-0 items-center gap-1.5';

/** Адрес скрытого текста подсказки — на него ссылается `aria-describedby` контрола. */
const hintIdOf = (controlId: string): string => `${controlId}-hint`;

/** Подсказка есть, только когда в ней есть текст: пустое описание каталога значка не даёт. */
const hasHint = (hint: string | undefined): hint is string => hint !== undefined && hint !== '';

/** Что поле отдаёт своему контролу: адрес для подписи и ссылку на текст подсказки. */
interface ControlProps {
  readonly id: string;
  readonly 'aria-describedby': string | undefined;
}

const controlPropsOf = (id: string, hint: string | undefined): ControlProps => ({
  id,
  'aria-describedby': hasHint(hint) ? hintIdOf(id) : undefined,
});

/**
 * Подпись свойства и его подсказка — значком (i) рядом с подписью.
 *
 * Значок стоит СНАРУЖИ `<label>`: внутри него щелчок по значку активировал бы контрол. Поэтому
 * подпись связана с контролом через `htmlFor`, а не вложением. Сам текст подсказки контрол
 * получает через `aria-describedby` — значок кладёт рядом скрытый дубль (см. `InfoHint`).
 */
function FieldLabel({
  controlId,
  label,
  hint,
  t,
}: {
  controlId: string;
  label: string;
  hint?: string | undefined;
  t: Translate;
}): ReactElement {
  return (
    <span className={LABEL_CLASS}>
      {/* `block`, а не `flex` кита: многоточие у гибкого контейнера не рисуется. */}
      <Label htmlFor={controlId} title={label} className="block min-w-0 truncate text-[11px]">
        {label}
      </Label>
      {hasHint(hint) && (
        <InfoHint
          content={hint}
          descriptionId={hintIdOf(controlId)}
          aria-label={t('inspector.hint', { label })}
        />
      )}
    </span>
  );
}

function Field({
  label,
  hint,
  t,
  children,
}: {
  label: string;
  hint?: string | undefined;
  t: Translate;
  /** Контрол поля: получает адрес, по которому его находят подпись и подсказка. */
  children: (control: ControlProps) => ReactElement;
}): ReactElement {
  const id = useId();
  return (
    <div className={ROW_CLASS} data-inspector-row="">
      <FieldLabel controlId={id} label={label} hint={hint} t={t} />
      {children(controlPropsOf(id, hint))}
    </div>
  );
}

/**
 * Подсказка списка флагов: описания его свойств одной строкой.
 *
 * У пункта списка своей подсказки нет, а описания у флагов есть — и терять их из-за того, что
 * флажки стали списком, незачем. Точка в конце описания снимается: части разделяет «;».
 */
function flagsHint(fields: readonly InspectorField[]): string | undefined {
  const parts = fields
    .filter((field) => hasHint(field.description))
    .map((field) => `${field.label} — ${(field.description ?? '').replace(/[.\s]+$/, '')}`);
  return parts.length === 0 ? undefined : parts.join('; ');
}

/**
 * Булевы свойства секции — одним списком с мультивыбором: выбранное и есть включённое.
 *
 * Каждое свойство по-прежнему пишется своей операцией `set-prop`: список — способ показать,
 * а в файле это те же отдельные свойства. Снятый пункт убирает свойство из `componentProps`,
 * если выключено оно и по умолчанию (см. `flagValue`).
 */
function FlagsField({
  fields,
  nodeId,
  session,
  t,
}: {
  fields: readonly InspectorField[];
  nodeId: NodeId;
  session: SchemaSession;
  t: Translate;
}): ReactElement {
  return (
    <Field label={t('inspector.flags')} hint={flagsHint(fields)} t={t}>
      {(control) => (
        <SelectMulti
          {...control}
          data-testid="inspector-flags"
          value={fields.filter(flagOn).map((field) => field.key)}
          options={fields.map((field) => ({ value: field.key, label: field.label }))}
          placeholder={t('inspector.flags.none')}
          // Свёртка в «Выбрано: N» панели не нужна: флагов в секции единицы, а видеть надо
          // именно КАКИЕ включены.
          summaryThreshold={fields.length}
          className="min-h-7 px-2 py-1 text-[12px]"
          onChange={(next) => {
            for (const field of fields) {
              const on = next.includes(field.key);
              if (on !== flagOn(field)) {
                session.apply(setPropOp(nodeId, field.key, flagValue(field, on)));
              }
            }
          }}
        />
      )}
    </Field>
  );
}

/** Текстовое умолчание поля для подсказки: из словаря кита, если у него есть ключ, иначе как есть. */
function fallbackText(field: InspectorField, i18n: ReturnType<typeof useI18n>): string | undefined {
  if (typeof field.fallback !== 'string') return undefined;
  return field.messageKey ? i18n.t(field.messageKey, undefined, field.fallback) : field.fallback;
}

/** Одно свойство. Вид элемента управления выбран каталогом — см. `inspector-model`. */
function PropField({
  field,
  nodeId,
  session,
  t,
}: {
  field: InspectorField;
  nodeId: NodeId;
  session: SchemaSession;
  t: Translate;
}): ReactElement {
  const i18n = useI18n();
  const set = (value: unknown): void => {
    session.apply(setPropOp(nodeId, field.key, value));
  };

  if (field.editor === 'select') {
    const options = field.options ?? [];
    return (
      <Field label={field.label} hint={field.description} t={t}>
        {(control) => (
          <Select
            value={field.value === undefined ? undefined : String(field.value)}
            onValueChange={(next) => {
              // Тип возвращается тот же, что в каталоге: `enum` числами обязан остаться числами,
              // иначе схема перестанет проходить валидацию собственного кита.
              const original = options.find((option) => String(option) === next);
              set(original ?? next);
            }}
          >
            {/* Во всю колонку и высотой с поле ввода: у кита список по ширине значения
                и на шаг выше, и в сетке строк это торчало бы и вбок, и вниз. */}
            <SelectTrigger {...control} size="sm" className="w-full text-[12px] data-[size=sm]:h-7">
              <SelectValue placeholder={t('inspector.unset')} />
            </SelectTrigger>
            <SelectContent>
              {options.map((option) => (
                <SelectItem key={String(option)} value={String(option)}>
                  {String(option)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </Field>
    );
  }

  if (field.editor === 'number') {
    return (
      <Field label={field.label} hint={field.description} t={t}>
        {(control) => (
          <Input
            {...control}
            type="number"
            value={typeof field.value === 'number' ? field.value : ''}
            min={field.min}
            max={field.max}
            step={field.step}
            className="h-7 text-[12px]"
            onChange={(event) => {
              const next = event.target.value;
              set(next === '' ? undefined : Number(next));
            }}
          />
        )}
      </Field>
    );
  }

  if (field.editor === 'readonly') {
    return (
      <Field label={field.label} hint={t('inspector.readonly')} t={t}>
        {(control) => (
          <Input
            {...control}
            readOnly
            value={field.value === undefined ? '' : JSON.stringify(field.value)}
            className="h-7 font-mono text-[12px]"
          />
        )}
      </Field>
    );
  }

  return (
    <Field label={field.label} hint={field.description} t={t}>
      {(control) => (
        <Input
          {...control}
          value={typeof field.value === 'string' ? field.value : ''}
          // Умолчание каталога — подсказкой. Ключ словаря кита переводит английский текст на язык
          // интерфейса: локаль кита ставит корень оболочки.
          placeholder={fallbackText(field, i18n)}
          className="h-7 text-[12px]"
          onChange={(event) => {
            const next = event.target.value;
            set(next === '' ? undefined : next);
          }}
        />
      )}
    </Field>
  );
}
