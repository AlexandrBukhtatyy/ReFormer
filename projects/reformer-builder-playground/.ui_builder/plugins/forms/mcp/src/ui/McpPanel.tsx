/**
 * Панель MCP: серверы проекта, их состояние, подключение и значения переменных.
 *
 * Собрана на `@reformer/ui-kit`: статусы — `Badge`, решения — `Button`, значения — `Input` с
 * `Checkbox`, предупреждения — `Alert`, прокрутка — `ScrollArea`. Голого HTML — ровно на
 * раскладку.
 *
 * ## Чего здесь нет
 *
 * Запуска серверов на открытии панели: она показывает то, что знает менеджер, и ничего не будит.
 * Подключается сервер кнопкой или первым обращением модели — так же, как без панели.
 *
 * @module plugins/forms/mcp/ui/McpPanel
 */

import { useState, useSyncExternalStore } from 'react';
import { Alert, AlertDescription } from '@reformer/ui-kit/alert';
import { Badge } from '@reformer/ui-kit/badge';
import { Button } from '@reformer/ui-kit/button';
import { Checkbox } from '@reformer/ui-kit/checkbox';
import { Input } from '@reformer/ui-kit/input';
import { Label } from '@reformer/ui-kit/label';
import { ScrollArea } from '@reformer/ui-kit/scroll-area';
import { literalSecretHeaders } from '../config/interpolate';
import type { McpManager, ServerStatus, ServerView } from '../connection/manager';
import type { McpHost, Translate } from '../host';

/** Высота кнопок и полей — как у соседних панелей дока. */
const CONTROL_CLASS = 'h-7 text-[12px]';

export interface McpPanelProps {
  readonly host: McpHost;
  readonly manager: McpManager;
}

export function McpPanel({ host, manager }: McpPanelProps) {
  const t = host.useTranslate();
  const snapshot = useSyncExternalStore(manager.subscribe, manager.snapshot);

  return (
    <ScrollArea className="h-full">
      <div className="flex flex-col gap-3 p-3 text-[12px]">
        <p className="text-muted-foreground" data-testid="mcp-live-workers">
          {t('panel.live', { live: snapshot.liveWorkers, max: snapshot.maxLive })}
        </p>
        {snapshot.servers.length === 0 ? (
          <p className="text-muted-foreground">{t('panel.empty')}</p>
        ) : (
          snapshot.servers.map((view) => (
            <ServerRow key={view.spec.name} view={view} manager={manager} t={t} />
          ))
        )}
        {snapshot.problems.length > 0 && (
          <Alert>
            <AlertDescription>
              <p className="font-medium">{t('problems.title')}</p>
              {snapshot.problems.map((problem) => (
                <p key={problem}>{problem}</p>
              ))}
            </AlertDescription>
          </Alert>
        )}
      </div>
    </ScrollArea>
  );
}

function statusVariant(status: ServerStatus): 'default' | 'secondary' | 'destructive' | 'outline' {
  switch (status.kind) {
    case 'running':
      return 'default';
    case 'error':
      return 'destructive';
    case 'unavailable':
    case 'needs-values':
      return 'outline';
    default:
      return 'secondary';
  }
}

function statusDetail(status: ServerStatus, t: Translate): string | null {
  if (status.kind === 'unavailable') {
    const reason = t(`reason.${status.reason}`);
    return status.detail === undefined ? reason : `${reason}: ${status.detail}`;
  }
  if (status.kind === 'error')
    return status.halted ? `${status.message} ${t('error.halted')}` : status.message;
  return null;
}

