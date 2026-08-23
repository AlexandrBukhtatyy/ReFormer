/**
 * Диалог «Форма по спеке»: текст постановки → готовая вкладка.
 *
 * Ввод двойной — вставить текст или выбрать файл — и это не удобство, а необходимость канала.
 * Билдер обязан работать на GitHub Pages, где File System Access недоступен, а `input[type=file]`
 * есть везде и разрешения не требует. Форматы — `.md`/`.txt`: разбор спеки в MCP работает по
 * тексту, а `.docx`/`.pdf` потребовали бы парсеров, которых в проекте нет.
 *
 * Результат показывается тостом, а не молча: `plan_form` разбирает спеку эвристиками и сам
 * говорит, чего не извлёк — формулы вычисляемых полей не угадываются намеренно. Проглотить эти
 * предупреждения значило бы выдать «форма создана» за «спека разобрана правильно».
 *
 * @module reformer-builder/app/SpecDialog
 */

import { useRef, useState } from 'react';
import { Button } from '@reformer/ui-kit/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@reformer/ui-kit/dialog';
import { Textarea } from '@reformer/ui-kit/textarea';
import { toast } from '@reformer/ui-kit/sonner';
import { createFormFromSpec } from './create-from-spec';

export function SpecDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const pickFile = async (file: File | undefined) => {
    if (!file) return;
    setText(await file.text());
  };

  const create = () => {
    setBusy(true);
    try {
      const res = createFormFromSpec(text);

      if (res.status === 'empty') {
        toast('В тексте не нашлось полей — форма не создана');
        return;
      }
      if (res.status === 'invalid') {
        // Не `showValidationErrors`: тот рендер делает путь узла ссылкой на строку raw-JSON, а
        // вкладки здесь нет — форму мы как раз и НЕ открыли. Ссылке было бы некуда вести.
        const errors = res.errors ?? [];
        toast.error(
          `Схема из спеки не прошла проверку (${errors.length}): ` + errors.slice(0, 3).join('; '),
          { duration: 12000, closeButton: true }
        );
        return;
      }

      toast(`Форма создана: ${res.tab}`);
      for (const w of res.warnings) toast(w);
      setText('');
      onClose();
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Форма по спеке</DialogTitle>
          <DialogDescription>
            Текст постановки — таблица полей в markdown или свободное описание. Поля, типы и правила
            валидации извлекаются автоматически; формулы вычисляемых полей и условия видимости
            придётся дописать — о них будет сказано отдельно.
          </DialogDescription>
        </DialogHeader>

        <Textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Вставьте текст спеки…"
          className="min-h-64 font-mono text-[12.5px]"
        />

        <input
          ref={fileRef}
          type="file"
          accept=".md,.txt,text/markdown,text/plain"
          className="hidden"
          onChange={(e) => void pickFile(e.target.files?.[0])}
        />

        <DialogFooter className="justify-between sm:justify-between">
          <Button variant="outline" onClick={() => fileRef.current?.click()}>
            Выбрать файл…
          </Button>
          <Button disabled={!text.trim() || busy} onClick={create}>
            Создать форму
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
