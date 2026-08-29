/**
 * Панель шаблонов: список по видам, создание формы по выбранному шаблону и сохранение
 * каталога открытой формы в шаблон.
 *
 * Собрана на `@reformer/ui-kit`: список — `Item`, вид — `Badge`, решения — `Button`, ввод —
 * `Input` с `Label`, исход — `Alert`, прокрутка — `ScrollArea`. Голый HTML остался только на
 * раскладке колонок.
 *
 * Список перечитывается по требованию, а не подпиской: хранилища ходят в источник и в браузер,
 * и обновлять их на каждый кадр было бы обходом файловой системы за кадр. Перечитывание
 * вызывают три события — открытие панели, смена кита и завершение операции записи.
 *
 * @module plugins/templates/ui/TemplatesPanel
 */

import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { Alert, AlertDescription } from '@reformer/ui-kit/alert';
import { Badge } from '@reformer/ui-kit/badge';
import { Button } from '@reformer/ui-kit/button';
import { Input } from '@reformer/ui-kit/input';
import { Item, ItemActions, ItemContent, ItemDescription, ItemTitle } from '@reformer/ui-kit/item';
import { Label } from '@reformer/ui-kit/label';
import { ScrollArea } from '@reformer/ui-kit/scroll-area';
import { Separator } from '@reformer/ui-kit/separator';
import { canRemove, type FormTemplate, type TemplateStore } from '../contract';
import type { TemplatesHost, Translate } from '../host';
import {
  generateFormFromTemplate,
  listTemplates,
  removeTemplate,
  SOURCE_ORDER,
  storeOf,
  type OperationResult,
} from '../operations';

export interface TemplatesPanelProps {
  readonly host: TemplatesHost;
  /** Хранилища читаются лениво: их вносят и снимают, в том числе чужие плагины. */
  readonly stores: () => readonly TemplateStore[];
}

export function TemplatesPanel({ host, stores }: TemplatesPanelProps): ReactNode {
  const t = host.useTranslate();
  const documentId = host.useActiveDocument();

  const [templates, setTemplates] = useState<readonly FormTemplate[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [formName, setFormName] = useState('');
  const [result, setResult] = useState<OperationResult | null>(null);

  const reload = useCallback(() => {
    void listTemplates(stores()).then(setTemplates);
  }, [stores]);

  useEffect(() => {
    reload();
    // Кит меняет ВЫВОД встроенных шаблонов: они печатаются кодогеном под активный кит,
    // поэтому список после переключения кита обязан перечитаться.
    const subscription = host.onDidChangeKit(reload);
    return () => {
      subscription.dispose();
    };
  }, [host, reload]);

  const current = templates.find((template) => template.id === selected) ?? null;

  const generate = useCallback(() => {
    if (current === null || documentId === null) return;
    void generateFormFromTemplate(
      host,
      host.parentOf(documentId),
      formName,
      current,
      current.files.map((file) => file.path)
    ).then((outcome) => {
      setResult(outcome);
      if (outcome.ok && outcome.openId !== null) host.openResource?.(outcome.openId);
      reload();
    });
  }, [current, documentId, formName, host, reload]);

  const drop = useCallback(
    (template: FormTemplate) => {
      const store = storeOf(stores(), template.source);
      if (store === null) return;
      void removeTemplate(store, template).then((outcome) => {
        setResult(outcome);
        reload();
      });
    },
    [stores, reload]
  );

  return (
    <div className="flex h-full min-h-0 flex-col gap-3 p-3">
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="templates-form-name">{t('form.name')}</Label>
        <Input
          id="templates-form-name"
          data-testid="input-formName"
          value={formName}
          onChange={(event) => setFormName(event.target.value)}
        />
      </div>

      <div className="flex gap-2">
        <Button
          size="sm"
          disabled={current === null || documentId === null}
          onClick={generate}
          data-testid="button-generate"
        >
          {t('action.generate')}
        </Button>
        <Button size="sm" variant="outline" onClick={reload}>
          {t('action.refresh')}
        </Button>
      </div>

      {documentId === null ? (
        <span className="text-muted-foreground text-[11px]">{t('empty.no-document.detail')}</span>
      ) : null}

      {result === null ? null : (
        <Alert variant={result.ok ? 'default' : 'destructive'}>
          <AlertDescription>{t(result.messageKey, result.params)}</AlertDescription>
        </Alert>
      )}

      <Separator />

      <ScrollArea className="min-h-0 flex-1">
        <TemplateList
          templates={templates}
          selected={selected}
          stores={stores}
          t={t}
          onSelect={setSelected}
          onRemove={drop}
        />
      </ScrollArea>
    </div>
  );
}

interface TemplateListProps {
  readonly templates: readonly FormTemplate[];
  readonly selected: string | null;
  readonly stores: () => readonly TemplateStore[];
  readonly t: Translate;
  readonly onSelect: (id: string) => void;
  readonly onRemove: (template: FormTemplate) => void;
}

function TemplateList({
  templates,
  selected,
  stores,
  t,
  onSelect,
  onRemove,
}: TemplateListProps): ReactNode {
  if (templates.length === 0) {
    return (
      <div className="flex h-full items-center justify-center p-6">
        <div className="border-border max-w-sm rounded-md border border-dashed p-4 text-center">
          <div className="text-foreground text-[13px] font-medium">{t('empty.none')}</div>
          <div className="text-muted-foreground mt-1 text-[12px]">{t('empty.none.detail')}</div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {SOURCE_ORDER.map((source) => {
        const group = templates.filter((template) => template.source === source);
        if (group.length === 0) return null;
        const store = storeOf(stores(), source);
        const removable = store !== null && canRemove(store);
        return (
          <section key={source} className="flex flex-col gap-1">
            <h3 className="text-muted-foreground text-[11px] font-semibold uppercase">
              {t(`group.${source}`)}
            </h3>
            {group.map((template) => (
              <TemplateRow
                key={`${source}:${template.id}`}
                template={template}
                active={template.id === selected}
                removable={removable}
                t={t}
                onSelect={onSelect}
                onRemove={onRemove}
              />
            ))}
          </section>
        );
      })}
    </div>
  );
}

interface TemplateRowProps {
  readonly template: FormTemplate;
  readonly active: boolean;
  readonly removable: boolean;
  readonly t: Translate;
  readonly onSelect: (id: string) => void;
  readonly onRemove: (template: FormTemplate) => void;
}

function TemplateRow({
  template,
  active,
  removable,
  t,
  onSelect,
  onRemove,
}: TemplateRowProps): ReactNode {
  return (
    <Item
      size="sm"
      variant={active ? 'outline' : 'muted'}
      // Строка выбирается щелчком: `Item` кита — презентационный компонент, роли кнопки
      // он не несёт, поэтому её приходится объявлять здесь.
      role="button"
      tabIndex={0}
      aria-pressed={active}
      onClick={() => onSelect(template.id)}
      onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') onSelect(template.id);
      }}
    >
      <ItemContent>
        <ItemTitle>{template.name}</ItemTitle>
        <ItemDescription>
          {template.description ?? t('template.files', { count: template.files.length })}
        </ItemDescription>
      </ItemContent>
      <ItemActions>
        <Badge variant="secondary">{t(`source.${template.source}`)}</Badge>
        {removable ? (
          <Button
            size="sm"
            variant="ghost"
            onClick={(event) => {
              event.stopPropagation();
              onRemove(template);
            }}
          >
            {t('action.remove')}
          </Button>
        ) : null}
      </ItemActions>
    </Item>
  );
}
