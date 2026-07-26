/**
 * Плавающая панель действий (прототип §5): переключатель Схематичный/Runtime, undo/redo,
 * validate (гейт `validateFormSchema`, спека §6/§14), экспорт (Mode A, §10) — с валидацией
 * перед экспортом. Состояние валидации сбрасывается при любой правке схемы.
 *
 * @module reformer-builder/canvas/FloatingActions
 */

import { useEffect, useState } from 'react';
import { Button } from '@reformer/ui-kit';
import { toast } from '@reformer/ui-kit/sonner';
import { Check, Redo2, Save, Undo2, X } from 'lucide-react';
import { editorActions, useActiveTab, useUi } from '../store';
import { validateSchema } from '../io/validate';
import { triggerSave } from '../app/save-actions';
import { showValidationErrors } from '../app/validation-toast';
import { cn } from '../lib/cn';

type ValidationStatus = 'idle' | 'ok' | 'error';

export function FloatingActions() {
  const ui = useUi();
  const tab = useActiveTab();
  const canUndo = (tab?.past.length ?? 0) > 0;
  const canRedo = (tab?.future.length ?? 0) > 0;

  const [status, setStatus] = useState<ValidationStatus>('idle');
  const [errors, setErrors] = useState<string[]>([]);

  // Любая правка схемы сбрасывает результат валидации (прототип §5).
  useEffect(() => {
    setStatus('idle');
    setErrors([]);
  }, [tab?.schema]);

  const runValidate = (): boolean => {
    if (!tab) return false;
    const res = validateSchema(tab.schema);
    setStatus(res.valid ? 'ok' : 'error');
    setErrors(res.errors);
    if (res.valid) toast.success('Схема валидна');
    else showValidationErrors(res.errors, tab.schema);
    return res.valid;
  };

  return (
    <div className="absolute right-4 top-2 z-10 flex flex-wrap items-center justify-end gap-1.5 rounded-lg border border-border bg-background/95 p-1 shadow-sm backdrop-blur">
      <div className="flex flex-none gap-0.5 rounded-md border border-border bg-muted p-0.5">
        <button
          onClick={() => editorActions.setPreview('wire')}
          className={cn(
            'h-6 rounded px-2 text-[11.5px]',
            ui.preview === 'wire' ? 'bg-background shadow-sm' : 'text-muted-foreground'
          )}
        >
          Схематичный
        </button>
        <button
          onClick={() => editorActions.setPreview('runtime')}
          className={cn(
            'h-6 rounded px-2 text-[11.5px]',
            ui.preview === 'runtime' ? 'bg-background shadow-sm' : 'text-muted-foreground'
          )}
        >
          Renderer
        </button>
      </div>
      <Button
        variant="outline"
        size="icon"
        className="h-6 w-6"
        disabled={!canUndo}
        onClick={editorActions.undo}
      >
        <Undo2 className="h-3.5 w-3.5" />
      </Button>
      <Button
        variant="outline"
        size="icon"
        className="h-6 w-6"
        disabled={!canRedo}
        onClick={editorActions.redo}
      >
        <Redo2 className="h-3.5 w-3.5" />
      </Button>
      <Button
        variant="outline"
        size="icon"
        title={errors.length ? errors.join('\n') : 'Проверить схему'}
        className={cn(
          'h-6 w-6',
          status === 'ok' && 'border-emerald-500/50 text-emerald-600',
          status === 'error' && 'border-destructive/50 text-destructive'
        )}
        onClick={runValidate}
      >
        {status === 'error' ? <X className="h-3.5 w-3.5" /> : <Check className="h-3.5 w-3.5" />}
      </Button>
      <Button
        size="icon"
        className="h-6 w-6"
        title={tab?.source.kind === 'file' ? 'Сохранить (⌘S)' : 'Экспорт JSON'}
        onClick={() => tab && void triggerSave(tab)}
      >
        <Save className="h-3.5 w-3.5" />
      </Button>
    </div>
  );
}
