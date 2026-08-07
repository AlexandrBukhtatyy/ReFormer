/**
 * Переключатель активного UI-kit в тулбаре.
 *
 * Смена кита — с перезагрузкой страницы: каталог, реестр превью, множество известных имён и
 * монако-диагностика мемоизированы на графе модулей, и пересоздать граф целиком надёжнее, чем
 * инвалидировать четыре кэша и все React-мемо, закрывшиеся над каталогом. Черновики вкладок живут
 * в IndexedDB и перезагрузку переживают; вкладки, привязанные к файлам проекта, — нет, поэтому
 * спрашиваем подтверждение.
 *
 * @module reformer-builder/app/KitSwitcher
 */

import { useEffect } from 'react';
import { toast } from '@reformer/ui-kit/sonner';
import { DEFAULT_KIT_ID, listKits } from '../kits/registry';
import { storeSelectedKitId } from '../kits/selection';
import { getKitBootResult } from '../config/boot';

/** Пауза перед reload: у синхронизации черновиков debounce 400 мс — даём ему добежать. */
const DRAFT_FLUSH_MS = 500;

export function KitSwitcher() {
  const kits = listKits();
  const boot = getKitBootResult();
  const activeId = boot?.kit.id ?? DEFAULT_KIT_ID;

  // Итог активации показываем один раз после старта: молча откатиться на другой кит нельзя —
  // пользователь увидел бы чужую палитру и не понял, почему.
  useEffect(() => {
    if (!boot) return;
    if (boot.fallbackReason) {
      toast.error('Кит не активирован', {
        description: `${boot.fallbackReason}. Работаем на ките по умолчанию.`,
        duration: 12000,
      });
    } else if (boot.missingInfra.length) {
      toast.warning(`${boot.kit.label} ${boot.kit.version}`, {
        description: `Кит не поставляет: ${boot.missingInfra.join(', ')}. Эти узлы в превью — заглушки.`,
        duration: 8000,
      });
    }
  }, [boot]);

  if (kits.length < 2) return null;

  const onChange = (id: string) => {
    if (id === activeId) return;
    const kit = kits.find((k) => k.id === id);
    const ok = window.confirm(
      `Переключить UI-kit на «${kit?.label} ${kit?.version}»?\n\n` +
        'Страница перезагрузится. Черновики вкладок сохранятся, ' +
        'вкладки открытых файлов проекта придётся открыть заново.'
    );
    if (!ok) return;
    storeSelectedKitId(id);
    setTimeout(() => location.reload(), DRAFT_FLUSH_MS);
  };

  return (
    <label className="flex items-center gap-1.5" title="Активный UI-kit для палитры и превью">
      <span className="sr-only">UI-kit</span>
      <select
        value={activeId}
        onChange={(e) => onChange(e.target.value)}
        className="h-7 rounded-md border border-border bg-background px-1.5 text-[12px] text-muted-foreground hover:text-foreground"
      >
        {kits.map((k) => (
          <option key={k.id} value={k.id}>
            {k.label} {k.version}
          </option>
        ))}
      </select>
    </label>
  );
}
