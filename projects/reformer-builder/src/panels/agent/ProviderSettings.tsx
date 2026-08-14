/**
 * Настройка канала к модели: провайдер, ключ, модель.
 *
 * Список моделей запрашивается у провайдера, а не вшит: вшитый устаревает молча — пользователь
 * видит выбор, которого уже нет.
 *
 * Собрано на `@reformer/ui-kit`, как остальные панели билдера: фокус-кольца, тёмная тема и
 * состояния disabled приходят из кита, а не переписываются здесь заново.
 *
 * @module reformer-builder/panels/agent/ProviderSettings
 */

import { useState } from 'react';
import { Button, Input } from '@reformer/ui-kit';
import { Alert, AlertDescription } from '@reformer/ui-kit/alert';
import { Label } from '@reformer/ui-kit/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@reformer/ui-kit/select';
import { Spinner } from '@reformer/ui-kit/spinner';
import {
  clearProviderConfig,
  DEFAULT_LOCAL_BASE_URL,
  limitsFrom,
  loadProviderConfig,
  PROVIDER_LABEL,
  PROVIDER_ORIGIN,
  saveProviderConfig,
  type ProviderConfig,
  type ProviderKind,
} from '../../agent/keys';
import { activateProvider, fetchModels } from '../../agent/providers/load';
import { resetProviders } from '../../agent/providers/registry';

const KINDS: ProviderKind[] = ['anthropic', 'openai', 'openai-compatible'];

/** Куда уходит текст запроса — пользователь должен это видеть, а не догадываться. */
const ORIGIN_NOTE: Record<'browser' | 'loopback', string> = {
  browser:
    'Запросы идут из браузера напрямую к провайдеру. Ключ хранится в этом браузере и доступен странице — используйте ключ с ограниченным бюджетом.',
  loopback: 'Запросы идут на локальный сервер и наружу не уходят.',
};

/** Свойства формы настроек. */
export interface ProviderSettingsProps {
  /** Канал настроен и подключён. */
  onConnected: () => void;
}

