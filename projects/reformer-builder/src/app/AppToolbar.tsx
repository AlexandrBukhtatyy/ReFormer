/**
 * Верхний тулбар приложения (title-bar в стиле VSCode): бренд-иконка + название слева,
 * глобальные переключатели справа (тема). Полоса на всю ширину над рабочей областью
 * (рейлы/панели/canvas — уровнем ниже).
 *
 * @module reformer-builder/app/AppToolbar
 */

import { Blocks, Moon, Sun } from 'lucide-react';
import { editorActions, useUi } from '../store';
import { getRuntimeConfig } from '../config/state';
import { AppMenuBar } from './AppMenuBar';

export function AppToolbar() {
  const ui = useUi();
  // Брендинг клиента (если передан конфиг): название продукта + логотип. Конфиг статичен после
  // бутстрапа, поэтому читаем один раз при рендере.
  const branding = getRuntimeConfig().branding;
  const productName = branding?.productName ?? 'ReFormer Builder';
  return (
    <header className="flex h-9 flex-none items-center gap-2 border-b border-border bg-sidebar px-2.5">
      {/* бренд */}
      <div className="flex select-none items-center gap-2">
        <span className="grid h-[22px] w-[22px] place-items-center overflow-hidden rounded-md bg-primary text-primary-foreground shadow-sm">
          {branding?.logoUrl ? (
            <img src={branding.logoUrl} alt="" className="h-full w-full object-contain" />
          ) : (
            <Blocks className="h-3.5 w-3.5" />
          )}
        </span>
        <span className="text-[13px] font-semibold tracking-tight text-foreground">
          {productName}
        </span>
      </div>

      {/* меню в стиле VSCode (Файл / Правка / Вид) */}
      <AppMenuBar />

      <div className="flex-1" />

      {/* глобальные действия */}
      <button
        title={ui.theme === 'dark' ? 'Светлая тема' : 'Тёмная тема'}
        onClick={() => editorActions.setTheme(ui.theme === 'dark' ? 'light' : 'dark')}
        className="grid h-7 w-7 place-items-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground"
      >
        {ui.theme === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
      </button>
    </header>
  );
}
