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
 * ## Пояснения — в тултипах у подписей
 *
 * Панель узкая, а пояснения длиннее самих полей и нужны не при каждом открытии. Поэтому они
 * спрятаны в `InfoHint` рядом с подписью поля, а не стоят абзацами под ним.
 *
 * Собрано на `@reformer/ui-kit`: `Select`, `Input`, `Label`, `InfoHint`, `Checkbox`, `Button`,
 * `Alert`, `Spinner`, `Separator`.
 *
 * @module plugins/forms/ai/ui/ProviderSettings
 */

import { useEffect, useState, type ReactElement } from 'react';
import { Alert, AlertDescription } from '@reformer/ui-kit/alert';
import { Button } from '@reformer/ui-kit/button';
import { Checkbox } from '@reformer/ui-kit/checkbox';
import { InfoHint } from '@reformer/ui-kit/info-hint';
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
  type EditMode,
  type ReasoningLevel,
  type ProviderConfig,
  type ProviderKind,
} from '../session/config';
import type { Translate } from '../host';
import type { AiAssistant } from '../plugin';
import { modelsErrorText } from './models-error';

const KINDS: readonly ProviderKind[] = ['anthropic', 'openai', 'openai-compatible'];

const EDIT_MODES: readonly EditMode[] = ['structured', 'files'];
const REASONING_LEVELS: readonly ReasoningLevel[] = ['default', 'off', 'low', 'medium', 'high'];

/** Ключ пояснения о том, куда уходит запрос: пользователь должен это видеть, а не догадываться. */
const ORIGIN_KEY: Record<'browser' | 'loopback', string> = {
  browser: 'settings.origin.browser',
  loopback: 'settings.origin.loopback',
};

/** id скрытого дубля подсказки — на него ссылается `aria-describedby` контрола. */
const hintIdOf = (controlId: string): string => `${controlId}-hint`;

/**
 * Подпись поля со значком подсказки.
 *
 * Значок стоит вне `Label`: внутри подписи щелчок по нему уводил бы фокус в поле. Контрол
 * ссылается на текст подсказки через `aria-describedby={hintIdOf(controlId)}`: сам тултип
 * живёт в портале и в DOM появляется, только пока открыт.
 */
function FieldLabel({
  controlId,
  label,
  hint,
  t,
}: {
  controlId: string;
  label: string;
  hint: string;
  t: Translate;
}): ReactElement {
  return (
    <div className="flex items-center gap-1">
      <Label htmlFor={controlId} className="text-muted-foreground text-[11.5px]">
        {label}
      </Label>
      <InfoHint
        content={hint}
        descriptionId={hintIdOf(controlId)}
        aria-label={t('settings.hint', { label })}
      />
    </div>
  );
}

export interface ProviderSettingsProps {
  readonly assistant: AiAssistant;
  readonly t: Translate;
  /** Канал настроен и подключён. */
  readonly onConnected: () => void;
  /**
   * Подключение сменило режим правки. Панель начинает новый разговор: «Восстановить» на реплике
   * откатывает ход тем способом, каким он писал, и разговор вперемешку из ходов двух режимов
   * откатывался бы по-разному в зависимости от того, до какой реплики.
   */
  readonly onModeChanged?: () => void;
  /**
   * Идёт ход ассистента. Подключение тогда недоступно: новый канал или режим начинают новый
   * разговор, а обрыв ленты посреди хода оставил бы его реплику без места, куда писать.
   */
  readonly turnRunning?: boolean;
}

