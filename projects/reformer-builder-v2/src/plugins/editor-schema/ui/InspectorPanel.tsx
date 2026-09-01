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
 * @module plugins/editor-schema/ui/InspectorPanel
 */

import { type ReactElement } from 'react';
import { Badge } from '@reformer/ui-kit/badge';
import { Checkbox } from '@reformer/ui-kit/checkbox';
import { Empty, EmptyHeader, EmptyTitle } from '@reformer/ui-kit/empty';
import { Input } from '@reformer/ui-kit/input';
import { Label } from '@reformer/ui-kit/label';
import { ScrollArea } from '@reformer/ui-kit/scroll-area';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@reformer/ui-kit/select';
import { Separator } from '@reformer/ui-kit/separator';
import { inspectorModelFor, type InspectorField } from '../palette/inspector-model';
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
          <Field label={t('inspector.binding')} hint={t('inspector.binding.hint')}>
            <Input
              value={inspector.binding ?? ''}
              className="h-7 font-mono text-[12px]"
              onChange={(event) => {
                session.apply(setBindingOp(inspector.nodeId, event.target.value));
              }}
            />
          </Field>
        )}

        {inspector.text !== null &&
          (inspector.text.editable ? (
            <Field label={t('inspector.text')} hint={t('inspector.text.hint')}>
              <Input
                value={inspector.text.value}
                className="h-7 text-[12px]"
                onChange={(event) => {
                  session.apply(setTextOp(inspector.nodeId, event.target.value));
                }}
              />
            </Field>
          ) : (
            // Несколько текстовых частей: показываем содержимое, но не притворяемся, что
            // знаем, какую из них человек имел в виду.
            <Field label={t('inspector.text')} hint={t('inspector.readonly')}>
              <Input value={inspector.text.value} readOnly className="h-7 text-[12px]" />
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
            {section.fields.map((field) => (
              <PropField
                key={field.key}
                field={field}
                nodeId={inspector.nodeId}
                session={session}
                t={t}
              />
            ))}
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

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: ReactElement;
}): ReactElement {
  return (
    <div className="flex flex-col gap-1">
      <Label className="text-[11px]">{label}</Label>
      {children}
      {hint !== undefined && <span className="text-muted-foreground text-[10px]">{hint}</span>}
    </div>
  );
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
  const set = (value: unknown): void => {
    session.apply(setPropOp(nodeId, field.key, value));
  };

  if (field.editor === 'checkbox') {
    return (
      <div className="flex items-center gap-2">
        <Checkbox
          id={`prop-${field.key}`}
          checked={field.value === true}
          onCheckedChange={(checked) => {
            set(checked === true ? true : undefined);
          }}
        />
        <Label htmlFor={`prop-${field.key}`} className="text-[11px]">
          {field.label}
        </Label>
      </div>
    );
  }

  if (field.editor === 'select') {
    const options = field.options ?? [];
    return (
      <Field label={field.label} hint={field.description}>
        <Select
          value={field.value === undefined ? undefined : String(field.value)}
          onValueChange={(next) => {
            // Тип возвращается тот же, что в каталоге: `enum` числами обязан остаться числами,
            // иначе схема перестанет проходить валидацию собственного кита.
            const original = options.find((option) => String(option) === next);
            set(original ?? next);
          }}
        >
          <SelectTrigger size="sm" className="text-[12px]">
            <SelectValue placeholder={t('inspector.unset')} />
          </SelectTrigger>
          <SelectContent>
            {options.map((option) => (
              <SelectItem key={String(option)} value={String(option)} className="text-[12px]">
                {String(option)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </Field>
    );
  }

  if (field.editor === 'number') {
    return (
      <Field label={field.label} hint={field.description}>
        <Input
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
      </Field>
    );
  }

  if (field.editor === 'readonly') {
    return (
      <Field label={field.label} hint={t('inspector.readonly')}>
        <Input
          readOnly
          value={field.value === undefined ? '' : JSON.stringify(field.value)}
          className="h-7 font-mono text-[12px]"
        />
      </Field>
    );
  }

  return (
    <Field label={field.label} hint={field.description}>
      <Input
        value={typeof field.value === 'string' ? field.value : ''}
        className="h-7 text-[12px]"
        onChange={(event) => {
          const next = event.target.value;
          set(next === '' ? undefined : next);
        }}
      />
    </Field>
  );
}
