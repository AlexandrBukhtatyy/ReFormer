/**
 * Настройка канала к модели: провайдер, ключ, модель, пределы хода.
 *
 * ## Ключ отделён от настроек — и это главное, ради чего форма переписана
 *
 * В v1 весь объект вместе с ключом уходил одной записью в `localStorage`. Здесь настройки идут
 * в `PluginStorage`, а ключ — в `SecretStorage`, и по умолчанию он живёт только память сессии.
 * Галочка «запомнить ключ» — единственный способ положить его на диск, и она снята по
 * умолчанию: цена ошибки несимметрична. Забытый в памяти ключ стоит одного повторного ввода,
 * забытый на диске живёт до тех пор, пока о нём не вспомнят.
 *
 * Разделение выражено типами (`ProviderSettings` против `ProviderConfig`), а не дисциплиной:
 * в хранилище кладётся тип БЕЗ поля ключа, поэтому «случайно сохранить вместе» здесь нельзя.
 *
 * ## Список моделей запрашивается, а не вшит
 *
 * Вшитый устаревает молча — пользователь видит выбор, которого уже нет.
 *
 * Собрано на `@reformer/ui-kit`: `Select`, `Input`, `Label`, `Checkbox`, `Button`, `Alert`,
 * `Spinner`, `Separator`.
 *
 * @module plugins/ai/ui/ProviderSettings
 */

import { useEffect, useState, type ReactElement } from 'react';
import { Alert, AlertDescription } from '@reformer/ui-kit/alert';
import { Button } from '@reformer/ui-kit/button';
import { Checkbox } from '@reformer/ui-kit/checkbox';
import { Input } from '@reformer/ui-kit/input';
import { Label } from '@reformer/ui-kit/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@reformer/ui-kit/select';
import { Separator } from '@reformer/ui-kit/separator';
import { Spinner } from '@reformer/ui-kit/spinner';
import {
  DEFAULT_LOCAL_BASE_URL,
  limitsFrom,
  PROVIDER_LABEL_KEY,
  PROVIDER_ORIGIN,
  type ProviderConfig,
  type ProviderKind,
} from '../config';
import type { Translate } from '../host';
import type { AiAssistant } from '../plugin';

const KINDS: readonly ProviderKind[] = ['anthropic', 'openai', 'openai-compatible'];

/** Ключ пояснения о том, куда уходит запрос: пользователь должен это видеть, а не догадываться. */
const ORIGIN_KEY: Record<'browser' | 'loopback', string> = {
  browser: 'settings.origin.browser',
  loopback: 'settings.origin.loopback',
};

export interface ProviderSettingsProps {
  readonly assistant: AiAssistant;
  readonly t: Translate;
  /** Канал настроен и подключён. */
  readonly onConnected: () => void;
}

