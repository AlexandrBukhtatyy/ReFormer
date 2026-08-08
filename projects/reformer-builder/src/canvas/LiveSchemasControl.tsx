/**
 * Тумблер «Схемы формы» в панели действий Renderer'а: включает исполнение `.ts` каталога формы
 * и даёт пересобрать их вручную.
 *
 * Панель действий висит поверх холста, поэтому статус здесь выражен САМОЙ кнопкой (цвет + подсказка),
 * а не строкой бейджей рядом: что именно подключилось и что не собралось — во вкладке «Форма»
 * (разделы «Сборка» и «Поля»), где на это есть место.
 *
 * Первое включение за сессию спрашивает подтверждение: код формы исполняется в главном потоке с
 * правами приложения (сендбокс невозможен — он разорвал бы единый инстанс signals, см.
 * `preview-runtime/live/link`). Дальше в этой сессии не переспрашиваем.
 *
 * @module reformer-builder/canvas/LiveSchemasControl
 */

import { useSyncExternalStore } from 'react';
import { Loader2, RefreshCw, Zap } from 'lucide-react';
import { toast } from '@reformer/ui-kit/sonner';
import { editorActions, useUi, type TabState } from '../store';
import { getLiveState, subscribeLiveState } from '../preview-runtime/live-state';
import { reloadLiveForm } from './useLiveForm';
import { cn } from '../lib/cn';

/** Подтверждение исполнения кода — один раз за сессию. */
let executionApproved = false;

export function LiveSchemasControl({ tab }: { tab: TabState | null }) {
  const ui = useUi();
  const live = useSyncExternalStore(subscribeLiveState, getLiveState);
  // Каталог с `.ts` есть только у вкладки, открытой из проекта.
  const available = tab?.source.kind === 'file' && Boolean(tab.source.path);

  const toggle = (): void => {
    if (ui.liveSchemas) {
      editorActions.setLiveSchemas(false);
      return;
    }
    if (
      !executionApproved &&
      !window.confirm(
        'Выполнить TS-код из папки формы?\n\n' +
          'validation.ts, form-behavior.ts, render-behavior.ts и registry.ts будут исполнены ' +
          'в этой вкладке браузера, чтобы форма в превью работала как в приложении.'
      )
    ) {
      return;
    }
    executionApproved = true;
    editorActions.setLiveSchemas(true);
  };

  // Что-то не собралось: либо весь каталог (status), либо отдельные файлы (errors).
  const failed = ui.liveSchemas ? (live.status === 'error' ? -1 : live.errors.length) : 0;
  const broken = failed !== 0;

  /** Подсказка кнопки: она же единственный носитель статуса — бейджей рядом нет. */
  const hint = (): string => {
    if (!available) {
      return 'Доступно для формы, открытой из проекта: рядом с form.json должны лежать .ts';
    }
    if (!ui.liveSchemas) {
      return 'Исполнять схемы формы из каталога: валидация, поведение, реестр';
    }
    if (failed === -1) return 'Схемы не собрались — подробности во вкладке «Форма» → Сборка';
    if (failed > 0) {
      return `Схемы исполняются, ${failed} файл(ов) с ошибкой — вкладка «Форма» → Сборка`;
    }
    return 'Схемы формы исполняются. Что подключилось — во вкладке «Форма»';
  };

  return (
    <div className="flex flex-none items-center gap-1">
      <button
        onClick={available ? toggle : undefined}
        disabled={!available}
        aria-pressed={ui.liveSchemas}
        title={hint()}
        className={cn(
          'flex h-6 items-center gap-1 rounded-md border px-2 text-[11.5px]',
          !available && 'cursor-not-allowed opacity-50',
          !ui.liveSchemas && 'border-border text-muted-foreground hover:bg-muted',
          ui.liveSchemas && !broken && 'border-emerald-500/50 bg-emerald-500/10 text-emerald-700',
          ui.liveSchemas && broken && 'border-destructive/50 bg-destructive/10 text-destructive'
        )}
      >
        {live.status === 'loading' ? (
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
        ) : (
          <Zap className="h-3.5 w-3.5" />
        )}
        Схемы формы
      </button>

      {ui.liveSchemas && (
        <button
          onClick={() => {
            reloadLiveForm();
            toast.info('Схемы перечитаны');
          }}
          title="Перечитать .ts каталога и пересобрать форму"
          className="grid h-6 w-6 flex-none place-items-center rounded-md border border-border text-muted-foreground hover:bg-muted"
        >
          <RefreshCw className="h-3.5 w-3.5" />
        </button>
      )}
    </div>
  );
}