function ServerRow({ view, manager, t }: { view: ServerView; manager: McpManager; t: Translate }) {
  const [showTools, setShowTools] = useState(false);
  const { spec, status } = view;
  const name = spec.name;
  const detail = statusDetail(status, t);
  const canStart = status.kind === 'idle' || status.kind === 'asleep';
  const literal = spec.kind === 'http' || spec.kind === 'sse' ? literalSecretHeaders(spec) : [];

  return (
    <div className="flex flex-col gap-1.5 rounded-md border p-2" data-testid={`mcp-server-${name}`}>
      <div className="flex flex-wrap items-center gap-1.5">
        <span className="font-medium">{name}</span>
        <Badge variant="outline">{t(`source.${spec.kind}`)}</Badge>
        <Badge variant={statusVariant(status)} data-testid={`mcp-status-${name}`}>
          {t(`status.${status.kind}`)}
        </Badge>
        {view.tools !== undefined && (
          <span className="text-muted-foreground">
            {t('tools.count', { count: view.tools.length })}
          </span>
        )}
      </div>

      {detail !== null && <p className="text-muted-foreground">{detail}</p>}
      {view.notes.map((note) => (
        <p key={note} className="text-muted-foreground">
          {note}
        </p>
      ))}
      {literal.map((header) => (
        <Alert key={header} variant="destructive">
          <AlertDescription>{t('warning.literal-secret', { header })}</AlertDescription>
        </Alert>
      ))}

      {view.variables.map((variable) => (
        <VariableInput
          key={variable.name}
          name={variable.name}
          set={variable.set}
          manager={manager}
          t={t}
        />
      ))}

      <div className="flex flex-wrap gap-1.5">
        {canStart && (
          <Button size="xs" variant="outline" onClick={() => void manager.connect(name)}>
            {t('action.connect')}
          </Button>
        )}
        {status.kind === 'error' && (
          <Button size="xs" variant="outline" onClick={() => void manager.reconnect(name)}>
            {t('action.reconnect')}
          </Button>
        )}
        {status.kind === 'running' && (
          <Button size="xs" variant="ghost" onClick={() => void manager.sleep(name)}>
            {t('action.sleep')}
          </Button>
        )}
        {view.tools !== undefined && view.tools.length > 0 && (
          <Button size="xs" variant="ghost" onClick={() => setShowTools((shown) => !shown)}>
            {t('tools.show')}
          </Button>
        )}
      </div>

      {showTools && view.tools !== undefined && (
        <ul className="flex flex-col gap-0.5 pl-3 text-muted-foreground">
          {view.tools.map((tool) => (
            <li key={tool.name}>{tool.name}</li>
          ))}
        </ul>
      )}
    </div>
  );
}

function VariableInput({
  name,
  set,
  manager,
  t,
}: {
  name: string;
  set: boolean;
  manager: McpManager;
  t: Translate;
}) {
  const [value, setValue] = useState('');
  const [remember, setRemember] = useState(false);
  const inputId = `mcp-variable-${name}`;

  return (
    <div className="flex flex-col gap-1">
      <Label htmlFor={inputId} className="text-[12px]">
        {name}
        {set && <span className="text-muted-foreground"> — {t('variable.set')}</span>}
      </Label>
      <div className="flex items-center gap-1.5">
        <Input
          id={inputId}
          type="password"
          autoComplete="off"
          className={CONTROL_CLASS}
          placeholder={t('variable.placeholder', { name })}
          value={value}
          onChange={(event) => setValue(event.target.value)}
        />
        <Button
          size="xs"
          // Пустое значение менеджер понимает как «забыть»: кнопкой «Сохранить» его не стереть.
          disabled={value === ''}
          onClick={() => {
            void manager.setVariable(name, value, { persist: remember }).then(() => setValue(''));
          }}
        >
          {t('action.save')}
        </Button>
      </div>
      <div className="flex items-center gap-1.5" title={t('variable.remember.hint')}>
        <Checkbox
          id={`${inputId}-remember`}
          checked={remember}
          onCheckedChange={(checked) => setRemember(checked === true)}
        />
        <Label htmlFor={`${inputId}-remember`} className="text-[12px] text-muted-foreground">
          {t('variable.remember')}
        </Label>
      </div>
    </div>
  );
}