/** Форма настройки канала. */
export function ProviderSettings({ onConnected }: ProviderSettingsProps) {
  const stored = loadProviderConfig();
  const [kind, setKind] = useState<ProviderKind>(stored?.kind ?? 'anthropic');
  const [apiKey, setApiKey] = useState(stored?.apiKey ?? '');
  const [baseUrl, setBaseUrl] = useState(stored?.baseUrl ?? DEFAULT_LOCAL_BASE_URL);
  const [models, setModels] = useState<string[]>([]);
  const [model, setModel] = useState(stored?.model ?? '');
  // Строкой, а не числом: пустое поле означает «без предела», и приводить его к 0 нельзя.
  const [maxOutputTokens, setMaxOutputTokens] = useState(
    stored?.maxOutputTokens ? String(stored.maxOutputTokens) : ''
  );
  const [maxSteps, setMaxSteps] = useState(stored?.maxSteps ? String(stored.maxSteps) : '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const config = (): ProviderConfig => ({
    kind,
    ...(apiKey ? { apiKey } : {}),
    ...(kind === 'openai-compatible' ? { baseUrl } : {}),
    ...(model ? { model } : {}),
    ...limitsFrom(maxSteps, maxOutputTokens),
  });

  const loadModels = async () => {
    setBusy(true);
    setError(null);
    try {
      const list = await fetchModels(config());
      setModels(list);
      if (list.length && !list.includes(model)) setModel(list[0]);
      if (!list.length) setError('Провайдер вернул пустой список моделей.');
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setModels([]);
    } finally {
      setBusy(false);
    }
  };

  const connect = async () => {
    setBusy(true);
    setError(null);
    try {
      const next = config();
      await activateProvider(next);
      saveProviderConfig(next);
      onConnected();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  const forget = () => {
    clearProviderConfig();
    resetProviders();
    setApiKey('');
    setModel('');
    setModels([]);
  };

  return (
    <div className="space-y-3 px-3 py-3">
      <div className="space-y-1.5">
        <Label htmlFor="rb-agent-provider" className="text-[11.5px] text-muted-foreground">
          Провайдер
        </Label>
        <Select
          value={kind}
          onValueChange={(value) => {
            setKind(value as ProviderKind);
            setModels([]);
            setModel('');
          }}
        >
          <SelectTrigger id="rb-agent-provider" size="sm" className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {KINDS.map((k) => (
              <SelectItem key={k} value={k}>
                {PROVIDER_LABEL[k]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {kind === 'openai-compatible' && (
        <div className="space-y-1.5">
          <Label htmlFor="rb-agent-base-url" className="text-[11.5px] text-muted-foreground">
            Адрес сервера
          </Label>
          <Input
            id="rb-agent-base-url"
            value={baseUrl}
            onChange={(e) => setBaseUrl(e.target.value)}
            onKeyDown={(e) => e.stopPropagation()}
            placeholder={DEFAULT_LOCAL_BASE_URL}
            className="h-8"
          />
        </div>
      )}

      <div className="space-y-1.5">
        <Label htmlFor="rb-agent-key" className="text-[11.5px] text-muted-foreground">
          Ключ API{kind === 'openai-compatible' ? ' (обычно не нужен)' : ''}
        </Label>
        <Input
          id="rb-agent-key"
          type="password"
          value={apiKey}
          onChange={(e) => setApiKey(e.target.value)}
          onKeyDown={(e) => e.stopPropagation()}
          autoComplete="off"
          placeholder="sk-…"
          className="h-8"
        />
      </div>

      <Button variant="outline" size="sm" className="w-full" onClick={loadModels} disabled={busy}>
        {busy && <Spinner className="size-3.5" />}
        Загрузить список моделей
      </Button>

      {models.length > 0 && (
        <div className="space-y-1.5">
          <Label htmlFor="rb-agent-model" className="text-[11.5px] text-muted-foreground">
            Модель
          </Label>
          <Select value={model} onValueChange={setModel}>
            <SelectTrigger id="rb-agent-model" size="sm" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {models.map((m) => (
                <SelectItem key={m} value={m}>
                  {m}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      <div className="grid grid-cols-2 gap-2">
        <div className="space-y-1.5">
          <Label htmlFor="rb-agent-max-steps" className="text-[11.5px] text-muted-foreground">
            Шагов за ход
          </Label>
          <Input
            id="rb-agent-max-steps"
            type="number"
            min={1}
            value={maxSteps}
            onChange={(e) => setMaxSteps(e.target.value)}
            onKeyDown={(e) => e.stopPropagation()}
            placeholder="без предела"
            className="h-8"
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="rb-agent-max-output" className="text-[11.5px] text-muted-foreground">
            Ответ за шаг, токенов
          </Label>
          <Input
            id="rb-agent-max-output"
            type="number"
            min={256}
            value={maxOutputTokens}
            onChange={(e) => setMaxOutputTokens(e.target.value)}
            onKeyDown={(e) => e.stopPropagation()}
            placeholder="без предела"
            className="h-8"
          />
        </div>
      </div>
      <p className="text-[11px] leading-4 text-muted-foreground">
        Пустые поля — без ограничений. Предел шагов страхует от зацикливания на платных каналах, но
        обрывает ход на середине формы, если его занизить.
      </p>

      {error && (
        <Alert variant="destructive">
          <AlertDescription className="text-[11.5px] leading-4">{error}</AlertDescription>
        </Alert>
      )}

      <p className="text-[11px] leading-4 text-muted-foreground">
        {ORIGIN_NOTE[PROVIDER_ORIGIN[kind]]}
      </p>

      <div className="flex gap-2">
        <Button size="sm" className="flex-1" onClick={connect} disabled={busy || !model}>
          Подключить
        </Button>
        <Button variant="outline" size="sm" onClick={forget}>
          Забыть ключ
        </Button>
      </div>
    </div>
  );
}