/** Форма настройки канала. */
export function ProviderSettings({
  assistant,
  t,
  onConnected,
  onModeChanged,
  turnRunning = false,
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
  const [editMode, setEditMode] = useState<EditMode>('structured');
  // Режим, с которым канал подключён сейчас: с ним сравнивается выбранный при подключении.
  const [savedMode, setSavedMode] = useState<EditMode>('structured');
  const [reasoning, setReasoning] = useState<ReasoningLevel>('default');
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
      setEditMode(stored.editMode ?? 'structured');
      setSavedMode(stored.editMode ?? 'structured');
      setReasoning(stored.reasoning ?? 'default');
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
    // Режим по умолчанию не записывается: отсутствие поля и есть structured.
    ...(editMode === 'files' ? { editMode } : {}),
    // Как и режим: значение по умолчанию не записывается.
    ...(reasoning !== 'default' ? { reasoning } : {}),
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
      setError(modelsErrorText(cause, kind, window.location.origin, t));
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
      if (editMode !== savedMode) {
        setSavedMode(editMode);
        onModeChanged?.();
      }
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
        {/* Куда уходит запрос, зависит от провайдера — поэтому пояснение висит на его подписи. */}
        <FieldLabel
          controlId="ai-provider"
          label={t('settings.provider')}
          hint={t(ORIGIN_KEY[PROVIDER_ORIGIN[kind]])}
          t={t}
        />
        <Select
          value={kind}
          onValueChange={(value) => {
            setKind(value as ProviderKind);
            setModels([]);
            setModel('');
          }}
        >
          <SelectTrigger
            id="ai-provider"
            aria-describedby={hintIdOf('ai-provider')}
            size="sm"
            className="w-full"
          >
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
            aria-describedby={hintIdOf('ai-remember-key')}
            checked={rememberKey}
            onCheckedChange={(value) => {
              setRememberKey(value === true);
            }}
          />
          <FieldLabel
            controlId="ai-remember-key"
            label={t('settings.rememberKey')}
            hint={t('settings.rememberKey.hint')}
            t={t}
          />
        </div>
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

      <div className="space-y-1.5">
        <FieldLabel
          controlId="ai-edit-mode"
          label={t('settings.mode')}
          hint={t('settings.mode.hint')}
          t={t}
        />
        <Select
          value={editMode}
          onValueChange={(value) => {
            setEditMode(value as EditMode);
          }}
        >
          <SelectTrigger
            id="ai-edit-mode"
            aria-describedby={hintIdOf('ai-edit-mode')}
            size="sm"
            className="w-full"
          >
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {EDIT_MODES.map((item) => (
              <SelectItem key={item} value={item}>
                {t(`settings.mode.${item}`)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {kind !== 'anthropic' && (
        <div className="space-y-1.5">
          <FieldLabel
            controlId="ai-reasoning"
            label={t('settings.reasoning')}
            hint={t('settings.reasoning.hint')}
            t={t}
          />
          <Select
            value={reasoning}
            onValueChange={(value) => {
              setReasoning(value as ReasoningLevel);
            }}
          >
            <SelectTrigger
              id="ai-reasoning"
              aria-describedby={hintIdOf('ai-reasoning')}
              size="sm"
              className="w-full"
            >
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {REASONING_LEVELS.map((item) => (
                <SelectItem key={item} value={item}>
                  {t(`settings.reasoning.${item}`)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      {/* Пояснение к пределам общее для трёх полей и висит на каждом: тултип читают у того поля,
          которое заполняют, и искать его у соседнего никто не станет. */}
      <div className="grid grid-cols-2 gap-2">
        <div className="space-y-1.5">
          <FieldLabel
            controlId="ai-max-steps"
            label={t('settings.maxSteps')}
            hint={t('settings.limits.hint')}
            t={t}
          />
          <Input
            id="ai-max-steps"
            aria-describedby={hintIdOf('ai-max-steps')}
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
          <FieldLabel
            controlId="ai-max-output"
            label={t('settings.maxOutput')}
            hint={t('settings.limits.hint')}
            t={t}
          />
          <Input
            id="ai-max-output"
            aria-describedby={hintIdOf('ai-max-output')}
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
        <FieldLabel
          controlId="ai-max-input"
          label={t('settings.maxInput')}
          hint={t('settings.limits.hint')}
          t={t}
        />
        <Input
          id="ai-max-input"
          aria-describedby={hintIdOf('ai-max-input')}
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

      {error !== null && (
        <Alert variant="destructive">
          <AlertDescription className="text-[11.5px] leading-4">{error}</AlertDescription>
        </Alert>
      )}

      {turnRunning && (
        <p className="text-muted-foreground text-[11px] leading-4">{t('settings.busy')}</p>
      )}

      <div className="flex gap-2">
        <Button
          size="sm"
          className="flex-1"
          disabled={busy || turnRunning || model === ''}
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
