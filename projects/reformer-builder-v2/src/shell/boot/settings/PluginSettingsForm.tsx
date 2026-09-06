/**
 * Форма настроек плагина: его собственная схема, нарисованная рендерером ReFormer.
 *
 * Билдер настраивает плагины своей же машинерией форм — той, которой он строит формы клиента.
 * Отсюда следствие, ради которого это и сделано: настройкам плагина бесплатно достаётся всё,
 * что умеет форма ReFormer — правила видимости, зависимости между полями, валидация, — и ни
 * одного нового вида поля заводить не пришлось.
 *
 * ## Сборка не бросает
 *
 * Схема приходит из кода в проекте пользователя и бывает битой ровно так же, как документ,
 * который правят прямо сейчас. Исключение отсюда уронило бы карточку плагина, и вместо
 * объяснения человек увидел бы пустоту. Поэтому отказ возвращается ДАННЫМИ и показывается
 * словами — тем же правилом, что живёт в сборке превью.
 *
 * ## Начальные значения
 *
 * Модель обязана знать ВСЕ пути, которые называет схема: иначе рендерер пишет «нет form-node
 * для сигнала» и рисует пустоту вместо поля. Поэтому основа — синтез из самой схемы
 * (`@/lib/form-mock`), а сохранённые значения кладутся поверх. Умолчания САМОГО плагина сюда
 * не попадают отдельным слоем: их объявляет плагин через `registerDefault`, и служба настроек
 * уже вернула их в `values`.
 *
 * @module shell/boot/settings/PluginSettingsForm
 */

import { useEffect, useMemo, useRef, type ReactElement } from 'react';
import {
  createJsonForm,
  JsonFormRenderer,
  JsonRendererProvider,
  type JsonForm,
  type JsonFormSchema,
} from '@reformer/renderer-json';
import { buildInitialValues, collectFieldDefaults } from '@/lib/form-mock';
import type { PluginSettingsValues } from '@/shell/platform/services/plugin-settings';
import { buildChromeRegistry } from './chrome-registry';

export interface PluginSettingsFormProps {
  /** Схема плагина. Тип уже сужен композицией — сюда непроверенное не доходит. */
  readonly schema: JsonFormSchema;
  /** Сохранённые значения (уже с умолчаниями плагина поверх — их подставила служба). */
  readonly values: PluginSettingsValues;
  /** Введённое человеком. Зовётся только на настоящее изменение, не на монтирование. */
  readonly onChange: (values: PluginSettingsValues) => void;
  /** Текст отказа сборки. Переводит вызывающий: у формы своего словаря нет. */
  readonly renderFailure: (message: string) => ReactElement;
}

type BuildResult =
  | { readonly ok: true; readonly bundle: JsonForm<Record<string, unknown>> }
  | { readonly ok: false; readonly message: string };

export function PluginSettingsForm({
  schema,
  values,
  onChange,
  renderFailure,
}: PluginSettingsFormProps): ReactElement {
  // Пересборка только на смену схемы: перестроить форму на каждое нажатие клавиши значило бы
  // потерять фокус в поле. Значения после сборки живут в модели, а не в пропе.
  const built = useMemo<BuildResult>(() => {
    try {
      const initial = { ...buildInitialValues(collectFieldDefaults(schema)), ...values };
      const bundle = createJsonForm<Record<string, unknown>>({
        schema,
        registry: buildChromeRegistry(schema),
        initial,
      });
      return { ok: true, bundle };
    } catch (error) {
      return { ok: false, message: error instanceof Error ? error.message : String(error) };
    }
    // `values` намеренно вне зависимостей: они — НАЧАЛЬНЫЕ. Попади они сюда, каждая запись
    // пересобирала бы форму, и поле теряло бы фокус на первом же символе.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [schema]);

  /** Что уже отдано наружу: без этого первая же публикация модели записала бы умолчания. */
  const published = useRef<string | null>(null);

  useEffect(() => {
    if (!built.ok) return undefined;
    published.current = JSON.stringify(built.bundle.model.get());
    // Узел `$` — сигнал модели целиком, и подписка на него есть в рантайме. В ТИПАХ её нет:
    // `ModelGroupSignals` вырезает собственные члены сигнала по `keyof T`, а у формы настроек
    // ключи — это `string`, поэтому вырезается всё. Сужение до конкретной формы данных
    // невозможно: схему приносит плагин. Отсюда минимальное объявление того, чем пользуемся.
    const node = built.bundle.model.$ as unknown as {
      subscribe(listener: () => void): (() => void) | { dispose(): void };
    };
    const stop = node.subscribe(() => {
      const next = built.bundle.model.get();
      const encoded = JSON.stringify(next);
      if (encoded === published.current) return;
      published.current = encoded;
      onChange(next);
    });
    return () => {
      if (typeof stop === 'function') stop();
      else stop.dispose();
    };
  }, [built, onChange]);

  if (!built.ok) return renderFailure(built.message);

  return (
    <JsonRendererProvider settings={{ registry: built.bundle.registry }}>
      <JsonFormRenderer form={built.bundle} />
    </JsonRendererProvider>
  );
}
