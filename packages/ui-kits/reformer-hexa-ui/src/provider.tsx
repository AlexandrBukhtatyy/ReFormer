/**
 * Провайдер кита: HexaUI — это styled-components со своей темой, поэтому поддерево превью надо
 * обернуть в `ConfigProvider` и вставить `GlobalStyle`. Билдер находит этот компонент в namespace
 * кита по имени из `descriptor.adapters.provider.symbol` и оборачивает им превью.
 *
 * Контейнеры и простые примитивы (`Box`/`Section`) живут здесь же: в HexaUI их нет — это
 * layout-заготовки ReFormer, и киту достаточно отдать честный `div` с `className`.
 *
 * @module reformer/kit-hexa-ui/provider
 */

import * as React from 'react';
import { ConfigProvider, GlobalStyle } from '@kaspersky/hexa-ui/design-system';
// Готовый CSS дизайн-системы. Импортируем ЗДЕСЬ, а не в билдере: кит самодостаточен, и его стили
// приезжают тем же чанком, что и компоненты, — только когда кит реально активирован.
import '@kaspersky/hexa-ui/design-system/global-style/styles.css';

/* eslint-disable @typescript-eslint/no-explicit-any */

/** Тема кита следует теме оболочки: билдер ставит класс `dark` на `<html>`. */
function useIsDark(): boolean {
  const [dark, setDark] = React.useState(
    () => typeof document !== 'undefined' && document.documentElement.classList.contains('dark')
  );
  React.useEffect(() => {
    const el = document.documentElement;
    const observer = new MutationObserver(() => setDark(el.classList.contains('dark')));
    observer.observe(el, { attributes: true, attributeFilter: ['class'] });
    return () => observer.disconnect();
  }, []);
  return dark;
}

/**
 * Обёртка поддерева превью темой HexaUI.
 *
 * ВАЖНО: `ConfigProvider` ждёт КЛЮЧ темы (`'light' | 'dark'`, enum `ThemeKey`), а не объект.
 * Экспортируемые `LIGHT_THEME`/`DARK_THEME` — это `ThemeConfig` для другого провайдера
 * (`ThemeProvider` из `design-system/theme`), и передача их сюда роняет рендер с
 * «ThemeProvider: "theme" prop is required».
 */
export function KitProvider({ children }: { children?: React.ReactNode }) {
  const dark = useIsDark();
  const Provider = ConfigProvider as any;
  return (
    <Provider theme={dark ? 'dark' : 'light'}>
      <GlobalStyle />
      {/*
        Контейнер-скоуп. Таблица стилей HexaUI несёт ресет antd — правила на `html`, `body` и `*`,
        которые иначе перекрашивают оболочку билдера (замер: из 5465 правил глобальных 9, решающее —
        `* { font-family: … }`). Сборка билдера переписывает эти селекторы под `.rb-kit-scope`
        (`vite-plugins/scope-kit-css.ts`), поэтому кит обязан такой контейнер предоставить.

        `display: contents` — чтобы обёртка не создавала бокс и не влияла на раскладку формы:
        наследование свойств и селекторы-потомки через неё работают, а лишнего блока в разметке нет.
      */}
      <div className="rb-kit-scope" style={{ display: 'contents' }}>
        {children}
      </div>
    </Provider>
  );
}

/** Универсальный контейнер ReFormer: в HexaUI аналога нет, отдаём div с классом. */
export function Box({ className, children }: { className?: string; children?: React.ReactNode }) {
  return <div className={className}>{children}</div>;
}

/** Секция — тот же контейнер; отдельное имя нужно палитре и схемам. */
export const Section = Box;