/** Форма настройки канала. */
export function ProviderSettings({
  assistant,
  t,
  onConnected,
}: ProviderSettingsProps): ReactElement {
  const [kind, setKind] = useState<ProviderKind>('anthropic');
  const [apiKey, setApiKey] = useState('');
  const [rememberKey, setRememberKey] = useState(false);
  const [baseUrl, setBaseUrl] = useState(DEFAULT_LOCAL_BASE_URL);
  const [models, setModels] = useState<readonly string[]>([]);
  const [model, setModel] = useState('');
  // Строками, а не числами: пустое поле означает «без предела», и приводить его к нулю нельзя —
  // ноль шагов остановил бы ход, не начав его.
  const [maxSteps, setMaxSteps] = useState('');
  const [maxOutputTokens, setMaxOutputTokens] = useState('');
  const [maxInputTokens, setMaxInputTokens] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Настройки читаются асинхронно (IndexedDB), поэтому форма открывается пустой и
  // дозаполняется. Показывать спиннер вместо полей не за что: чтение локальное и мгновенное.
  useEffect(() => {
    let alive = true;
    void assistant.loadConfig().then((stored) => {
      if (!alive || stored === null) return;
      setKind(stored.kind);
      if (stored.apiKey !== undefined) setApiKey(stored.apiKey);
      if (stored.baseUrl !== undefined) setBaseUrl(stored.baseUrl);
      if (stored.model !== undefined) setModel(stored.model);
      if (stored.maxSteps !== undefined) setMaxSteps(String(stored.maxSteps));
      if (stored.maxOutputTokens !== undefined) setMaxOutputTokens(String(stored.maxOutputTokens));
      if (stored.maxInputTokens !== undefined) setMaxInputTokens(String(stored.maxInputTokens));
    });
    return () => {
      alive = false;
    };
  }, [assistant]);

  const config = (): ProviderConfig => ({
    kind,
    ...(apiKey !== '' ? { apiKey } : {}),
    ...(kind === 'openai-compatible' ? { baseUrl } : {}),
    ...(model !== '' ? { model } : {}),
    ...limitsFrom({ maxSteps, maxOutputTokens, maxInputTokens }),
  });

  const loadModels = async (): Promise<void> => {
    setBusy(true);
    setError(null);
    try {
      const list = await assistant.models(config());
      setModels(list);
      if (list.length > 0 && !list.includes(model)) setModel(list[0]);
      if (list.length === 0) setError(t('settings.emptyModels'));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
      setModels([]);
    } finally {
      setBusy(false);
    }
  };

  const connect = async (): Promise<void> => {
    setBusy(true);
    setError(null);
    try {
      const next = config();
      await assistant.activate(next);
      await assistant.saveConfig(next, { persistKey: rememberKey });
      onConnected();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
    } finally {
      setBusy(false);
    }
  };

  const forget = async (): Promise<void> => {
    await assistant.clearConfig();
    setApiKey('');
    setRememberKey(false);
    setModel('');
    setModels([]);
  };

  return (
    <div className="space-y-3 px-3 py-3">
      <div className="space-y-1.5">
        <Label htmlFor="ai-provider" className="text-muted-foreground text-[11.5px]">
          {t('settings.provider')}
        </Label>
        <Select
          value={kind}
          onValueChange={(value) => {
            setKind(value as ProviderKind);
            setModels([]);
            setModel('');
          }}
        >
          <SelectTrigger id="ai-provider" size="sm" className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {KINDS.map((item) => (
              <SelectItem key={item} value={item}>
                {t(PROVIDER_LABEL_KEY[item])}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {kind === 'openai-compatible' && (
        <div className="space-y-1.5">
          <Label htmlFor="ai-base-url" className="text-muted-foreground text-[11.5px]">
            {t('settings.baseUrl')}
          </Label>
          <Input
            id="ai-base-url"
            value={baseUrl}
            onChange={(event) => {
              setBaseUrl(event.target.value);
            }}
            placeholder={DEFAULT_LOCAL_BASE_URL}
            className="h-8"
          />
        </div>
      )}

      <div className="space-y-1.5">
        <Label htmlFor="ai-key" className="text-muted-foreground text-[11.5px]">
          {kind === 'openai-compatible' ? t('settings.apiKey.optional') : t('settings.apiKey')}
        </Label>
        <Input
          id="ai-key"
          type="password"
          value={apiKey}
          onChange={(event) => {
            setApiKey(event.target.value);
          }}
          autoComplete="off"
          className="h-8"
        />
        <div className="flex items-center gap-2">
          <Checkbox
            id="ai-remember-key"
            checked={rememberKey}
            onCheckedChange={(value) => {
              setRememberKey(value === true);
            }}
          />
          <Label htmlFor="ai-remember-key" className="text-muted-foreground text-[11.5px]">
            {t('settings.rememberKey')}
          </Label>
        </div>
        <p className="text-muted-foreground text-[11px] leading-4">
          {t('settings.rememberKey.hint')}
        </p>
      </div>

      <Button
        variant="outline"
        size="sm"
        className="w-full"
        disabled={busy}
        onClick={() => {
          void loadModels();
        }}
      >
        {busy && <Spinner className="size-3.5" />}
        {t('settings.loadModels')}
      </Button>

      {models.length > 0 && (
        <div className="space-y-1.5">
          <Label htmlFor="ai-model" className="text-muted-foreground text-[11.5px]">
            {t('settings.model')}
          </Label>
          <Select value={model} onValueChange={setModel}>
            <SelectTrigger id="ai-model" size="sm" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {models.map((item) => (
                <SelectItem key={item} value={item}>
                  {item}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      <Separator />

      <div className="grid grid-cols-2 gap-2">
        <div className="space-y-1.5">
          <Label htmlFor="ai-max-steps" className="text-muted-foreground text-[11.5px]">
            {t('settings.maxSteps')}
          </Label>
          <Input
            id="ai-max-steps"
            type="number"
            min={1}
            value={maxSteps}
            onChange={(event) => {
              setMaxSteps(event.target.value);
            }}
            placeholder={t('settings.unlimited')}
            className="h-8"
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="ai-max-output" className="text-muted-foreground text-[11.5px]">
            {t('settings.maxOutput')}
          </Label>
          <Input
            id="ai-max-output"
            type="number"
            min={256}
            value={maxOutputTokens}
            onChange={(event) => {
              setMaxOutputTokens(event.target.value);
            }}
            placeholder={t('settings.unlimited')}
            className="h-8"
          />
        </div>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="ai-max-input" className="text-muted-foreground text-[11.5px]">
          {t('settings.maxInput')}
        </Label>
        <Input
          id="ai-max-input"
          type="number"
          min={1000}
          value={maxInputTokens}
          onChange={(event) => {
            setMaxInputTokens(event.target.value);
          }}
          placeholder={t('settings.unlimited')}
          className="h-8"
        />
      </div>

      <p className="text-muted-foreground text-[11px] leading-4">{t('settings.limits.hint')}</p>

      {error !== null && (
        <Alert variant="destructive">
          <AlertDescription className="text-[11.5px] leading-4">{error}</AlertDescription>
        </Alert>
      )}

      <p className="text-muted-foreground text-[11px] leading-4">
        {t(ORIGIN_KEY[PROVIDER_ORIGIN[kind]])}
      </p>

      <div className="flex gap-2">
        <Button
          size="sm"
          className="flex-1"
          disabled={busy || model === ''}
          onClick={() => {
            void connect();
          }}
        >
          {t('settings.connect')}
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={() => {
            void forget();
          }}
        >
          {t('settings.forget')}
        </Button>
      </div>
    </div>
  );
}
